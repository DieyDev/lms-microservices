using System.ComponentModel.DataAnnotations;
using IntelligentLMS.Shared.DTOs.Common;

namespace IntelligentLMS.Auth.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    [Required]
    public string Email { get; set; } = string.Empty;
    [Required]
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = Roles.Student;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsLocked { get; set; } = false;
}

public class RefreshToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiryDate { get; set; }
    public bool IsRevoked { get; set; } = false;
}

public class PasswordResetToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Token { get; set; } = string.Empty;
    public DateTime ExpireAt { get; set; }
    public bool Used { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
