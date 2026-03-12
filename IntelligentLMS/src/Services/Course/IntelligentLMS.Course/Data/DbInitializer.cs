using IntelligentLMS.Course.Entities;
using Microsoft.EntityFrameworkCore;
using IntelligentLMS.Shared.Data;
using CourseEntity = IntelligentLMS.Course.Entities.Course;

namespace IntelligentLMS.Course.Data;

/// <summary>
/// Database initializer for Course Service.
/// Seeds courses, lessons, and categories for development.
/// </summary>
public static class DbInitializer
{
    /// <summary>
    /// Seeds the database with initial data.
    /// Idempotent - safe to call multiple times.
    /// </summary>
    public static async Task SeedAsync(CourseDbContext context)
    {
        await SeedCoursesAsync(context);
        await context.SaveChangesAsync();
    }

    private static async Task SeedCoursesAsync(CourseDbContext context)
    {
        if (await context.Courses.AnyAsync())
        {
            return; // Already seeded
        }

        var instructorId = SeedConstants.InstructorUserId;
        var courses = new List<CourseEntity>();

        // Course 1: .NET Microservices Architecture
        var course1 = new CourseEntity
        {
            Id = SeedConstants.Course1Id,
            Title = ".NET Microservices Architecture",
            Description = "Master building scalable microservices using .NET 8, Docker, and Kubernetes. Learn service communication patterns, API Gateway, and distributed system design.",
            Level = "Advanced",
            Category = "Backend Development",
            InstructorId = instructorId,
            CreatedAt = DateTime.UtcNow.AddDays(-60),
            Lessons = new List<Lesson>
            {
                new Lesson
                {
                    Id = SeedConstants.Course1Lesson1Id,
                    CourseId = SeedConstants.Course1Id,
                    Title = "Introduction to Microservices",
                    Content = "Learn the fundamentals of microservices architecture, its benefits, and when to use it. Understand the differences between monolithic and microservices approaches.",
                    Order = 1,
                    ContentUrl = "https://www.youtube.com/watch?v=3Y8aTQm3KZ0",
                    ContentType = "Video"
                },
                new Lesson
                {
                    Id = SeedConstants.Course1Lesson2Id,
                    CourseId = SeedConstants.Course1Id,
                    Title = "Setting Up .NET 8 Web API",
                    Content = "Create your first .NET 8 Web API project. Configure dependency injection, middleware pipeline, and API controllers.",
                    Order = 2,
                    ContentUrl = "https://www.youtube.com/watch?v=fmvcAzHpsk8",
                    ContentType = "Video"
                },
                new Lesson
                {
                    Id = SeedConstants.Course1Lesson3Id,
                    CourseId = SeedConstants.Course1Id,
                    Title = "Entity Framework Core with PostgreSQL",
                    Content = "Configure Entity Framework Core for PostgreSQL. Learn migrations, DbContext setup, and database-first vs code-first approaches.",
                    Order = 3,
                    ContentUrl = "https://www.youtube.com/watch?v=qkJ9keBmQWo",
                    ContentType = "Video"
                },
                new Lesson
                {
                    Id = SeedConstants.Course1Lesson4Id,
                    CourseId = SeedConstants.Course1Id,
                    Title = "API Gateway with YARP",
                    Content = "Implement API Gateway using YARP (Yet Another Reverse Proxy). Configure routing, load balancing, and request transformation.",
                    Order = 4,
                    ContentUrl = "https://www.youtube.com/watch?v=Q3B8e6pM7JQ",
                    ContentType = "Video"
                },
                new Lesson
                {
                    Id = SeedConstants.Course1Lesson5Id,
                    CourseId = SeedConstants.Course1Id,
                    Title = "Service Communication Patterns",
                    Content = "Explore synchronous (HTTP/REST) and asynchronous (Message Queue) communication patterns. Implement gRPC for inter-service calls.",
                    Order = 5,
                    ContentUrl = "https://www.youtube.com/watch?v=Jv7l6n1M0tU",
                    ContentType = "Video"
                },
                new Lesson
                {
                    Id = SeedConstants.Course1Lesson6Id,
                    CourseId = SeedConstants.Course1Id,
                    Title = "Docker and Containerization",
                    Content = "Containerize your microservices with Docker. Create Dockerfiles, docker-compose configurations, and multi-stage builds.",
                    Order = 6,
                    ContentUrl = "https://www.youtube.com/watch?v=3c-iBn73dDE",
                    ContentType = "Video"
                }
            }
        };

        // Course 2: React + TypeScript Frontend Development
        var course2 = new CourseEntity
        {
            Id = SeedConstants.Course2Id,
            Title = "React + TypeScript Frontend Development",
            Description = "Build modern, type-safe React applications with TypeScript. Learn hooks, state management, routing, and integration with REST APIs.",
            Level = "Intermediate",
            Category = "Frontend Development",
            InstructorId = instructorId,
            CreatedAt = DateTime.UtcNow.AddDays(-50),
            Lessons = new List<Lesson>
            {
                new Lesson
                {
                    Id = SeedConstants.Course2Lesson1Id,
                    CourseId = SeedConstants.Course2Id,
                    Title = "TypeScript Fundamentals",
                    Content = "Master TypeScript basics: types, interfaces, generics, and type inference. Set up a TypeScript React project with Vite.",
                    Order = 1,
                    ContentUrl = "https://www.youtube.com/watch?v=BCg4U1FzODs",
                    ContentType = "Video"
                },
                new Lesson
                {
                    Id = SeedConstants.Course2Lesson2Id,
                    CourseId = SeedConstants.Course2Id,
                    Title = "React Hooks Deep Dive",
                    Content = "Understand useState, useEffect, useContext, and custom hooks. Learn when and how to use each hook effectively.",
                    Order = 2,
                    ContentUrl = "https://www.youtube.com/watch?v=TNhaISOUy6Q",
                    ContentType = "Video"
                },
                new Lesson
                {
                    Id = SeedConstants.Course2Lesson3Id,
                    CourseId = SeedConstants.Course2Id,
                    Title = "React Router and Navigation",
                    Content = "Implement client-side routing with React Router. Create protected routes, nested routes, and programmatic navigation.",
                    Order = 3,
                    ContentUrl = "https://www.youtube.com/watch?v=Ul3y1LXxzdU",
                    ContentType = "Video"
                },
                new Lesson
                {
                    Id = SeedConstants.Course2Lesson4Id,
                    CourseId = SeedConstants.Course2Id,
                    Title = "State Management Patterns",
                    Content = "Explore state management solutions: Context API, Zustand, and Redux Toolkit. Choose the right approach for your application.",
                    Order = 4,
                    ContentUrl = "https://www.youtube.com/watch?v=35lXWvCuM8o",
                    ContentType = "Video"
                },
                new Lesson
                {
                    Id = SeedConstants.Course2Lesson5Id,
                    CourseId = SeedConstants.Course2Id,
                    Title = "API Integration and Error Handling",
                    Content = "Integrate React applications with REST APIs. Implement error handling, loading states, and optimistic updates.",
                    Order = 5,
                    ContentUrl = "https://www.youtube.com/watch?v=ZEKBDXGnDgI",
                    ContentType = "Video"
                }
            }
        };

        // Course 3: Kafka Event-Driven Architecture
        var course3 = new CourseEntity
        {
            Id = SeedConstants.Course3Id,
            Title = "Kafka Event-Driven Architecture",
            Description = "Build event-driven microservices using Apache Kafka. Learn producers, consumers, topics, partitions, and event sourcing patterns.",
            Level = "Advanced",
            Category = "Backend Development",
            InstructorId = instructorId,
            CreatedAt = DateTime.UtcNow.AddDays(-40),
            Lessons = new List<Lesson>
            {
                new Lesson
                {
                    Id = SeedConstants.Course3Lesson1Id,
                    CourseId = SeedConstants.Course3Id,
                    Title = "Kafka Fundamentals",
                    Content = "Introduction to Apache Kafka: brokers, topics, partitions, and replication. Understand the Kafka architecture and use cases.",
                    Order = 1,
                    ContentUrl = "https://example.com/videos/kafka-fundamentals.mp4",
                    ContentType = "Video"
                },
                new Lesson
                {
                    Id = SeedConstants.Course3Lesson2Id,
                    CourseId = SeedConstants.Course3Id,
                    Title = "Kafka Producers in .NET",
                    Content = "Implement Kafka producers using Confluent.Kafka library. Learn serialization, partitioning strategies, and error handling.",
                    Order = 2,
                    ContentUrl = "https://example.com/videos/kafka-producers.mp4",
                    ContentType = "Video"
                },
                new Lesson
                {
                    Id = SeedConstants.Course3Lesson3Id,
                    CourseId = SeedConstants.Course3Id,
                    Title = "Kafka Consumers and Consumer Groups",
                    Content = "Build Kafka consumers with consumer groups. Implement at-least-once and exactly-once delivery semantics.",
                    Order = 3,
                    ContentUrl = "https://example.com/videos/kafka-consumers.mp4",
                    ContentType = "Video"
                },
                new Lesson
                {
                    Id = SeedConstants.Course3Lesson4Id,
                    CourseId = SeedConstants.Course3Id,
                    Title = "Event Sourcing Patterns",
                    Content = "Implement event sourcing with Kafka. Store events as the source of truth and rebuild state from events.",
                    Order = 4,
                    ContentUrl = "https://example.com/videos/event-sourcing.mp4",
                    ContentType = "Video"
                }
            }
        };

        // Course 4: PostgreSQL Database Design
        var course4 = new CourseEntity
        {
            Id = SeedConstants.Course4Id,
            Title = "PostgreSQL Database Design",
            Description = "Master PostgreSQL database design, optimization, and advanced features. Learn indexing, query optimization, and transaction management.",
            Level = "Intermediate",
            Category = "Database",
            InstructorId = instructorId,
            CreatedAt = DateTime.UtcNow.AddDays(-30),
            Lessons = new List<Lesson>
            {
                new Lesson
                {
                    Id = SeedConstants.Course4Lesson1Id,
                    CourseId = SeedConstants.Course4Id,
                    Title = "Database Schema Design",
                    Content = "Design normalized database schemas. Understand relationships, constraints, and best practices for relational databases.",
                    Order = 1,
                    ContentUrl = "https://example.com/videos/schema-design.mp4",
                    ContentType = "Video"
                },
                new Lesson
                {
                    Id = SeedConstants.Course4Lesson2Id,
                    CourseId = SeedConstants.Course4Id,
                    Title = "Indexing Strategies",
                    Content = "Create effective indexes for query performance. Learn B-tree, GIN, GiST indexes and when to use each type.",
                    Order = 2,
                    ContentUrl = "https://example.com/videos/indexing-strategies.mp4",
                    ContentType = "Video"
                },
                new Lesson
                {
                    Id = SeedConstants.Course4Lesson3Id,
                    CourseId = SeedConstants.Course4Id,
                    Title = "Query Optimization",
                    Content = "Analyze and optimize slow queries using EXPLAIN. Learn about query plans, statistics, and performance tuning.",
                    Order = 3,
                    ContentUrl = "https://example.com/videos/query-optimization.mp4",
                    ContentType = "Video"
                },
                new Lesson
                {
                    Id = SeedConstants.Course4Lesson4Id,
                    CourseId = SeedConstants.Course4Id,
                    Title = "Transactions and Concurrency",
                    Content = "Understand ACID properties, transaction isolation levels, and handling concurrent access in PostgreSQL.",
                    Order = 4,
                    ContentUrl = "https://example.com/videos/transactions-concurrency.mp4",
                    ContentType = "Video"
                },
                new Lesson
                {
                    Id = SeedConstants.Course4Lesson5Id,
                    CourseId = SeedConstants.Course4Id,
                    Title = "Advanced PostgreSQL Features",
                    Content = "Explore JSONB, full-text search, arrays, and custom functions. Use PostgreSQL-specific features effectively.",
                    Order = 5,
                    ContentUrl = "https://example.com/videos/postgres-advanced.mp4",
                    ContentType = "Video"
                }
            }
        };

        // Course 5: JWT Authentication & Authorization
        var course5 = new CourseEntity
        {
            Id = SeedConstants.Course5Id,
            Title = "JWT Authentication & Authorization",
            Description = "Implement secure authentication and authorization using JWT tokens. Learn token generation, validation, refresh tokens, and role-based access control.",
            Level = "Intermediate",
            Category = "Security",
            InstructorId = instructorId,
            CreatedAt = DateTime.UtcNow.AddDays(-20),
            Lessons = new List<Lesson>
            {
                new Lesson
                {
                    Id = SeedConstants.Course5Lesson1Id,
                    CourseId = SeedConstants.Course5Id,
                    Title = "JWT Token Basics",
                    Content = "Understand JWT structure: header, payload, and signature. Learn how tokens are generated and validated.",
                    Order = 1,
                    ContentUrl = "https://example.com/videos/jwt-basics.mp4",
                    ContentType = "Video"
                },
                new Lesson
                {
                    Id = SeedConstants.Course5Lesson2Id,
                    CourseId = SeedConstants.Course5Id,
                    Title = "Implementing JWT in .NET",
                    Content = "Configure JWT authentication in ASP.NET Core. Generate tokens, validate requests, and handle token expiration.",
                    Order = 2,
                    ContentUrl = "https://example.com/videos/jwt-dotnet.mp4",
                    ContentType = "Video"
                },
                new Lesson
                {
                    Id = SeedConstants.Course5Lesson3Id,
                    CourseId = SeedConstants.Course5Id,
                    Title = "Refresh Token Strategy",
                    Content = "Implement refresh token mechanism for long-lived sessions. Store tokens securely and handle token rotation.",
                    Order = 3,
                    ContentUrl = "https://example.com/videos/refresh-tokens.mp4",
                    ContentType = "Video"
                },
                new Lesson
                {
                    Id = SeedConstants.Course5Lesson4Id,
                    CourseId = SeedConstants.Course5Id,
                    Title = "Role-Based Access Control (RBAC)",
                    Content = "Implement role-based authorization. Use policies, claims, and custom authorization handlers.",
                    Order = 4,
                    ContentUrl = "https://example.com/videos/rbac.mp4",
                    ContentType = "Video"
                }
            }
        };

        courses.AddRange(new[] { course1, course2, course3, course4, course5 });
        await context.Courses.AddRangeAsync(courses);
    }
}

