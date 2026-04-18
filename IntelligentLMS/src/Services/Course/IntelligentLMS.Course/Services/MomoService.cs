using System.Collections.Generic;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace IntelligentLMS.Course.Services;

/// <summary>
/// MoMo Payment Gateway — <c>POST /v2/gateway/api/create</c>.
/// Mặc định <c>requestType = payWithCC</c>: thẻ quốc tế, luồng web qua <c>payUrl</c> (không dùng deeplink app).
/// Xem <see href="https://developers.momo.vn/v3/vi/docs/payment/api/credit/onetime/">Thanh toán thẻ QT</see>.
/// Các giá trị khác: <c>payWithATM</c>, <c>captureWallet</c> (cấu hình <c>Momo:RequestType</c>).
/// </summary>
public class MomoService
{
    private readonly HttpClient _http;
    private readonly ILogger<MomoService> _logger;
    private readonly IConfiguration _config;

    public MomoService(HttpClient http, IConfiguration config, ILogger<MomoService> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
    }

    public record CreatePaymentResult(
        string? PayUrl,
        string? Deeplink,
        string? QrCodeUrl,
        string? RequestId,
        string? OrderId,
        int? ResultCode,
        string? Message
    );

    public record ProcessPaymentOutcome(
        bool Success,
        string Message,
        string? TransactionId,
        decimal Amount
    );

    /// <summary>Bắt buộc với <c>payWithCC</c>: <c>email</c> theo tài liệu MoMo.</summary>
    public record MomoPayerInfo(string Email, string? Name = null, string? PhoneNumber = null);

    public async Task<CreatePaymentResult> CreatePayUrlAsync(
        long amountVnd,
        string orderInfo,
        string orderId,
        string requestId,
        string extraData,
        MomoPayerInfo? payer = null,
        CancellationToken cancellationToken = default)
    {
        var partnerCode = _config["Momo:PartnerCode"] ?? "";
        var accessKey = _config["Momo:AccessKey"] ?? "";
        var secretKey = _config["Momo:SecretKey"] ?? "";
        var endpoint = ResolveEndpoint();
        var redirectUrl = _config["Momo:RedirectUrl"] ?? "";
        var ipnUrl = _config["Momo:IpnUrl"] ?? "";
        var requestType = _config["Momo:RequestType"] ?? "payWithCC";
        var partnerName = _config["Momo:PartnerName"] ?? "IntelligentLMS";
        var storeId = _config["Momo:StoreId"] ?? "IntelligentLMS";
        var includeAccessKeyInBody = _config.GetValue("Momo:IncludeAccessKeyInBody", false);
        var debug = _config.GetValue("Momo:Debug", false);
        var omitAccessKeyInBody = OmitAccessKeyInBody(requestType);

        if (string.IsNullOrWhiteSpace(partnerCode) ||
            string.IsNullOrWhiteSpace(accessKey) ||
            string.IsNullOrWhiteSpace(secretKey) ||
            string.IsNullOrWhiteSpace(redirectUrl) ||
            string.IsNullOrWhiteSpace(ipnUrl))
        {
            throw new InvalidOperationException("Thiếu cấu hình MoMo (Momo:*).");
        }

        var amount = amountVnd.ToString();
        var rawSignature =
            $"accessKey={accessKey}" +
            $"&amount={amount}" +
            $"&extraData={extraData}" +
            $"&ipnUrl={ipnUrl}" +
            $"&orderId={orderId}" +
            $"&orderInfo={orderInfo}" +
            $"&partnerCode={partnerCode}" +
            $"&redirectUrl={redirectUrl}" +
            $"&requestId={requestId}" +
            $"&requestType={requestType}";

        var signature = HmacSha256(secretKey, rawSignature);

        if (string.Equals(requestType, "payWithCC", StringComparison.OrdinalIgnoreCase) &&
            (payer == null || string.IsNullOrWhiteSpace(payer.Email)))
        {
            throw new InvalidOperationException(
                "payWithCC yêu cầu userInfo.email. Đảm bảo JWT có claim email hoặc truyền MomoPayerInfo.");
        }

        // payWithATM / payWithCC: tài liệu mẫu không gửi accessKey trong JSON (chỉ trong chữ ký).
        var body = new Dictionary<string, object?>
        {
            ["partnerCode"] = partnerCode,
            ["partnerName"] = partnerName,
            ["storeId"] = storeId,
            ["requestId"] = requestId,
            ["amount"] = omitAccessKeyInBody ? amountVnd : amount,
            ["orderId"] = orderId,
            ["orderInfo"] = orderInfo,
            ["redirectUrl"] = redirectUrl,
            ["ipnUrl"] = ipnUrl,
            ["lang"] = "vi",
            ["extraData"] = extraData,
            ["requestType"] = requestType,
            ["signature"] = signature
        };

        if (string.Equals(requestType, "payWithCC", StringComparison.OrdinalIgnoreCase) && payer != null)
        {
            var ui = new Dictionary<string, object?> { ["email"] = payer.Email.Trim() };
            if (!string.IsNullOrWhiteSpace(payer.Name)) ui["name"] = payer.Name;
            if (!string.IsNullOrWhiteSpace(payer.PhoneNumber)) ui["phoneNumber"] = payer.PhoneNumber;
            body["userInfo"] = ui;
        }

        if (!omitAccessKeyInBody && includeAccessKeyInBody)
            body["accessKey"] = accessKey;
        else if (omitAccessKeyInBody && includeAccessKeyInBody)
            _logger.LogWarning("[MOMO] Momo:IncludeAccessKeyInBody=true bị bỏ qua với requestType={RequestType}", requestType);

        if (debug)
        {
            _logger.LogInformation("[MOMO] RawHash={RawHash}", rawSignature);
            _logger.LogInformation("[MOMO] Request body keys={Keys}", string.Join(",", body.Keys));
        }

        _logger.LogInformation(
            "[MOMO_CREATE] requestType={RequestType} orderId={OrderId} requestId={RequestId} amount={Amount}",
            requestType, orderId, requestId, amount);

        const int maxAttempts = 3;
        var backoffMs = new[] { 0, 600, 1200 };
        Exception? lastEx = null;

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            if (attempt > 1)
            {
                await Task.Delay(backoffMs[attempt - 1], cancellationToken);
                _logger.LogInformation("[MOMO_CREATE] Retry attempt={Attempt}", attempt);
            }

            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Post, endpoint)
                {
                    Content = JsonContent.Create(body, options: new JsonSerializerOptions(JsonSerializerDefaults.Web))
                };

