using System.ComponentModel.DataAnnotations;

namespace IntelligentLMS.Course.Entities;

public class Course
{
    public Guid Id { get; set; } = Guid.NewGuid();
    [Required]
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Level { get; set; } = "Beginner"; // Beginner, Intermediate, Advanced
    public string Category { get; set; } = string.Empty;
    public Guid InstructorId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public decimal Price { get; set; } = 0m;

    /// <summary>URL ảnh bìa khóa học (https hoặc data URL); null = dùng ảnh mặc định phía client.</summary>
    public string? ThumbnailUrl { get; set; }

    public List<Lesson> Lessons { get; set; } = new();
}

public class Lesson
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CourseId { get; set; }
    [Required]
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public int Order { get; set; }
    public string ContentUrl { get; set; } = string.Empty; // URL to video or document
    public string ContentType { get; set; } = "Video";
}
