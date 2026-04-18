# Intelligent LMS

A comprehensive Learning Management System built with .NET 8 Microservices and Python AI.

## Architecture

- **Gateway**: .NET 8 YARP Reverse Proxy (Port 5000)
- **Auth Service**: .NET 8 (Port 5001)
- **User Service**: .NET 8 (Port 5002)
- **Course Service**: .NET 8 (Port 5003)
- **Progress Service**: .NET 8 (Port 5004)
- **AI Advisor**: Python FastAPI (Port 8000)

## Prerequisites

- .NET 8 SDK
- Docker & Docker Compose
- Python 3.9+ (optional, if running locally without Docker)

## How to Run

### Option 1: Docker Compose (Recommended)

```bash
docker-compose up --build
```

### Payment configuration (VNPay / MoMo)

Thanh toán được xử lý bởi **Course service** và expose qua Gateway:

- VNPay:
  - `POST http://localhost:5000/payments/vnpay/create`
  - `GET  http://localhost:5000/payments/vnpay/return`
  - `GET  http://localhost:5000/payments/vnpay/ipn`
- MoMo:
  - `POST http://localhost:5000/payments/momo/create`
  - `GET  http://localhost:5000/payments/momo/return`
  - `POST http://localhost:5000/payments/momo/ipn`

Khi chạy bằng Docker Compose, `course-service` đọc cấu hình MoMo từ các biến môi trường sau (xem `docker-compose.yml`):

- `MOMO_PARTNER_CODE`
- `MOMO_ACCESS_KEY`
- `MOMO_SECRET_KEY`
- (tuỳ chọn) `MOMO_ENDPOINT` (mặc định sandbox)
- (tuỳ chọn) `MOMO_REQUEST_TYPE` (mặc định `captureWallet`)
- (tuỳ chọn) `MOMO_REDIRECT_URL` (mặc định `http://localhost:5000/payments/momo/return`)
- (tuỳ chọn) `MOMO_IPN_URL` (mặc định `http://localhost:5000/payments/momo/ipn`)

Gợi ý local: bạn có thể đặt các biến này trong file `IntelligentLMS/.env` để Docker Compose tự nạp. **Không commit secrets** lên git.

### Option 2: Local Development

1. Start Infrastructure:
   ```bash
   docker-compose up postgres -d
   ```

2. Run Services (in separate terminals):
   ```bash
   cd src/Gateway/IntelligentLMS.Gateway && dotnet run
   cd src/Services/Auth/IntelligentLMS.Auth && dotnet run
   cd src/Services/User/IntelligentLMS.User && dotnet run
   cd src/Services/Course/IntelligentLMS.Course && dotnet run
   cd src/Services/Progress/IntelligentLMS.Progress && dotnet run
   cd src/Services/AI && uvicorn main:app --reload
   ```

## API Endpoints (Sample)

- **Auth**: `POST http://localhost:5000/auth/login`
- **Courses**: `GET http://localhost:5000/courses`
- **Recommendation**: `GET http://localhost:5000/progress/{userId}/recommendation`

## Project Structure

- `src/Gateway`: API Gateway
- `src/Services`: Microservices (Auth, User, Course, Progress, AI)
- `src/Shared`: Shared DTOs and Logic
