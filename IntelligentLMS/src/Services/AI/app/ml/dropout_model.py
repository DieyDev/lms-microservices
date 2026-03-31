import os
import joblib
import pandas as pd

from app.config import settings
from app.data.dataset_builder import get_progress_df
from app.utils.feature_engineering import prepare_dropout_features
from app.utils.logger import logger

def extract_reasons(progress: float, days_inactive: float) -> list[str]:
    reasons = []
    if days_inactive > 14:
        reasons.append("High inactivity detected (over 14 days)")
    elif days_inactive > 7:
        reasons.append("Moderate inactivity detected (over 7 days)")
        
    if progress < 30:
        reasons.append("Low progress indicating disengagement")
    elif progress < 50 and days_inactive > 7:
        reasons.append("Progress stalling")
        
    return reasons

def predict_dropout_risk(user_id: str) -> dict:
    """
    Loads saved Scikit-Learn Random Forest model if available.
    Otherwise uses a fallback rule-based classification.
    Returns: { "risk": LOW|MEDIUM|HIGH, "prob": float, "factors": dict, "reasons": list }
    """
    df = get_progress_df()
    user_prog = df[df['user_id'] == user_id]
    
    if user_prog.empty:
        return {
            "risk": "MEDIUM",
            "prob": 0.5,
            "factors": {"unknown_user": 1.0},
            "reasons": ["No historical data for user"]
        }
    
    # Calculate features
    try:
        feats_df = prepare_dropout_features(user_prog)
        latest_feat = feats_df.iloc[-1]
    except Exception as e:
        logger.error(f"Error preparing dropout features: {e}")
        return {
            "risk": "UNKNOWN",
            "prob": 0.0,
            "factors": {},
            "reasons": ["Feature engineering failed"]
        }
    
    model_path = settings.DROPOUT_MODEL_PATH
    risk_labels = {0: "LOW", 1: "MEDIUM", 2: "HIGH"}
    progress = latest_feat.get('progress_percentage', 0.0)
    days_inactive = latest_feat.get('days_since_last_login', 0.0)
    
    # Analyze explainability
    reasons = extract_reasons(progress, days_inactive)
    
    if os.path.exists(model_path):
        try:
            model = joblib.load(model_path)
            # Ensure columns exist in right order
            cols = ['progress_percentage', 'days_since_last_login', 'lessons_completed', 'login_frequency']
            for col in cols:
                if col not in feats_df.columns:
                    feats_df[col] = 0.0
            X = feats_df[cols]
            
            prediction_idx = model.predict(X)[0]
            prob = model.predict_proba(X)[0]
            
            return {
                "risk": risk_labels.get(prediction_idx, "UNKNOWN"),
                "prob": float(prob.max()),
                "factors": {
                    "progress": progress,
                    "days_inactive": days_inactive
                },
                "reasons": reasons
            }
        except Exception as e:
            logger.warning(f"Error loading model: {e}. Falling back to rule-based.")
            
    # Fallback to Rule-based system
    score = 0.0
    if progress < 30: score += 0.4
    if days_inactive > 14: score += 0.6
    elif days_inactive > 7: score += 0.3
    
    risk = "LOW"
    if score >= 0.7: risk = "HIGH"
    elif score >= 0.4: risk = "MEDIUM"
        
    return {
        "risk": risk,
        "prob": score,
        "factors": {
            "progress_percentage": progress,
            "days_inactive": days_inactive
        },
        "reasons": reasons
    }
