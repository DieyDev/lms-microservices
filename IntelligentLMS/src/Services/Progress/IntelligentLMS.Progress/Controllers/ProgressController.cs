using IntelligentLMS.Progress.Data;
using IntelligentLMS.Progress.Entities;
using IntelligentLMS.Progress.Services;
using IntelligentLMS.Shared.DTOs.Progress;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using System.Text.Json;

namespace IntelligentLMS.Progress.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProgressController : ControllerBase
{
    private readonly ProgressDbContext _context;
    private readonly IAiAdvisorClient _aiClient;
    private readonly ICourseServiceClient _courseClient;
    private readonly IDistributedCache? _cache;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public ProgressController(
        ProgressDbContext context,
        IAiAdvisorClient aiClient,
        ICourseServiceClient courseClient,
        IDistributedCache? cache = null)
    {
        _context = context;
        _aiClient = aiClient;
        _courseClient = courseClient;
        _cache = cache;
    }

    [HttpGet("{userId}/{courseId}")]
    public async Task<IActionResult> GetCourseProgress(Guid userId, Guid courseId)
    {
        var cacheKey = $"progress:{userId}:{courseId}";
        if (_cache != null)
        {
            var cached = await _cache.GetStringAsync(cacheKey);
            if (!string.IsNullOrWhiteSpace(cached))
            {
                var fromCache = JsonSerializer.Deserialize<CourseProgressResponseDto>(cached, JsonOptions);
                if (fromCache != null) return Ok(fromCache);
            }
        }

        var totalLessons = await _courseClient.GetLessonCountAsync(courseId);
        var completedRecords = await _context.LessonProgresses
            .Where(p => p.UserId == userId && p.CourseId == courseId && p.IsCompleted)
            .Select(p => new { p.LessonId, p.CompletedAt })
            .ToListAsync();
        var completedLessons = completedRecords.Count;
        var completedLessonIds = completedRecords.Select(r => r.LessonId).ToList();
        
        var progressPercentage = totalLessons > 0 
            ? Math.Round((double)completedLessons / totalLessons * 100, 1) 
            : 0;

        var lastProgress = completedRecords
            .Where(r => r.CompletedAt.HasValue)
            .OrderByDescending(r => r.CompletedAt)
            .Select(r => r.CompletedAt)
            .FirstOrDefault();

        var response = new CourseProgressResponseDto
        {
            Id = Guid.Empty,
            UserId = userId,
            CourseId = courseId,
            TotalLessons = totalLessons,
            CompletedLessons = completedLessons,
            ProgressPercentage = progressPercentage,
            UpdatedAt = lastProgress ?? DateTime.UtcNow,
            CompletedLessonIds = completedLessonIds
        };

        if (_cache != null)
        {
            await _cache.SetStringAsync(
                cacheKey,
                JsonSerializer.Serialize(response, JsonOptions),
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30)
                }
            );
        }
        return Ok(response);
    }

    [HttpGet("enrollments/{userId}")]
    public async Task<IActionResult> GetEnrollments(Guid userId)
    {
        var cacheKey = $"enrollments:{userId}";
        if (_cache != null)
        {
            var cached = await _cache.GetStringAsync(cacheKey);
            if (!string.IsNullOrWhiteSpace(cached))
            {
                var fromCache = JsonSerializer.Deserialize<List<object>>(cached, JsonOptions);
                if (fromCache != null) return Ok(fromCache);
            }
        }

        var enrollments = await _context.Enrollments
            .Where(e => e.UserId == userId)
            .OrderByDescending(e => e.EnrolledAt)
            .Select(e => new
            {
                e.CourseId,
                e.EnrolledAt,
                e.Status
            })
            .ToListAsync();

        if (_cache != null)
        {
            await _cache.SetStringAsync(
                cacheKey,
                JsonSerializer.Serialize(enrollments, JsonOptions),
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30)
                }
            );
        }

        return Ok(enrollments);
    }

    [HttpGet("is-enrolled/{userId}/{courseId}")]
    public async Task<IActionResult> IsEnrolled(Guid userId, Guid courseId)
    {
        var cacheKey = $"isEnrolled:{userId}:{courseId}";
        if (_cache != null)
        {
            var cached = await _cache.GetStringAsync(cacheKey);
            if (!string.IsNullOrWhiteSpace(cached))
            {
                var fromCache = JsonSerializer.Deserialize<Dictionary<string, bool>>(cached, JsonOptions);
                if (fromCache != null && fromCache.TryGetValue("enrolled", out var enrolledCached))
                    return Ok(new { enrolled = enrolledCached });
            }
        }

        var enrolled = await _context.Enrollments.AnyAsync(e => e.UserId == userId && e.CourseId == courseId);

        if (_cache != null)
        {
            await _cache.SetStringAsync(
                cacheKey,
                JsonSerializer.Serialize(new Dictionary<string, bool> { ["enrolled"] = enrolled }, JsonOptions),
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30)
                }
            );
        }
        return Ok(new { enrolled });
    }

    [HttpPost("enroll")]
    public async Task<IActionResult> Enroll([FromBody] EnrollmentDto enrollmentDto)
    {
        if (await _context.Enrollments.AnyAsync(e => e.UserId == enrollmentDto.UserId && e.CourseId == enrollmentDto.CourseId))
            return BadRequest("Already enrolled");

        var enrollment = new Enrollment
        {
            UserId = enrollmentDto.UserId,
            CourseId = enrollmentDto.CourseId,
            EnrolledAt = DateTime.UtcNow
        };

        _context.Enrollments.Add(enrollment);
        await _context.SaveChangesAsync();

        if (_cache != null)
        {
            await _cache.RemoveAsync($"enrollments:{enrollmentDto.UserId}");
            await _cache.RemoveAsync($"isEnrolled:{enrollmentDto.UserId}:{enrollmentDto.CourseId}");
            await _cache.RemoveAsync($"progress:{enrollmentDto.UserId}:{enrollmentDto.CourseId}");
        }
        
        enrollmentDto.EnrolledAt = enrollment.EnrolledAt;
        
        return Ok(enrollmentDto);
    }

    [HttpPost("complete")]
    public async Task<IActionResult> CompleteLesson([FromBody] ProgressDto progressDto)
    {
        var existing = await _context.LessonProgresses
            .FirstOrDefaultAsync(p => p.UserId == progressDto.UserId && p.LessonId == progressDto.LessonId);

        if (existing == null)
        {
            var progress = new LessonProgress
            {
                UserId = progressDto.UserId,
                LessonId = progressDto.LessonId,
                CourseId = progressDto.CourseId,
                IsCompleted = true,
                CompletedAt = DateTime.UtcNow
            };
            _context.LessonProgresses.Add(progress);
        }
        else
        {
            existing.IsCompleted = true;
            existing.CompletedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        if (_cache != null)
        {
            await _cache.RemoveAsync($"progress:{progressDto.UserId}:{progressDto.CourseId}");
        }
        
        progressDto.IsCompleted = true;
        progressDto.CompletedAt = DateTime.UtcNow;
        
        return Ok(progressDto);
    }

    [HttpGet("{userId}/recommendation")]
    public async Task<IActionResult> GetRecommendation(Guid userId)
    {
        // Calculate average progress
        var totalEnrolled = await _context.Enrollments.CountAsync(e => e.UserId == userId);
        double progress = 0; 
        
        // Simplified Logic: just mock progress percentage
        if (totalEnrolled > 0) progress = 45.0; 
        
        var recommendation = await _aiClient.GetRecommendationAsync(userId, progress);
        return Ok(new { recommendation });
    }
}
