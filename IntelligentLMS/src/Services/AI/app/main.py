from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.api import recommend_routes, learning_path_routes, dropout_routes, system_routes
from app.kafka.consumer import start_consumer_thread, stop_consumer_thread
from app.data.data_cache import data_cache
from app.utils.logger import logger

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup Events
    logger.info("Initializing ML AI Service...")
    
    # Init DataCache (forces load from disk to memory)
    _ = data_cache.interactions_df
    
    # Start Kafka Consumer
    consumer_thread = start_consumer_thread()
    
    yield
    
    # Shutdown Events
    logger.info("Shutting down AI Service...")
    stop_consumer_thread()
    if consumer_thread:
        consumer_thread.join(timeout=5)
    
    # Flush memory caches to disk one last time
    data_cache.flush()
    logger.info("Shutdown complete.")

app = FastAPI(title="Intelligent LMS - AI Service", version="1.1.0-refactored", lifespan=lifespan)

# Register routes
app.include_router(recommend_routes.router)
app.include_router(learning_path_routes.router)
app.include_router(dropout_routes.router)
app.include_router(system_routes.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
