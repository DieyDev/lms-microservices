from fastapi import APIRouter
from app.services.learning_path import LearningPathService
from app.schemas.course import LearningPathResponse

router = APIRouter(prefix="/ai/learning-path", tags=["Learning Path"])

@router.get("", response_model=LearningPathResponse)
def get_learning_path(goal_course_id: str):
    path = LearningPathService.generate_path(goal_course_id)
    if not path:
        return LearningPathResponse(
            goal_course_id=goal_course_id,
            path=[],
            message="Goal course not found, prerequisites unavailable, or cyclic dependency detected."
        )
    return LearningPathResponse(
        goal_course_id=goal_course_id,
        path=path,
        message="Topological learning path successfully generated."
    )
