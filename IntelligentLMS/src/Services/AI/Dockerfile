FROM python:3.10-slim

WORKDIR /app

# IMPORTANT:
# - CI (GitHub Actions) build context: `./IntelligentLMS`
# - docker-compose nên dùng cùng context để khỏi lệch đường dẫn
COPY src/Services/AI/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy source của AI service vào image
COPY src/Services/AI/ ./

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]