namespace IntelligentLMS.Shared.DTOs.Progress;

public class CourseProgressResponseDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid CourseId { get; set; }
    public int TotalLessons { get; set; }
    public int CompletedLessons { get; set; }
    public double ProgressPercentage { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<Guid> CompletedLessonIds { get; set; } = new();
}
