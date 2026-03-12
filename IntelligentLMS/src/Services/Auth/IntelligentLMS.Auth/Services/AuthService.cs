using Microsoft.Extensions.Configuration;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BCrypt.Net;
using IntelligentLMS.Auth.Data;
using IntelligentLMS.Auth.Entities;
using IntelligentLMS.Shared.DTOs.Auth;
using IntelligentLMS.Shared.DTOs.Common;
using IntelligentLMS.Shared.DTOs.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Google.Apis.Auth;
using System.Security.Cryptography;
using System.Net;
using System.Net.Mail;

namespace IntelligentLMS.Auth.Services;

public interface IAuthService
{
    Task<JwtResponse> LoginAsync(LoginRequest request);
    Task<UserDto> RegisterAsync(RegisterRequest request);
    Task<JwtResponse> RefreshTokenAsync(string token, string refreshToken);
    Task<JwtResponse> GoogleLoginAsync(GoogleLoginRequest request);
    Task ForgotPasswordAsync(ForgotPasswordRequest request);
    Task ResetPasswordAsync(ResetPasswordRequest request);
}

public class AuthService : IAuthService
{
    private readonly AuthDbContext _context;
    private readonly IConfiguration _configuration;

    public AuthService(AuthDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    public async Task<UserDto> RegisterAsync(RegisterRequest request)
    {
        if (await _context.Users.AnyAsync(u => u.Email == request.Email))
            throw new Exception("User already exists");

        var user = new User
        {
            Email = request.Email,
            FullName = request.FullName,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = Roles.Student
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            FullName = user.FullName,
            Role = user.Role
        };
    }

    public async Task<JwtResponse> LoginAsync(LoginRequest request)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new Exception("Invalid credentials");

        if (user.IsLocked)
            throw new Exception("Account is locked");

        return await GenerateTokensAsync(user);
    }

    public async Task<JwtResponse> RefreshTokenAsync(string token, string refreshToken)
    {
        var storedToken = await _context.RefreshTokens.FirstOrDefaultAsync(rt => rt.Token == refreshToken);
        if (storedToken == null || storedToken.IsRevoked || storedToken.ExpiryDate < DateTime.UtcNow)
            throw new Exception("Invalid refresh token");

        var user = await _context.Users.FindAsync(storedToken.UserId);
        if (user == null) throw new Exception("User not found");

        storedToken.IsRevoked = true;
        await _context.SaveChangesAsync();

        return await GenerateTokensAsync(user);
    }

    public async Task<JwtResponse> GoogleLoginAsync(GoogleLoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.IdToken))
            throw new Exception("Missing Google id token");

        var googleClientId = _configuration["Authentication:Google:ClientId"];
        if (string.IsNullOrWhiteSpace(googleClientId))
            throw new Exception("Google client id is not configured");

        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(
                request.IdToken,
                new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = new[] { googleClientId }
                });
        }
        catch
        {
            throw new Exception("Invalid Google token");
        }

        var email = payload.Email;
        if (string.IsNullOrWhiteSpace(email))
            throw new Exception("Google account has no email");

        var fullName = payload.Name ?? payload.GivenName ?? email;

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null)
        {
            user = new User
            {
                Email = email,
                FullName = fullName,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString()),
                Role = Roles.Student,
                CreatedAt = DateTime.UtcNow,
                IsLocked = false
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();
        }

        if (user.IsLocked)
            throw new Exception("Account is locked");

        return await GenerateTokensAsync(user);
    }

    public async Task ForgotPasswordAsync(ForgotPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            throw new Exception("Email is required");

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        if (user == null)
            throw new Exception("Email không tồn tại trong hệ thống");

        var otp = GenerateOtpCode();

        var resetToken = new PasswordResetToken
        {
            UserId = user.Id,
            Token = otp,
            ExpireAt = DateTime.UtcNow.AddMinutes(15),
            Used = false,
            CreatedAt = DateTime.UtcNow
        };

        _context.PasswordResetTokens.Add(resetToken);
        await _context.SaveChangesAsync();

        await SendOtpEmailAsync(user.Email, otp);
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Otp) ||
            string.IsNullOrWhiteSpace(request.NewPassword))
        {
            throw new Exception("Email, OTP và mật khẩu mới là bắt buộc");
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        if (user == null)
            throw new Exception("Email không tồn tại trong hệ thống");

        var token = await _context.PasswordResetTokens
            .Where(t => t.UserId == user.Id && t.Token == request.Otp)
            .OrderByDescending(t => t.CreatedAt)
            .FirstOrDefaultAsync();

        if (token == null || token.Used || token.ExpireAt < DateTime.UtcNow)
            throw new Exception("Mã OTP không hợp lệ hoặc đã hết hạn");

        token.Used = true;
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);

        await _context.SaveChangesAsync();
    }

    private async Task<JwtResponse> GenerateTokensAsync(User user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role)
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(60),
            signingCredentials: creds
        );

        var refreshToken = new RefreshToken
        {
            UserId = user.Id,
            Token = Guid.NewGuid().ToString(),
            ExpiryDate = DateTime.UtcNow.AddDays(7)
        };

        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync();

        return new JwtResponse
        {
            Token = new JwtSecurityTokenHandler().WriteToken(token),
            RefreshToken = refreshToken.Token
        };
    }

    private static string GenerateOtpCode()
    {
        // Tạo OTP 6 số ngẫu nhiên
        var bytes = new byte[4];
        RandomNumberGenerator.Fill(bytes);
        var value = BitConverter.ToUInt32(bytes, 0) % 1_000_000;
        return value.ToString("D6");
    }

    private async Task SendOtpEmailAsync(string toEmail, string otp)
    {
        var host = _configuration["Email:Host"];
        var portStr = _configuration["Email:Port"];
        var user = _configuration["Email:User"];
        var password = _configuration["Email:Password"];
        var from = _configuration["Email:From"];

        if (string.IsNullOrWhiteSpace(host) ||
            string.IsNullOrWhiteSpace(portStr) ||
            string.IsNullOrWhiteSpace(user) ||
            string.IsNullOrWhiteSpace(password) ||
            string.IsNullOrWhiteSpace(from))
        {
            Console.WriteLine("[Email] Cấu hình Email không đầy đủ. OTP: " + otp);
            return;
        }

        if (!int.TryParse(portStr, out var port))
        {
            Console.WriteLine("[Email] Port email không hợp lệ. OTP: " + otp);
            return;
        }

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(user, password)
        };

        var message = new MailMessage
        {
            From = new MailAddress(from),
            Subject = "Mã OTP đặt lại mật khẩu - IntelligentLMS",
            Body = $"Mã OTP của bạn là: {otp}\nMã có hiệu lực trong 15 phút.",
            IsBodyHtml = false
        };

        message.To.Add(toEmail);

        await client.SendMailAsync(message);
    }
}