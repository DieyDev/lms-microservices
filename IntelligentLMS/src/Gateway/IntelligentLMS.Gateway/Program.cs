using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// 1) CORS: Vite dev + Vercel / production (Cors:AllowedOrigins, phân tách bằng dấu phẩy).
// Dev local: cho phép mọi port của localhost/127.0.0.1 (Vite đôi khi nhảy port 5174, 5175...).
var configured = builder.Configuration["Cors:AllowedOrigins"]?
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .Where(s => !string.IsNullOrWhiteSpace(s))
    ?? Enumerable.Empty<string>();
var corsOrigins = configured.Distinct(StringComparer.Ordinal).ToArray();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy
            .SetIsOriginAllowed(origin =>
            {
                if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
                if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) return false;

                // Allow any localhost port for dev.
                if (uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
                    uri.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase))
                    return true;

                // Allow configured production origins explicitly.
                return corsOrigins.Contains($"{uri.Scheme}://{uri.Host}{(uri.IsDefaultPort ? "" : $":{uri.Port}")}", StringComparer.OrdinalIgnoreCase);
            })
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// 2) Reverse proxy
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

// 3) Auth
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Gateway chỉ lắng nghe HTTP (localhost/Docker); tránh lỗi metadata HTTPS khi validate JWT
        options.RequireHttpsMetadata = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Authenticated", policy => policy.RequireAuthenticatedUser());
});

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Kestrel listen 8080
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenAnyIP(8080);
});

var app = builder.Build();

// Dùng CORS TRƯỚC auth/proxy
app.UseCors("AllowFrontend");

app.UseSwagger();
app.UseSwaggerUI();

app.MapGet("/test", () => "Gateway working!");

// Demo-only mock endpoints so Vercel can show courses
// even when Course service isn't deployed.
var demoCourses = new[]
{
    new
    {
        id = "demo-course-1",
        title = "React cơ bản cho người mới",
        description = "Học React từ nền tảng: components, props/state, hooks, routing.",
        level = "Beginner",
        category = "Frontend",
        instructorId = "demo-instructor",
        price = 0,
        thumbnailUrl = (string?)null
    },
    new
    {
        id = "demo-course-2",
        title = "ASP.NET Core Web API (Microservices)",
        description = "Xây API theo kiến trúc microservices, gateway, auth, docker deploy.",
        level = "Intermediate",
        category = "Backend",
        instructorId = "demo-instructor",
        price = 199000,
        thumbnailUrl = (string?)null
    },
    new
    {
        id = "demo-course-3",
        title = "SQL căn bản & tối ưu truy vấn",
        description = "SELECT/JOIN/INDEX và các mẹo tối ưu để chạy nhanh, đúng.",
        level = "Beginner",
        category = "Database",
        instructorId = "demo-instructor",
        price = 99000,
        thumbnailUrl = (string?)null
    }
};

app.MapGet("/courses", () => Results.Json(demoCourses));

app.MapGet("/courses/{courseId}/detail", (string courseId) =>
{
    var c = demoCourses.FirstOrDefault(x => string.Equals(x.id, courseId, StringComparison.OrdinalIgnoreCase));
    if (c is null) return Results.NotFound();
    return Results.Json(new
    {
        c.id,
        c.title,
        c.description,
        c.level,
        c.category,
        c.instructorId,
        c.price,
        c.thumbnailUrl,
        lessons = Array.Empty<object>()
    });
});

app.UseAuthentication();
app.UseAuthorization();

app.MapReverseProxy();

app.Run();