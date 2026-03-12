using System.Text.Json;

namespace IntelligentLMS.Progress.Services;

public interface ICourseServiceClient
{
    Task<int> GetLessonCountAsync(Guid courseId);
}

public class CourseServiceClient : ICourseServiceClient
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public CourseServiceClient(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        var baseUrl = configuration["CourseServiceUrl"] ?? "http://localhost:5003";
        _httpClient.BaseAddress = new Uri(baseUrl);
    }

    public async Task<int> GetLessonCountAsync(Guid courseId)
    {
        try
        {
            var response = await _httpClient.GetAsync($"/api/courses/{courseId}/lessons/count");
            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync();
                var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("count", out var countProp))
                    return countProp.GetInt32();
            }
        }
        catch { /* Course service offline */ }
        return 0;
    }
}
