namespace IntelligentLMS.Shared.DTOs.Progress;

public class ProgressDto
{
    public Guid UserId { get; set; }
    public Guid LessonId { get; set; }
    public Guid CourseId { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }
}
