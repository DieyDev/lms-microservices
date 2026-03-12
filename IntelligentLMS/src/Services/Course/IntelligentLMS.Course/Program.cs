using IntelligentLMS.Course.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;
using IntelligentLMS.Course.Infrastructure.Messaging;
using IntelligentLMS.Course.Application.Interfaces;
using IntelligentLMS.Shared.Events;



var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<CourseDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Redis distributed cache (optional)
var redisConn = builder.Configuration["Redis:ConnectionString"];
if (!string.IsNullOrWhiteSpace(redisConn))
{
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.Configuration = redisConn;
        options.InstanceName = "IntelligentLMS:";
    });
}

builder.Services.AddSingleton<IEventPublisher, KafkaEventPublisher>();

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
    var db = scope.ServiceProvider.GetRequiredService<CourseDbContext>();
    db.Database.EnsureCreated();
    await DbInitializer.SeedAsync(db);
}

app.Run();
