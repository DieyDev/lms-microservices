using IntelligentLMS.Progress.Data;
using IntelligentLMS.Progress.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.StackExchangeRedis;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpClient<IAiAdvisorClient, AiAdvisorClient>();
builder.Services.AddHttpClient<ICourseServiceClient, CourseServiceClient>();

builder.Services.AddDbContext<ProgressDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Redis distributed cache (optional)
var redisConn = builder.Configuration["Redis:ConnectionString"];
if (!string.IsNullOrWhiteSpace(redisConn))
{
    builder.Services.AddSingleton<IDistributedCache>(_ =>
        new RedisCache(new RedisCacheOptions
        {
            Configuration = redisConn,
            InstanceName = "IntelligentLMS:"
        }));
}

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

// Database initialization and seeding
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ProgressDbContext>();
    db.Database.EnsureCreated();
    await DbInitializer.SeedAsync(db);
}

app.Run();
