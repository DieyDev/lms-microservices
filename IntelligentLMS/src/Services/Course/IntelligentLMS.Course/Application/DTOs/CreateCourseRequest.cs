namespace IntelligentLMS.Course.Application.DTOs;

public class CreateCourseRequest
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Level { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal Price { get; set; } = 0m;
    public string? ThumbnailUrl { get; set; }
}
