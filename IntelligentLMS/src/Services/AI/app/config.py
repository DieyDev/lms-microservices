import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
    KAFKA_GROUP_ID: str = os.getenv("KAFKA_GROUP_ID", "ai-service-group")
    
    # Topics to consume
    TOPIC_USER_REGISTERED: str = "user-registered"
    TOPIC_COURSE_ENROLLED: str = "course-enrolled"
    TOPIC_LESSON_COMPLETED: str = "lesson-completed"
    TOPIC_PROGRESS_UPDATED: str = "progress-updated"
    TOPIC_COURSE_RATED: str = "course-rated"
    
    # Data Storage
    DATA_DIR: str = os.path.join(os.path.dirname(__file__), "data_storage")
    
    INTERACTIONS_CSV: str = os.path.join(DATA_DIR, "interactions.csv")
    COURSES_CSV: str = os.path.join(DATA_DIR, "courses.csv")
    PROGRESS_CSV: str = os.path.join(DATA_DIR, "progress.csv")
    
    # ML Models path
    MODELS_DIR: str = os.path.join(os.path.dirname(__file__), "ml_storage")
    
    RECOMMENDATION_MODEL_PATH: str = os.path.join(MODELS_DIR, "recommender.pkl")
    DROPOUT_MODEL_PATH: str = os.path.join(MODELS_DIR, "dropout.pkl")
    
    # Cache & Logs
    DATA_CACHE_TTL: int = 3600 # seconds (if needed)
    KAFKA_BATCH_SIZE: int = 10
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"

settings = Settings()

# Ensure directories exist
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.MODELS_DIR, exist_ok=True)