                using var res = await _http.SendAsync(req, cancellationToken);
                var json = await res.Content.ReadAsStringAsync(cancellationToken);

                if (!res.IsSuccessStatusCode)
                {
                    _logger.LogWarning("[MOMO_CREATE] HTTP {Status} body={Body} attempt={Attempt}", (int)res.StatusCode, json, attempt);
                    if ((int)res.StatusCode >= 500 && attempt < maxAttempts)
                        continue;
                    return new CreatePaymentResult(null, null, null, requestId, orderId, null, json);
                }

                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                string? payUrl = root.TryGetProperty("payUrl", out var p) ? p.GetString() : null;
                string? deeplink = root.TryGetProperty("deeplink", out var d) ? d.GetString() : null;
                string? qr = root.TryGetProperty("qrCodeUrl", out var q) ? q.GetString() : null;
                int? resultCode = root.TryGetProperty("resultCode", out var rc) ? rc.GetInt32() : null;
                string? message = root.TryGetProperty("message", out var m) ? m.GetString() : null;

                if (resultCode is not null && resultCode != 0)
                {
                    _logger.LogWarning("[MOMO_CREATE] API resultCode={Code} message={Message} attempt={Attempt}", resultCode, message, attempt);
                    return new CreatePaymentResult(null, deeplink, qr, requestId, orderId, resultCode, message);
                }

                if (!string.IsNullOrWhiteSpace(payUrl))
                    return new CreatePaymentResult(payUrl, deeplink, qr, requestId, orderId, resultCode, message);

