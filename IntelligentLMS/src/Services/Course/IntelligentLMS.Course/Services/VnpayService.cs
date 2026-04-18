using System.Security.Cryptography;
using System.Net;
using System.Text;
using Microsoft.Extensions.Logging;

namespace IntelligentLMS.Course.Services;

public class VnpayService
{
    private readonly string _tmnCode;
    private readonly string _hashSecret;
    private readonly string _baseUrl;
    private readonly string _returnUrl;
    private readonly string _ipnUrl;
    private readonly ILogger<VnpayService> _logger;

    public VnpayService(IConfiguration config, ILogger<VnpayService> logger)
    {
        _tmnCode = config["Vnpay:TmnCode"] ?? "";
        _hashSecret = config["Vnpay:HashSecret"] ?? "";
        _baseUrl = config["Vnpay:Url"] ?? "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
        _returnUrl = config["Vnpay:ReturnUrl"] ?? "";
        _ipnUrl = config["Vnpay:IpnUrl"] ?? "";
        _logger = logger;
    }

    public string CreatePaymentUrl(long amount, string orderInfo, string txnRef, string ipAddr = "127.0.0.1")
    {
        // Chuẩn hóa IP để tránh case IPv6-mapped (vd: ::ffff:172.18.x.x)
        // Mẫu demo VNPay thường dùng Utils.GetIpAddress() để lấy IPv4 thuần.
        if (ipAddr == "::1") ipAddr = "127.0.0.1";
        if (ipAddr.StartsWith("::ffff:", StringComparison.OrdinalIgnoreCase))
            ipAddr = ipAddr.Substring("::ffff:".Length);
        if (ipAddr.StartsWith("[") && ipAddr.EndsWith("]"))
            ipAddr = ipAddr.Substring(1, ipAddr.Length - 2);

        var vnpayParams = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            { "vnp_Version", "2.1.0" },
            { "vnp_Command", "pay" },
            { "vnp_TmnCode", _tmnCode },
            { "vnp_Amount", (amount * 100).ToString() },

            // FIX: dùng UTC +7 chuẩn
            { "vnp_CreateDate", DateTime.UtcNow.AddHours(7).ToString("yyyyMMddHHmmss") },

            { "vnp_CurrCode", "VND" },
            { "vnp_IpAddr", ipAddr },
            { "vnp_Locale", "vn" },
            { "vnp_OrderInfo", orderInfo },
            { "vnp_OrderType", "other" },
            { "vnp_ReturnUrl", _returnUrl },
            { "vnp_TxnRef", txnRef },

            // (không bắt buộc nhưng nên có)
            { "vnp_ExpireDate", DateTime.UtcNow.AddHours(7).AddMinutes(15).ToString("yyyyMMddHHmmss") }
        };

        // VNPay: SecureHash tính trên chuỗi canonical.
        // Mẫu C# thường dùng WebUtility.UrlEncode cho cả key và value.
        var hashData = string.Join("&", vnpayParams.Select(kv =>
            $"{WebUtility.UrlEncode(kv.Key)}={WebUtility.UrlEncode(kv.Value)}"));

        var queryString = string.Join("&", vnpayParams.Select(kv =>
            $"{WebUtility.UrlEncode(kv.Key)}={WebUtility.UrlEncode(kv.Value)}"));

        var vnpSecureHash = HmacSha512(_hashSecret, hashData);

        // VNPay: SecureHashType thường KHÔNG nằm trong chuỗi ký; chỉ gửi kèm trên URL.
        var paymentUrl = $"{_baseUrl}?{queryString}&vnp_SecureHashType=HmacSHA512&vnp_SecureHash={vnpSecureHash}";

        // Log phục vụ debug: KHÔNG in full secret.
        _logger.LogInformation(
            "[VNPAY_CREATE] tmnCode={TmnCode} hashSecret={SecretMasked} txnRef={TxnRef} ip={Ip} returnUrl={ReturnUrl} expireDate={ExpireDate} orderInfo={OrderInfo}",
            _tmnCode,
            MaskSecret(_hashSecret),
            txnRef,
            ipAddr,
            _returnUrl,
            vnpayParams.TryGetValue("vnp_ExpireDate", out var exp) ? exp : "",
            orderInfo);
        _logger.LogInformation("[VNPAY_CREATE] hashData={HashData}", hashData);
        _logger.LogInformation("[VNPAY_CREATE] secureHash={SecureHash}", vnpSecureHash);
        _logger.LogInformation("[VNPAY_CREATE] paymentUrl={PaymentUrl}", paymentUrl);

        return paymentUrl;
    }

    public bool VerifyReturnUrl(IQueryCollection query)
    {
        var vnpSecureHash = query["vnp_SecureHash"].FirstOrDefault();
        if (string.IsNullOrEmpty(vnpSecureHash)) return false;

        var paramDict = new SortedDictionary<string, string>(StringComparer.Ordinal);

        foreach (var key in query.Keys
                     .Where(k => k.StartsWith("vnp_") &&
                                 k != "vnp_SecureHash" &&
                                 k != "vnp_SecureHashType"))
        {
            var val = query[key].FirstOrDefault();
            if (!string.IsNullOrEmpty(val))
                paramDict[key] = val;
        }

        // VNPay: Verify SecureHash với canonical tương tự CreatePaymentUrl.
        var hashData = string.Join("&", paramDict.Select(kv =>
            $"{WebUtility.UrlEncode(kv.Key)}={WebUtility.UrlEncode(kv.Value)}"));

        var computedHash = HmacSha512(_hashSecret, hashData);

        return string.Equals(vnpSecureHash, computedHash, StringComparison.OrdinalIgnoreCase);
    }

    private static string HmacSha512(string key, string data)
    {
        var keyBytes = Encoding.UTF8.GetBytes(key);
        var dataBytes = Encoding.UTF8.GetBytes(data);
        using var hmac = new HMACSHA512(keyBytes);
        var hash = hmac.ComputeHash(dataBytes);
        return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
    }

    private static string MaskSecret(string secret)
    {
        if (string.IsNullOrEmpty(secret)) return "<empty>";
        if (secret.Length <= 8) return $"{secret[..1]}***{secret[^1..]}(len={secret.Length})";
        return $"{secret[..4]}***{secret[^4..]}(len={secret.Length})";
    }
}