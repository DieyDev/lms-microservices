from fastapi import APIRouter
from app.services.dropout_predictor import DropoutPredictorService
from app.schemas.user_progress import DropoutRiskResponse

router = APIRouter(prefix="/ai/dropout", tags=["Dropout Prediction"])

@router.get("/{userId}", response_model=DropoutRiskResponse)
def get_dropout_risk(userId: str):
    risk_data = DropoutPredictorService.evaluate_risk(userId)
    return DropoutRiskResponse(
        user_id=userId,
        risk_level=risk_data.get("risk", "UNKNOWN"),
        probability=risk_data.get("prob", 0.0),
        factors=risk_data.get("factors", {}),
        reasons=risk_data.get("reasons", [])
    )
