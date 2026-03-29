using IntelligentLMS.Course.Data;
using IntelligentLMS.Course.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Json.Serialization;
using IntelligentLMS.Course.Infrastructure.Messaging;
using IntelligentLMS.Course.Application.Interfaces;
using IntelligentLMS.Shared.Events;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "intelligent-lms",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "intelligent-lms",
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? "super_secret_key_for_intelligent_lms_dev_12345"))
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddSingleton<VnpayService>();
builder.Services.AddHttpClient<IProgressServiceClient, ProgressServiceClient>();

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
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Database initialization and seeding
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CourseDbContext>();
    db.Database.EnsureCreated();
    // DB cũ (EnsureCreated không thêm cột): bổ sung ảnh bìa khóa học
    try
    {
        await db.Database.ExecuteSqlRawAsync(
            """ALTER TABLE "Courses" ADD COLUMN IF NOT EXISTS "ThumbnailUrl" text;""");
    }
    catch
    {
        /* ignore nếu provider khác / đã có cột */
    }

    await DbInitializer.SeedAsync(db);
}

app.Run();
