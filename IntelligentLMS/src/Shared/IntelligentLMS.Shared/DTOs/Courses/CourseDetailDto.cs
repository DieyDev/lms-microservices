namespace IntelligentLMS.Shared.DTOs.Courses;

public class CourseDetailDto : CourseDto
{
    public List<LessonDto> Lessons { get; set; } = new();
}