                _logger.LogError("[MOMO_CREATE] No payUrl response={Json} attempt={Attempt}", json, attempt);
                return new CreatePaymentResult(null, deeplink, qr, requestId, orderId, resultCode, message);
            }
            catch (Exception ex) when (attempt < maxAttempts)
            {
                lastEx = ex;
                _logger.LogWarning(ex, "[MOMO_CREATE] Exception attempt={Attempt}", attempt);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[MOMO_CREATE] Failed after {Attempts} attempts", maxAttempts);
                throw;
            }
        }

        if (lastEx != null)
            throw lastEx;

        throw new InvalidOperationException("MoMo create failed.");
    }

    /// <summary>Mẫu tài liệu MoMo cho payWithATM / payWithCC không gửi accessKey trong body.</summary>
    private static bool OmitAccessKeyInBody(string requestType) =>
        string.Equals(requestType, "payWithATM", StringComparison.OrdinalIgnoreCase)
        || string.Equals(requestType, "payWithCC", StringComparison.OrdinalIgnoreCase);

    private string ResolveEndpoint()
    {
        var useProd = _config.GetValue("Momo:UseProduction", false);
        if (useProd)
            return _config["Momo:EndpointProd"] ?? "https://payment.momo.vn/v2/gateway/api/create";
        return _config["Momo:Endpoint"] ?? _config["Momo:EndpointTest"] ?? "https://test-payment.momo.vn/v2/gateway/api/create";
    }

    /// <summary>
    /// Lấy id gốc từ extraData JSON <c>original_order_id</c> hoặc prefix <c>orderId</c> trước dấu '_' (theo PHP).
    /// </summary>
    public static string ExtractOriginalOrderIdPrefix(string? momoOrderId, string? extraData)
    {
        if (!string.IsNullOrWhiteSpace(extraData))
        {
            try
            {
                using var doc = JsonDocument.Parse(extraData);
                if (doc.RootElement.TryGetProperty("original_order_id", out var o))
                {
                    var s = o.ValueKind == JsonValueKind.Number ? o.GetRawText().Trim() : o.GetString();
                    if (!string.IsNullOrEmpty(s))
                        return s;
                }
            }
            catch
            {
                /* ignore */
            }
        }

        if (string.IsNullOrEmpty(momoOrderId))
            return "";

        var idx = momoOrderId.IndexOf('_');
        if (idx > 0)
            return momoOrderId[..idx];

        return momoOrderId;
    }

    /// <summary>
    /// Xác thực chữ ký callback (redirect GET hoặc IPN JSON) — thử v2 redirect/ipn, create request, legacy IPN.
    /// </summary>
    public bool VerifyCallbackSignature(IReadOnlyDictionary<string, string?> parameters, string? recvSignature)
    {
        if (string.IsNullOrWhiteSpace(recvSignature))
            return false;

        var secretKey = _config["Momo:SecretKey"] ?? "";
        var accessKey = _config["Momo:AccessKey"] ?? "";
        var debug = _config.GetValue("Momo:Debug", false);

        var p = new Dictionary<string, string?>(parameters, StringComparer.OrdinalIgnoreCase);

        static bool TryHash(string raw, string secret, string recv, bool debugLog, ILogger logger)
        {
            var calc = HmacSha256(secret, raw);
            if (debugLog)
            {
                logger.LogInformation("[MOMO_VERIFY] RawHash={Raw}", raw);
                logger.LogInformation("[MOMO_VERIFY] Calc={Calc} Recv={Recv}", calc, recv);
            }

            return FixedTimeEqualsHex(calc, recv);
        }

        // v2 redirect / IPN (thứ tự key cố định)
        var v2Keys = new[]
        {
            "accessKey", "amount", "extraData", "message", "orderId", "orderInfo", "orderType",
            "partnerCode", "payType", "requestId", "responseTime", "resultCode", "transId"
        };
        var v2Parts = new List<string>();
        foreach (var key in v2Keys)
        {
            var val = key.Equals("accessKey", StringComparison.OrdinalIgnoreCase)
                ? (p.GetValueOrDefault("accessKey") ?? accessKey)
                : p.GetValueOrDefault(key);
            v2Parts.Add($"{key}={val ?? ""}");
        }

        var rawV2 = string.Join("&", v2Parts);
        if (TryHash(rawV2, secretKey, recvSignature, debug, _logger))
            return true;

        // create request (chỉ các key có trong params)
        var createKeys = new[]
        {
            "accessKey", "amount", "extraData", "ipnUrl", "orderId", "orderInfo",
            "partnerCode", "redirectUrl", "requestId", "requestType"
        };
        var createParts = new List<string>();
        foreach (var key in createKeys)
        {
            if (!p.ContainsKey(key))
                continue;
            createParts.Add($"{key}={p[key] ?? ""}");
        }

        var rawCreate = string.Join("&", createParts);
        if (createParts.Count > 0 && TryHash(rawCreate, secretKey, recvSignature, debug, _logger))
            return true;

        // legacy IPN
        var legacyKeys = new[]
        {
            "partnerCode", "accessKey", "requestId", "amount", "orderId", "orderInfo",
            "orderType", "transId", "message", "localMessage", "responseTime", "errorCode", "payType", "extraData"
        };
        if (!p.ContainsKey("errorCode") && p.TryGetValue("resultCode", out var rc))
            p["errorCode"] = rc;

        var legacyParts = new List<string>();
        foreach (var key in legacyKeys)
        {
            if (!p.ContainsKey(key))
                continue;
            legacyParts.Add($"{key}={p[key] ?? ""}");
        }

        var rawLegacy = string.Join("&", legacyParts);
        return legacyParts.Count > 0 && TryHash(rawLegacy, secretKey, recvSignature, debug, _logger);
    }

    public ProcessPaymentOutcome ProcessPaymentResult(IReadOnlyDictionary<string, string?> data)
    {
        data.TryGetValue("orderId", out var momoOrderId);

        if (string.IsNullOrWhiteSpace(momoOrderId))
            return new ProcessPaymentOutcome(false, "Mã đơn hàng không hợp lệ", null, 0);

        if (!data.TryGetValue("signature", out var sig) || string.IsNullOrWhiteSpace(sig))
            return new ProcessPaymentOutcome(false, "Thiếu chữ ký", null, 0);

        if (!VerifyCallbackSignature(data, sig))
            return new ProcessPaymentOutcome(false, "Chữ ký không hợp lệ", null, 0);

        var resultCodeStr = data.GetValueOrDefault("resultCode") ?? "-1";
        int.TryParse(resultCodeStr, out var resultCode);
        var transId = data.GetValueOrDefault("transId") ?? "";
        _ = decimal.TryParse(data.GetValueOrDefault("amount"), System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var amount);

        if (resultCode == 0)
            return new ProcessPaymentOutcome(true, "Thanh toán thành công", transId, amount);

        return new ProcessPaymentOutcome(false, GetResponseMessage(resultCode), transId, amount);
    }

    public string GetResponseMessage(int resultCode)
    {
        var messages = new Dictionary<int, string>
        {
            [0] = "Giao dịch thành công",
            [1000] = "Thông tin không hợp lệ",
            [1001] = "Giao dịch đã tồn tại",
            [1002] = "Merchant không hợp lệ",
            [1003] = "Không tìm thấy giao dịch",
            [1004] = "Giao dịch đã được xử lý",
            [1005] = "Không thể xử lý giao dịch",
            [1006] = "Người dùng hủy giao dịch",
            [1007] = "Hết hạn thanh toán",
            [1008] = "Lỗi hệ thống",
            [1009] = "Số tiền không hợp lệ",
            [1010] = "Thông tin đơn hàng không hợp lệ",
        };

        return messages.TryGetValue(resultCode, out var msg)
            ? msg
            : $"Lỗi không xác định. Mã lỗi: {resultCode}";
    }

    /// <summary>Giữ tương thích code cũ gọi <c>VerifySignature(secret, raw, sig)</c>.</summary>
    public bool VerifySignature(string secretKey, string rawSignature, string? signatureFromMomo)
    {
        if (string.IsNullOrWhiteSpace(signatureFromMomo)) return false;
        var sig = HmacSha256(secretKey, rawSignature);
        return FixedTimeEqualsHex(sig, signatureFromMomo);
    }

    private static bool FixedTimeEqualsHex(string a, string b)
    {
        if (string.IsNullOrWhiteSpace(b)) return false;
        return string.Equals(a, b, StringComparison.OrdinalIgnoreCase);
    }

    private static string HmacSha256(string key, string data)
    {
        var keyBytes = Encoding.UTF8.GetBytes(key);
        var dataBytes = Encoding.UTF8.GetBytes(data);
        using var hmac = new HMACSHA256(keyBytes);
        var hash = hmac.ComputeHash(dataBytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
