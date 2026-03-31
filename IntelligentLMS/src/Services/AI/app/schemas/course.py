from pydantic import BaseModel
from typing import Optional

class CourseBase(BaseModel):
    course_id: str
    category: Optional[str] = "General"
    difficulty: int = 1  # 1 = Beginner, 2 = Intermediate, 3 = Advanced
    rating: float = 0.0
    popularity: int = 0
    prerequisite_course_id: Optional[str] = None

class CourseRecommendationResponse(BaseModel):
    user_id: str
    recommended_courses: list[str]

class LearningPathResponse(BaseModel):
    goal_course_id: str
    path: list[str]
    message: str
