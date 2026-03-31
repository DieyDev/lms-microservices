from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class InteractionEvent(BaseModel):
    userId: str
    courseId: str
    progress: Optional[float] = None
    rating: Optional[int] = None
    action: str  # enrolled, completed_lesson, rated, updated_progress
    timestamp: Optional[str] = None
