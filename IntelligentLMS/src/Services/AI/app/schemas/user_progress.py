from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserProgressBase(BaseModel):
    user_id: str
    course_id: str
    progress_percentage: float = 0.0
    lessons_completed: int = 0
    last_login: Optional[str] = None

class DropoutRiskResponse(BaseModel):
    user_id: str
    risk_level: str  # LOW, MEDIUM, HIGH
    probability: float
    factors: dict[str, float]
    reasons: list[str] = []
