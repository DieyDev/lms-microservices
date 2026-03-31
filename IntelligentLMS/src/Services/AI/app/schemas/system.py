from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str
    version: str

class MetricsResponse(BaseModel):
    uptime_seconds: float
    kafka_events_processed: int
    cache_status: dict[str, str]
