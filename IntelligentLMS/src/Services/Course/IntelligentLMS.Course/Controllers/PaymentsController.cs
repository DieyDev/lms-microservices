using IntelligentLMS.Course.Data;
using IntelligentLMS.Course.Entities;
using IntelligentLMS.Course.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace IntelligentLMS.Course.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly CourseDbContext _context;
    private readonly VnpayService _vnpay;
    private readonly MomoService _momo;
    private readonly IProgressServiceClient _progressClient;
    private readonly IConfiguration _config;
    private readonly ILogger<PaymentsController> _logger;

    public PaymentsController(
        CourseDbContext context,
        VnpayService vnpay,
        MomoService momo,
        IProgressServiceClient progressClient,
        IConfiguration config,
        ILogger<PaymentsController> logger)
    {
        _context = context;
        _vnpay = vnpay;
        _momo = momo;
        _progressClient = progressClient;
        _config = config;
        _logger = logger;
    }

    /// <summary>
    /// Tạo URL thanh toán VNPAY cho khóa học có phí
    /// </summary>
    [HttpPost("vnpay/create")]
    [Authorize]
    public async Task<IActionResult> CreateVnpayUrl([FromBody] CreateVnpayRequest request)
    {
        try
        {
            if (request == null)
                return BadRequest(new { message = "Request body không hợp lệ" });

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
            var userId = userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var uid) ? uid : request.UserId ?? Guid.Empty;

            if (userId == Guid.Empty)
                return Unauthorized(new { message = "Không xác định được người dùng" });

            var courseId = request.CourseId;
            if (courseId == Guid.Empty)
                return BadRequest(new { message = "CourseId không hợp lệ" });

            var course = await _context.Courses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == courseId);
            if (course == null)
                return NotFound(new { message = "Không tìm thấy khóa học" });

            if (course.Price <= 0)
                return BadRequest(new { message = "Khóa học này miễn phí, vui lòng ghi danh trực tiếp" });

            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            if (ip == "::1") ip = "127.0.0.1";
            var rawRef = $"{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}";
            var txnRef = rawRef.Length > 50 ? rawRef[..50] : rawRef;    // Ensure txnRef is not longer than 50 characters
            // VNPay: giữ OrderInfo ở dạng ASCII đơn giản để tránh lỗi format.
            var orderInfo = $"COURSE {courseId} USER {userId}";
            var paymentUrl = _vnpay.CreatePaymentUrl((long)course.Price, orderInfo, txnRef, ip);

            // Trả thêm txnRef để dễ tra cứu trên VNPAY merchant portal (PaymentSearch)
            return Ok(new { paymentUrl, courseId = course.Id, txnRef });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, detail = ex.ToString() });
        }
    }

    /// <summary>
    /// Tạo URL thanh toán MoMo: mặc định <c>payWithCC</c> (thẻ quốc tế, trang web — mở <c>paymentUrl</c> trong trình duyệt, không dùng deeplink app).
    /// </summary>
    [HttpPost("momo/create")]
    [Authorize]
    public async Task<IActionResult> CreateMomoUrl([FromBody] CreateMomoRequest request)
    {
        try
        {
            if (request == null)
                return BadRequest(new { message = "Request body không hợp lệ" });

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
            var userId = userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var uid) ? uid : request.UserId ?? Guid.Empty;

            if (userId == Guid.Empty)
                return Unauthorized(new { message = "Không xác định được người dùng" });

            var payerEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value;
            if (string.IsNullOrWhiteSpace(payerEmail))
                return BadRequest(new { message = "Tài khoản cần có email để thanh toán MoMo (payWithCC)." });

            var courseId = request.CourseId;
            if (courseId == Guid.Empty)
                return BadRequest(new { message = "CourseId không hợp lệ" });

            var course = await _context.Courses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == courseId);
            if (course == null)
                return NotFound(new { message = "Không tìm thấy khóa học" });

            if (course.Price <= 0)
                return BadRequest(new { message = "Khóa học này miễn phí, vui lòng ghi danh trực tiếp" });

            // MoMo yêu cầu orderId + requestId là string (thường GUID)
            var orderId = Guid.NewGuid().ToString();
            var requestId = Guid.NewGuid().ToString();

            // MoMo hiển thị orderInfo trực tiếp trên trang thanh toán, nên để mô tả thân thiện.
            // Dữ liệu courseId/userId sẽ lấy từ extraData ở callback.
            var orderInfo = $"Thanh toan khoa hoc: {course.Title}";

            // extraData: có thể để rỗng hoặc base64 json
            var extraObj = new { courseId, userId };
            var extraData = Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(extraObj)));

            var payerName = User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value;
            var payer = new MomoService.MomoPayerInfo(payerEmail.Trim(), payerName);

            var result = await _momo.CreatePayUrlAsync((long)course.Price, orderInfo, orderId, requestId, extraData, payer);
            if (string.IsNullOrWhiteSpace(result.PayUrl))
            {
                return StatusCode(502, new { message = "MoMo không trả payUrl", detail = result.Message, resultCode = result.ResultCode });
            }

            var requestType = _config["Momo:RequestType"] ?? "payWithCC";

            return Ok(new
            {
                paymentUrl = result.PayUrl,
                courseId = course.Id,
                orderId = result.OrderId,
                requestId = result.RequestId,
                momo = new { result.ResultCode, result.Message, requestType }
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message, detail = ex.ToString() });
        }
    }

    /// <summary>
    /// Callback sau khi thanh toán VNPAY (redirect URL)
    /// </summary>
    [HttpGet("vnpay/return")]
    [AllowAnonymous]
    public async Task<IActionResult> VnpayReturn()
    {
        var frontendBase = _config["FrontendBaseUrl"] ?? "http://localhost:5173";
        var failUrl = $"{frontendBase}/payment/result";
        var successUrl = failUrl;

        var txnRef = Request.Query["vnp_TxnRef"].FirstOrDefault();
        var transactionNo = Request.Query["vnp_TransactionNo"].FirstOrDefault();
        var responseCode = Request.Query["vnp_ResponseCode"].FirstOrDefault();
        var transactionStatus = Request.Query["vnp_TransactionStatus"].FirstOrDefault();

        _logger.LogInformation(
            "[VNPAY_RETURN] TxnRef={TxnRef} TransactionNo={TransactionNo} ResponseCode={ResponseCode} TransactionStatus={TransactionStatus}",
            txnRef, transactionNo, responseCode, transactionStatus);

        if (!_vnpay.VerifyReturnUrl(Request.Query))
            return Redirect($"{failUrl}?status=fail&message=Invalid+hash&txnRef={Uri.EscapeDataString(txnRef ?? string.Empty)}");

        // VNPAY: thành công thường là ResponseCode=00 và TransactionStatus=00
        if (responseCode != "00" || transactionStatus != "00")
        {
            var msg = Request.Query["vnp_Message"].FirstOrDefault() ?? "Thanh toán thất bại";
            return Redirect($"{failUrl}?status=fail&message={Uri.EscapeDataString(msg)}&txnRef={Uri.EscapeDataString(txnRef ?? string.Empty)}");
        }

        Guid courseId = Guid.Empty;
        Guid userId = Guid.Empty;
        var orderInfo = Request.Query["vnp_OrderInfo"].FirstOrDefault() ?? "";
        const string coursePrefix = "COURSE ";
        const string userMarker = " USER ";
        if (string.IsNullOrEmpty(orderInfo) ||
            !orderInfo.StartsWith(coursePrefix, StringComparison.Ordinal) ||
            !orderInfo.Contains(userMarker, StringComparison.Ordinal))
        {
            return Redirect($"{failUrl}?status=fail&message=Invalid+order+info&txnRef={Uri.EscapeDataString(txnRef ?? string.Empty)}");
        }

        var userMarkerIndex = orderInfo.IndexOf(userMarker, StringComparison.Ordinal);
        var coursePart = orderInfo.Substring(coursePrefix.Length, userMarkerIndex - coursePrefix.Length);
        var userPart = orderInfo.Substring(userMarkerIndex + userMarker.Length);

        if (Guid.TryParse(coursePart, out var cid)) courseId = cid;
        if (Guid.TryParse(userPart, out var uid)) userId = uid;

        if (courseId == Guid.Empty || userId == Guid.Empty)
        {
            return Redirect($"{failUrl}?status=fail&message=Cannot+parse+order&txnRef={Uri.EscapeDataString(txnRef ?? string.Empty)}");
        }

        _ = await _progressClient.EnrollAsync(userId, courseId);

        return Redirect($"{successUrl}?status=success&courseId={courseId}&txnRef={Uri.EscapeDataString(txnRef ?? string.Empty)}&transactionNo={Uri.EscapeDataString(transactionNo ?? string.Empty)}");
    }

    /// <summary>
    /// Callback sau khi thanh toán MoMo (redirect URL). Xác thực chữ ký theo v2 / create / legacy (tương đương MoMoService.php).
    /// </summary>
    [HttpGet("momo/return")]
    [AllowAnonymous]
    public async Task<IActionResult> MomoReturn()
    {
        var frontendBase = _config["FrontendBaseUrl"] ?? "http://localhost:5173";
        var failUrl = $"{frontendBase}/payment/result";
        var successUrl = failUrl;

        var queryDict = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        foreach (var kv in Request.Query)
            queryDict[kv.Key] = kv.Value.FirstOrDefault();

        var orderId = queryDict.GetValueOrDefault("orderId");
        var extraData = queryDict.GetValueOrDefault("extraData");
        var orderInfo = queryDict.GetValueOrDefault("orderInfo") ?? "";

        _logger.LogInformation("[MOMO_RETURN] orderId={OrderId} resultCode={ResultCode} transId={TransId} amount={Amount}",
            orderId, queryDict.GetValueOrDefault("resultCode"), queryDict.GetValueOrDefault("transId"), queryDict.GetValueOrDefault("amount"));

        if (string.IsNullOrWhiteSpace(_config["Momo:SecretKey"]))
            return Redirect($"{failUrl}?status=fail&message=Missing+MoMo+config&orderId={Uri.EscapeDataString(orderId ?? string.Empty)}");

        var outcome = _momo.ProcessPaymentResult(queryDict);
        if (!outcome.Success)
        {
            return Redirect($"{failUrl}?status=fail&message={Uri.EscapeDataString(outcome.Message)}&orderId={Uri.EscapeDataString(orderId ?? string.Empty)}");
        }

        Guid courseId = Guid.Empty;
        Guid userId = Guid.Empty;
        if (!TryParseMomoExtraData(extraData, out courseId, out userId))
        {
            if (!string.IsNullOrEmpty(orderInfo) && orderInfo.Contains('|'))
            {
                var parts = orderInfo.Split('|');
                foreach (var p in parts)
                {
                    if (p.StartsWith("COURSE=", StringComparison.Ordinal) && Guid.TryParse(p.AsSpan(7), out var cid)) courseId = cid;
                    if (p.StartsWith("USER=", StringComparison.Ordinal) && Guid.TryParse(p.AsSpan(5), out var uid)) userId = uid;
                }
            }
        }

        if (courseId == Guid.Empty || userId == Guid.Empty)
            return Redirect($"{failUrl}?status=fail&message=Cannot+parse+order&orderId={Uri.EscapeDataString(orderId ?? string.Empty)}");

        _ = await _progressClient.EnrollAsync(userId, courseId);

        var transId = queryDict.GetValueOrDefault("transId");
        return Redirect($"{successUrl}?status=success&courseId={courseId}&orderId={Uri.EscapeDataString(orderId ?? string.Empty)}&transId={Uri.EscapeDataString(transId ?? string.Empty)}");
    }

    public class MomoIpnModel
    {
        public string? PartnerCode { get; set; }
        public string? AccessKey { get; set; }
        public string? OrderId { get; set; }
        public string? RequestId { get; set; }
        public string? Amount { get; set; }
        public string? OrderInfo { get; set; }
        public string? OrderType { get; set; }
        public string? TransId { get; set; }
        public string? ResultCode { get; set; }
        public string? Message { get; set; }
        public string? LocalMessage { get; set; }
        public string? PayType { get; set; }
        public string? ResponseTime { get; set; }
        public string? ExtraData { get; set; }
        public string? Signature { get; set; }
        public string? ErrorCode { get; set; }
    }

    /// <summary>
    /// IPN (server-to-server) callback từ MoMo (POST JSON). Chữ ký: v2 / create / legacy (như PHP).
    /// </summary>
    [HttpPost("momo/ipn")]
    [AllowAnonymous]
    public async Task<IActionResult> MomoIpn([FromBody] MomoIpnModel model)
    {
        _logger.LogInformation("[MOMO_IPN] orderId={OrderId} requestId={RequestId} resultCode={ResultCode} transId={TransId}",
            model?.OrderId, model?.RequestId, model?.ResultCode, model?.TransId);

        if (string.IsNullOrWhiteSpace(_config["Momo:SecretKey"]) || model == null)
            return BadRequest(new { status = "error", message = "Invalid config or body" });

        var dict = MomoIpnToDictionary(model);
        if (!_momo.VerifyCallbackSignature(dict, model.Signature))
        {
            _logger.LogWarning("[MOMO_IPN] Invalid signature orderId={OrderId}", model.OrderId);
            return BadRequest(new { status = "error", message = "Invalid signature" });
        }

        if (!int.TryParse(model.ResultCode, out var resultCode))
            resultCode = -1;

        Guid courseId = Guid.Empty;
        Guid userId = Guid.Empty;
        if (!TryParseMomoExtraData(model.ExtraData, out courseId, out userId))
        {
            var oi = model.OrderInfo ?? "";
            if (oi.Contains('|', StringComparison.Ordinal))
            {
                foreach (var p in oi.Split('|'))
                {
                    if (p.StartsWith("COURSE=", StringComparison.Ordinal) && Guid.TryParse(p.AsSpan(7), out var cid)) courseId = cid;
                    if (p.StartsWith("USER=", StringComparison.Ordinal) && Guid.TryParse(p.AsSpan(5), out var uid)) userId = uid;
                }
            }
        }

        if (model.OrderId is null || courseId == Guid.Empty || userId == Guid.Empty)
        {
            _logger.LogWarning("[MOMO_IPN] Invalid order/extraData orderId={OrderId}", model.OrderId);
            return BadRequest(new { status = "error", message = "Invalid orderId" });
        }

        var course = await _context.Courses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == courseId);
        if (course == null)
        {
            _logger.LogWarning("[MOMO_IPN] Course not found courseId={CourseId}", courseId);
            return BadRequest(new { status = "error", message = "Order not found" });
        }

        if (!decimal.TryParse(model.Amount, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var ipnAmount) ||
            Math.Abs(ipnAmount - (decimal)course.Price) > 0.01m)
        {
            _logger.LogWarning("[MOMO_IPN] Amount mismatch course={CourseId} expected={Expected} received={Received}",
                courseId, course.Price, model.Amount);
            return BadRequest(new { status = "error", message = "Amount mismatch" });
        }

        if (resultCode != 0)
        {
            _logger.LogInformation("[MOMO_IPN] Payment failed orderId={OrderId} resultCode={Code}", model.OrderId, resultCode);
            return Ok(new { status = "success", message = "Payment failed recorded" });
        }

        try
        {
            _ = await _progressClient.EnrollAsync(userId, courseId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[MOMO_IPN] Enroll failed orderId={OrderId} user={UserId} course={CourseId}", model.OrderId, userId, courseId);
            return StatusCode(500, new { status = "error", message = "Unknown error" });
        }

        return Ok(new { status = "success" });
    }

    private static Dictionary<string, string?> MomoIpnToDictionary(MomoIpnModel m)
    {
        var d = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["partnerCode"] = m.PartnerCode,
            ["accessKey"] = m.AccessKey,
            ["requestId"] = m.RequestId,
            ["amount"] = m.Amount,
            ["orderId"] = m.OrderId,
            ["orderInfo"] = m.OrderInfo,
            ["orderType"] = m.OrderType,
            ["transId"] = m.TransId,
            ["message"] = m.Message,
            ["localMessage"] = m.LocalMessage,
            ["payType"] = m.PayType,
            ["responseTime"] = m.ResponseTime,
            ["extraData"] = m.ExtraData,
            ["resultCode"] = m.ResultCode,
            ["errorCode"] = m.ErrorCode
        };
        return d;
    }

    /// <summary>
    /// IPN (server-to-server) callback từ VNPAY.
    /// Trả JSON { RspCode, Message } để VNPAY ghi nhận đã nhận.
    /// </summary>
    [HttpGet("vnpay/ipn")]
    [AllowAnonymous]
    public async Task<IActionResult> VnpayIpn()
    {
        var txnRef = Request.Query["vnp_TxnRef"].FirstOrDefault();
        var transactionNo = Request.Query["vnp_TransactionNo"].FirstOrDefault();
        var responseCode = Request.Query["vnp_ResponseCode"].FirstOrDefault();
        var transactionStatus = Request.Query["vnp_TransactionStatus"].FirstOrDefault();
        var orderInfo = Request.Query["vnp_OrderInfo"].FirstOrDefault() ?? "";

        _logger.LogInformation(
            "[VNPAY_IPN] TxnRef={TxnRef} TransactionNo={TransactionNo} ResponseCode={ResponseCode} TransactionStatus={TransactionStatus}",
            txnRef, transactionNo, responseCode, transactionStatus);

        // 1) Verify hash
        if (!_vnpay.VerifyReturnUrl(Request.Query))
        {
            _logger.LogWarning("[VNPAY_IPN] Invalid hash for TxnRef={TxnRef}", txnRef);
            return Ok(new { RspCode = "97", Message = "Invalid signature" });
        }

        // 2) Check success status
        if (responseCode != "00" || transactionStatus != "00")
        {
            _logger.LogWarning("[VNPAY_IPN] Not success TxnRef={TxnRef} Code={Code} Status={Status}", txnRef, responseCode, transactionStatus);
            return Ok(new { RspCode = "00", Message = "Received" });
        }

        // 3) Parse orderInfo: COURSE <guid> USER <guid>
        Guid courseId = Guid.Empty;
        Guid userId = Guid.Empty;
        const string coursePrefix = "COURSE ";
        const string userMarker = " USER ";
        if (string.IsNullOrEmpty(orderInfo) ||
            !orderInfo.StartsWith(coursePrefix, StringComparison.Ordinal) ||
            !orderInfo.Contains(userMarker, StringComparison.Ordinal))
        {
            _logger.LogWarning("[VNPAY_IPN] Invalid orderInfo TxnRef={TxnRef} OrderInfo={OrderInfo}", txnRef, orderInfo);
            return Ok(new { RspCode = "01", Message = "Invalid order info" });
        }

        var userMarkerIndex = orderInfo.IndexOf(userMarker, StringComparison.Ordinal);
        var coursePart = orderInfo.Substring(coursePrefix.Length, userMarkerIndex - coursePrefix.Length);
        var userPart = orderInfo.Substring(userMarkerIndex + userMarker.Length);

        if (Guid.TryParse(coursePart, out var cid)) courseId = cid;
        if (Guid.TryParse(userPart, out var uid)) userId = uid;

        if (courseId == Guid.Empty || userId == Guid.Empty)
        {
            _logger.LogWarning("[VNPAY_IPN] Cannot parse order TxnRef={TxnRef} OrderInfo={OrderInfo}", txnRef, orderInfo);
            return Ok(new { RspCode = "01", Message = "Cannot parse order" });
        }

        // 4) Enroll (idempotent phía Progress service hoặc sẽ tạo mới nếu chưa có)
        try
        {
            _ = await _progressClient.EnrollAsync(userId, courseId);
        }
        catch (Exception ex)
        {
            // VNPAY có thể retry IPN; báo received để tránh retry vô hạn, đồng thời log để điều tra.
            _logger.LogError(ex, "[VNPAY_IPN] Enroll failed TxnRef={TxnRef} User={UserId} Course={CourseId}", txnRef, userId, courseId);
            return Ok(new { RspCode = "00", Message = "Received" });
        }

        return Ok(new { RspCode = "00", Message = "Confirm Success" });
    }

    private static bool TryParseMomoExtraData(string? extraData, out Guid courseId, out Guid userId)
    {
        courseId = Guid.Empty;
        userId = Guid.Empty;
        if (string.IsNullOrWhiteSpace(extraData)) return false;

        try
        {
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(extraData));
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (root.TryGetProperty("courseId", out var c) && Guid.TryParse(c.GetString(), out var cid))
                courseId = cid;
            if (root.TryGetProperty("userId", out var u) && Guid.TryParse(u.GetString(), out var uid))
                userId = uid;

            return courseId != Guid.Empty && userId != Guid.Empty;
        }
        catch
        {
            return false;
        }
    }
}

public class CreateVnpayRequest
{
    public Guid? UserId { get; set; }
    public Guid CourseId { get; set; }
}

public class CreateMomoRequest
{
    public Guid? UserId { get; set; }
    public Guid CourseId { get; set; }
}

