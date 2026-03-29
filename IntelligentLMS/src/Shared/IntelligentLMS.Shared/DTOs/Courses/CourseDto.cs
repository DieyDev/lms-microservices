namespace IntelligentLMS.Shared.DTOs.Courses;

public class CourseDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Level { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public Guid InstructorId { get; set; }
    public decimal Price { get; set; }
    public string? ThumbnailUrl { get; set; }
}
