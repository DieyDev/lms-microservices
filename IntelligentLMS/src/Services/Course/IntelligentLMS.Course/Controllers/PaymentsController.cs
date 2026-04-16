using IntelligentLMS.Course.Data;
using IntelligentLMS.Course.Entities;
using IntelligentLMS.Course.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace IntelligentLMS.Course.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly CourseDbContext _context;
    private readonly VnpayService _vnpay;
    private readonly IProgressServiceClient _progressClient;
    private readonly IConfiguration _config;
    private readonly ILogger<PaymentsController> _logger;

    public PaymentsController(
        CourseDbContext context,
        VnpayService vnpay,
        IProgressServiceClient progressClient,
        IConfiguration config,
        ILogger<PaymentsController> logger)
    {
        _context = context;
        _vnpay = vnpay;
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
            var rawRef = $"{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}";
            var txnRef = rawRef.Length > 50 ? rawRef[..50] : rawRef;    // Ensure txnRef is not longer than 50 characters
            var orderInfo = $"COURSE={courseId}|USER={userId}";
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

        var orderInfo = Request.Query["vnp_OrderInfo"].FirstOrDefault() ?? "";
        if (string.IsNullOrEmpty(orderInfo) || !orderInfo.Contains("|"))
        {
            return Redirect($"{failUrl}?status=fail&message=Invalid+order+info&txnRef={Uri.EscapeDataString(txnRef ?? string.Empty)}");
        }

        var parts = orderInfo.Split('|');
        Guid courseId = Guid.Empty;
        Guid userId = Guid.Empty;
        foreach (var p in parts)
        {
            if (p.StartsWith("COURSE=") && Guid.TryParse(p.Substring(7), out var cid)) courseId = cid;
            if (p.StartsWith("USER=") && Guid.TryParse(p.Substring(5), out var uid)) userId = uid;
        }

        if (courseId == Guid.Empty || userId == Guid.Empty)
        {
            return Redirect($"{failUrl}?status=fail&message=Cannot+parse+order&txnRef={Uri.EscapeDataString(txnRef ?? string.Empty)}");
        }

        _ = await _progressClient.EnrollAsync(userId, courseId);

        return Redirect($"{successUrl}?status=success&courseId={courseId}&txnRef={Uri.EscapeDataString(txnRef ?? string.Empty)}&transactionNo={Uri.EscapeDataString(transactionNo ?? string.Empty)}");
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

        // 3) Parse orderInfo: COURSE=<guid>|USER=<guid>
        if (string.IsNullOrEmpty(orderInfo) || !orderInfo.Contains("|"))
        {
            _logger.LogWarning("[VNPAY_IPN] Invalid orderInfo TxnRef={TxnRef} OrderInfo={OrderInfo}", txnRef, orderInfo);
            return Ok(new { RspCode = "01", Message = "Invalid order info" });
        }

        var parts = orderInfo.Split('|');
        Guid courseId = Guid.Empty;
        Guid userId = Guid.Empty;
        foreach (var p in parts)
        {
            if (p.StartsWith("COURSE=") && Guid.TryParse(p.Substring(7), out var cid)) courseId = cid;
            if (p.StartsWith("USER=") && Guid.TryParse(p.Substring(5), out var uid)) userId = uid;
        }

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
}

public class CreateVnpayRequest
{
    public Guid? UserId { get; set; }
    public Guid CourseId { get; set; }
}
