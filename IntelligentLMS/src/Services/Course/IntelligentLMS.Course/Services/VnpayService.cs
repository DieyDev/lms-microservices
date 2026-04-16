using System.Security.Cryptography;
using System.Text;

namespace IntelligentLMS.Course.Services;

public class VnpayService
{
    private readonly string _tmnCode;
    private readonly string _hashSecret;
    private readonly string _baseUrl;
    private readonly string _returnUrl;
    private readonly string _ipnUrl;

    public VnpayService(IConfiguration config)
    {
        _tmnCode = config["Vnpay:TmnCode"] ?? "";
        _hashSecret = config["Vnpay:HashSecret"] ?? "";
        _baseUrl = config["Vnpay:Url"] ?? "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
        _returnUrl = config["Vnpay:ReturnUrl"] ?? "";
        _ipnUrl = config["Vnpay:IpnUrl"] ?? "";
    }

    /// <summary>
    /// Tạo URL thanh toán VNPAY
    /// </summary>
    /// <param name="amount">Số tiền VND (gốc, không nhân 100)</param>
    /// <param name="orderInfo">Mô tả đơn hàng</param>
    /// <param name="txnRef">Mã tham chiếu đơn hàng (không trùng trong ngày)</param>
    /// <param name="ipAddr">IP khách hàng</param>
    public string CreatePaymentUrl(long amount, string orderInfo, string txnRef, string ipAddr = "127.0.0.1")
    {
        var vnpayParams = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            { "vnp_Version", "2.1.0" },
            { "vnp_Command", "pay" },
            { "vnp_TmnCode", _tmnCode },
            { "vnp_Amount", (amount * 100).ToString() }, // VNPAY yêu cầu amount * 100
            { "vnp_CreateDate", DateTime.Now.AddHours(7).ToString("yyyyMMddHHmmss") },
            { "vnp_CurrCode", "VND" },
            { "vnp_IpAddr", ipAddr },
            { "vnp_Locale", "vn" },
            { "vnp_OrderInfo", orderInfo },
            { "vnp_OrderType", "other" },
            { "vnp_ReturnUrl", _returnUrl },
            { "vnp_TxnRef", txnRef }
        };

        // IPN (server-to-server) callback URL
        if (!string.IsNullOrWhiteSpace(_ipnUrl))
        {
            vnpayParams["vnp_IpnUrl"] = _ipnUrl;
        }

        var queryString = string.Join("&", vnpayParams.Select(kv =>
            $"{kv.Key}={Uri.EscapeDataString(kv.Value)}"));
        var hashData = queryString;
        var vnpSecureHash = HmacSha512(_hashSecret, hashData);

        return $"{_baseUrl}?{queryString}&vnp_SecureHash={vnpSecureHash}";
    }

    /// <summary>
    /// Xác minh hash từ URL return của VNPAY
    /// </summary>
    public bool VerifyReturnUrl(IQueryCollection query)
    {
        var vnpSecureHash = query["vnp_SecureHash"].FirstOrDefault();
        if (string.IsNullOrEmpty(vnpSecureHash)) return false;

        var paramDict = new SortedDictionary<string, string>(StringComparer.Ordinal);
        foreach (var key in query.Keys.Where(k => k.StartsWith("vnp_") && k != "vnp_SecureHash" && k != "vnp_SecureHashType"))
        {
            var val = query[key].FirstOrDefault();
            if (!string.IsNullOrEmpty(val))
                paramDict[key] = val;
        }

        var hashData = string.Join("&", paramDict.Select(kv =>
            $"{kv.Key}={Uri.EscapeDataString(kv.Value)}"));
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
}
