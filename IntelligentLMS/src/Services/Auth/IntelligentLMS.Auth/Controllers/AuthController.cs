using IntelligentLMS.Auth.Data;
using IntelligentLMS.Auth.Entities;
using IntelligentLMS.Auth.Services;
using IntelligentLMS.Shared.DTOs.Auth;
using IntelligentLMS.Shared.DTOs.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BCrypt.Net;

namespace IntelligentLMS.Auth.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly AuthDbContext _db;

    public AuthController(IAuthService authService, AuthDbContext db)
    {
        _authService = authService;
        _db = db;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        try
        {
            var result = await _authService.RegisterAsync(request);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        try
        {
            var result = await _authService.LoginAsync(request);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    [HttpPost("google-login")]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequest request)
    {
        try
        {
            var result = await _authService.GoogleLoginAsync(request);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] JwtResponse request)
    {
        try
        {
            var result = await _authService.RefreshTokenAsync(request.Token, request.RefreshToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        try
        {
            await _authService.ForgotPasswordAsync(request);
            return Ok(new { message = "Nếu email tồn tại, mã OTP đã được gửi." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        try
        {
            await _authService.ResetPasswordAsync(request);
            return Ok(new { message = "Đổi mật khẩu thành công." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Admin APIs (dữ liệu thật từ lms_auth.Users)
    // ─────────────────────────────────────────────────────────────

    public sealed class AdminCreateUserRequest
    {
        public string Email { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = "Teacher";
        public string Password { get; set; } = "Password123!";
    }

    public sealed class AdminUpdateUserRequest
    {
        public string? FullName { get; set; }
        public string? Role { get; set; }
        public bool? IsLocked { get; set; }
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers([FromQuery] string? role = null)
    {
        var q = _db.Users.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(role))
        {
            var r = role.Trim();
            q = q.Where(u => u.Role == r);
        }

        var users = await q
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => new { id = u.Id, email = u.Email, fullName = u.FullName, role = u.Role, isLocked = u.IsLocked, createdAt = u.CreatedAt })
            .ToListAsync();

        return Ok(users);
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] AdminCreateUserRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new { message = "Email là bắt buộc." });

        var email = request.Email.Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(u => u.Email.ToLower() == email))
            return BadRequest(new { message = "Email đã tồn tại." });

        var role = string.IsNullOrWhiteSpace(request.Role) ? "Teacher" : request.Role.Trim();
        var password = string.IsNullOrWhiteSpace(request.Password) ? "Password123!" : request.Password;

        var user = new User
        {
            Email = email,
            FullName = request.FullName?.Trim() ?? string.Empty,
            Role = role,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            CreatedAt = DateTime.UtcNow,
            IsLocked = false
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return Ok(new { id = user.Id, email = user.Email, fullName = user.FullName, role = user.Role, isLocked = user.IsLocked, createdAt = user.CreatedAt });
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("users/{id:guid}")]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] AdminUpdateUserRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound(new { message = "Không tìm thấy user." });

        if (request.FullName != null) user.FullName = request.FullName.Trim();
        if (request.Role != null) user.Role = request.Role.Trim();
        if (request.IsLocked.HasValue) user.IsLocked = request.IsLocked.Value;

        await _db.SaveChangesAsync();

        return Ok(new { id = user.Id, email = user.Email, fullName = user.FullName, role = user.Role, isLocked = user.IsLocked, createdAt = user.CreatedAt });
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("users/{id:guid}")]
    public async Task<IActionResult> DeleteUser(Guid id)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound(new { message = "Không tìm thấy user." });

        _db.Users.Remove(user);
        await _db.SaveChangesAsync();

        return NoContent();
    }
}