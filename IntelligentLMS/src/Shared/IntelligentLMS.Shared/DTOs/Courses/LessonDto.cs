namespace IntelligentLMS.Shared.DTOs.Courses;

public class LessonDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public Guid CourseId { get; set; }
    public int Order { get; set; }
    public string ContentUrl { get; set; } = string.Empty;
    public string ContentType { get; set; } = "Video";
}
