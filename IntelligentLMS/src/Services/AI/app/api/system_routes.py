import time
from fastapi import APIRouter
from app.schemas.system import HealthResponse, MetricsResponse
from app.data.dataset_builder import get_interactions_df

router = APIRouter(tags=["System"])

START_TIME = time.time()
PROCESSED_EVENTS_MOCK_COUNTER = 0 # Normally attached to DataCache or Consumer directly, kept simple here

@router.get("/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(status="ok", version="1.1.0-refactored")

@router.get("/metrics", response_model=MetricsResponse)
def metrics_check():
    uptime = time.time() - START_TIME
    
    # Just a small status string representing active memory tables
    interactions_size = len(get_interactions_df())
    cache_status = {
        "interactions_records": str(interactions_size),
        "status": "Healthy"
    }
    
    return MetricsResponse(
        uptime_seconds=uptime,
        kafka_events_processed=PROCESSED_EVENTS_MOCK_COUNTER,
        cache_status=cache_status
    )
