using IntelligentLMS.Course.Data;
using IntelligentLMS.Course.Entities;
using IntelligentLMS.Course.Application.Interfaces;
using IntelligentLMS.Course.Application.DTOs;
using IntelligentLMS.Shared.Events;
using SharedDTOs = IntelligentLMS.Shared.DTOs.Courses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using System.Security.Claims;
using System.Text.Json;
using CourseEntity = IntelligentLMS.Course.Entities.Course;

namespace IntelligentLMS.Course.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CoursesController : ControllerBase
{
    private readonly CourseDbContext _context;
    private readonly IEventPublisher _eventPublisher;
    private readonly IDistributedCache? _cache;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public CoursesController(CourseDbContext context, IEventPublisher eventPublisher, IDistributedCache? cache = null)
    {
        _context = context;
        _eventPublisher = eventPublisher;
        _cache = cache;
    }

    private Guid? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? User.FindFirst("nameid")?.Value;
        if (Guid.TryParse(userIdClaim, out var userId))
            return userId;
        return null;
    }

    private string GetCurrentRole()
    {
        return (User.FindFirst(ClaimTypes.Role)?.Value
            ?? User.FindFirst("role")?.Value
            ?? string.Empty).ToLowerInvariant();
    }



    [HttpGet]
    public async Task<IActionResult> GetCourses()
    {
        const string cacheKey = "courses:all";
        if (_cache != null)
        {
            try
            {
                var cached = await _cache.GetStringAsync(cacheKey);
                if (!string.IsNullOrWhiteSpace(cached))
                {
                    var fromCache = JsonSerializer.Deserialize<List<SharedDTOs.CourseDto>>(cached, JsonOptions);
                    if (fromCache != null) return Ok(fromCache);
                }
            }
            catch
            {
                // Redis lỗi -> bỏ qua cache, lấy từ DB
            }
        }

        var courses = await _context.Courses.ToListAsync();
        var courseDtos = courses.Select(c => new SharedDTOs.CourseDto
        {
            Id = c.Id,
            Title = c.Title,
            Description = c.Description,
            Level = c.Level,
            Category = c.Category,
            InstructorId = c.InstructorId,
            Price = c.Price,
            ThumbnailUrl = c.ThumbnailUrl
        }).ToList();

        if (_cache != null)
        {
            try
            {
                await _cache.SetStringAsync(
                    cacheKey,
                    JsonSerializer.Serialize(courseDtos, JsonOptions),
                    new DistributedCacheEntryOptions
                    {
                        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
                    }
                );
            }
            catch { /* bỏ qua lỗi ghi cache */ }
        }

        return Ok(courseDtos);
    }

    [Authorize(Roles = "Admin,Teacher")]
    [HttpGet("me")]
    public async Task<IActionResult> GetMyCourses()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized("Không xác định được người dùng.");

        var courses = await _context.Courses
            .Where(c => c.InstructorId == userId.Value)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        var courseDtos = courses.Select(c => new SharedDTOs.CourseDto
        {
            Id = c.Id,
            Title = c.Title,
            Description = c.Description,
            Level = c.Level,
            Category = c.Category,
            InstructorId = c.InstructorId,
            Price = c.Price,
            ThumbnailUrl = c.ThumbnailUrl
        }).ToList();

        return Ok(courseDtos);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetCourse(Guid id)
    {
        var course = await _context.Courses
            .Include(c => c.Lessons)
            .FirstOrDefaultAsync(c => c.Id == id);
            
        if (course == null) return NotFound();

        var courseDto = new SharedDTOs.CourseDto
        {
            Id = course.Id,
            Title = course.Title,
            Description = course.Description,
            Level = course.Level,
            Category = course.Category,
            InstructorId = course.InstructorId,
            Price = course.Price,
            ThumbnailUrl = course.ThumbnailUrl
        };
        return Ok(courseDto);
    }

    [HttpGet("{id}/detail")]
    public async Task<IActionResult> GetCourseDetail(Guid id)
    {
        var cacheKey = $"courses:detail:{id}";
        if (_cache != null)
        {
            var cached = await _cache.GetStringAsync(cacheKey);
            if (!string.IsNullOrWhiteSpace(cached))
            {
                var fromCache = JsonSerializer.Deserialize<SharedDTOs.CourseDetailDto>(cached, JsonOptions);
                if (fromCache != null) return Ok(fromCache);
            }
        }

        var course = await _context.Courses
            .Include(c => c.Lessons)
            .FirstOrDefaultAsync(c => c.Id == id);
            
        if (course == null) return NotFound();

        var detailDto = new SharedDTOs.CourseDetailDto
        {
            Id = course.Id,
            Title = course.Title,
            Description = course.Description,
            Level = course.Level,
            Category = course.Category,
            InstructorId = course.InstructorId,
            Price = course.Price,
            ThumbnailUrl = course.ThumbnailUrl,
            Lessons = course.Lessons
                .OrderBy(l => l.Order)
                .Select(l => new SharedDTOs.LessonDto
                {
                    Id = l.Id,
                    Title = l.Title,
                    Content = l.Content,
                    CourseId = l.CourseId,
                    Order = l.Order,
                    ContentUrl = l.ContentUrl,
                    ContentType = l.ContentType
                })
                .ToList()
        };

        if (_cache != null)
        {
            await _cache.SetStringAsync(
                cacheKey,
                JsonSerializer.Serialize(detailDto, JsonOptions),
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
                }
            );
        }
        return Ok(detailDto);
    }

    [HttpGet("{id}/lessons/count")]
    public async Task<IActionResult> GetLessonCount(Guid id)
    {
        var count = await _context.Lessons.CountAsync(l => l.CourseId == id);
        return Ok(new { Count = count });
    }

    [Authorize(Roles = "Admin,Teacher")]
    [HttpPost]
    public async Task<IActionResult> CreateCourse([FromBody] CreateCourseRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized("Không xác định được người dùng.");

        var course = new CourseEntity
        {
            Title = request.Title,
            Description = request.Description,
            Level = request.Level,
            Category = request.Category,
            InstructorId = userId.Value,
            Price = request.Price,
            ThumbnailUrl = string.IsNullOrWhiteSpace(request.ThumbnailUrl) ? null : request.ThumbnailUrl.Trim()
        };

        _context.Courses.Add(course);
        await _context.SaveChangesAsync();

        if (_cache != null)
        {
            await _cache.RemoveAsync("courses:all");
        }

        var courseDto = new SharedDTOs.CourseDto
        {
            Id = course.Id,
            Title = course.Title,
            Description = course.Description,
            Level = course.Level,
            Category = course.Category,
            InstructorId = course.InstructorId,
            Price = course.Price,
            ThumbnailUrl = course.ThumbnailUrl
        };

        return CreatedAtAction(nameof(GetCourse), new { id = course.Id }, courseDto);
    }

    [Authorize(Roles = "Admin,Teacher")]
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateCourse(Guid id, [FromBody] CreateCourseRequest request)
    {
        var course = await _context.Courses.FindAsync(id);
        if (course == null) return NotFound();

        var role = GetCurrentRole();
        var userId = GetCurrentUserId();
        if (role == "teacher" && (userId == null || course.InstructorId != userId.Value))
            return Forbid();

        course.Title = request.Title;
        course.Description = request.Description;
        course.Level = request.Level;
        course.Category = request.Category;
        course.Price = request.Price;
        course.ThumbnailUrl = string.IsNullOrWhiteSpace(request.ThumbnailUrl) ? null : request.ThumbnailUrl.Trim();

        await _context.SaveChangesAsync();

        if (_cache != null)
        {
            await _cache.RemoveAsync("courses:all");
            await _cache.RemoveAsync($"courses:detail:{id}");
        }

        var courseDto = new SharedDTOs.CourseDto
        {
            Id = course.Id,
            Title = course.Title,
            Description = course.Description,
            Level = course.Level,
            Category = course.Category,
            InstructorId = course.InstructorId,
            Price = course.Price,
            ThumbnailUrl = course.ThumbnailUrl
        };

        return Ok(courseDto);
    }

    [HttpPost("{courseId}/lessons")]
    public async Task<IActionResult> AddLesson(Guid courseId, [FromBody] LessonDto lessonDto)
    {
        var course = await _context.Courses.FindAsync(courseId);
        if (course == null) return NotFound("Course not found");

        var lesson = new Lesson
        {
            Title = lessonDto.Title,
            Content = lessonDto.Content,
            CourseId = courseId,
            Order = lessonDto.Order
        };

        _context.Lessons.Add(lesson);
        await _context.SaveChangesAsync();

        if (_cache != null)
        {
            await _cache.RemoveAsync("courses:all");
            await _cache.RemoveAsync($"courses:detail:{courseId}");
        }
        
        lessonDto.Id = lesson.Id;

        return Ok(lessonDto);
    }

    [Authorize(Roles = "Admin,Teacher")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteCourse(Guid id)
    {
        var course = await _context.Courses.FindAsync(id);
        if (course == null) return NotFound();

        var role = GetCurrentRole();
        var userId = GetCurrentUserId();
        if (role == "teacher" && (userId == null || course.InstructorId != userId.Value))
            return Forbid();

        _context.Courses.Remove(course);
        await _context.SaveChangesAsync();

        if (_cache != null)
        {
            await _cache.RemoveAsync("courses:all");
            await _cache.RemoveAsync($"courses:detail:{id}");
        }
        return NoContent();
    }

    [HttpPost("{id}/enroll")]
    public async Task<IActionResult> EnrollCourse(Guid id, [FromBody] Guid userId)
    {
        var course = await _context.Courses.FindAsync(id);
        if (course == null) return NotFound("Course not found");

        // Logic to enroll user in DB would go here (e.g. UserCourse table)
        // For now, we focus on publishing the event

        var enrollmentEvent = new CourseEnrolledEvent(
            EnrollmentId: Guid.NewGuid(),
            UserId: userId,
            CourseId: id,
            Timestamp: DateTime.UtcNow
        );

        await _eventPublisher.PublishAsync("course-enrolled", enrollmentEvent);

        return Ok(new { Message = "Enrolled successfully", CourseId = id });
    }

}
