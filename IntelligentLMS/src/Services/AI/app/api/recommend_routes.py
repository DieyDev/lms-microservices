from fastapi import APIRouter
from app.services.recommender import RecommenderService
from app.schemas.course import CourseRecommendationResponse

router = APIRouter(prefix="/ai/recommend", tags=["Recommendation"])

@router.get("/{userId}", response_model=CourseRecommendationResponse)
def get_recommendations(userId: str):
    recommended_courses = RecommenderService.get_recommendations(userId)
    return CourseRecommendationResponse(
        user_id=userId,
        recommended_courses=recommended_courses
    )
