"""
Single source of truth for feature engineering.

The training script (ml/src/train_model.py) and the live inference service
(app/services/risk_service.py) both import FEATURE_NAMES and
build_feature_row from here, so what the model was trained on is exactly
what it sees at prediction time.
"""

FEATURE_NAMES = [
    "age",
    "is_male",
    "num_active_conditions",
    "num_visits_last_year",
    "num_prescriptions",
    "abnormal_lab_ratio",
    "has_diabetes",
    "has_hypertension",
    "has_heart_disease",
    "latest_glucose",
    "latest_systolic_bp",
]


def build_feature_row(record: dict) -> dict:
    """
    `record` is a plain dict describing one patient's aggregated clinical
    picture (see risk_service.summarize_patient_for_model for the shape).
    Returns a dict keyed exactly by FEATURE_NAMES, in a form XGBoost can
    consume (all numeric).
    """
    conditions = {c.lower() for c in record.get("condition_names", [])}

    return {
        "age": float(record.get("age", 0)),
        "is_male": 1.0 if str(record.get("gender", "")).lower().startswith("m") else 0.0,
        "num_active_conditions": float(record.get("num_active_conditions", 0)),
        "num_visits_last_year": float(record.get("num_visits_last_year", 0)),
        "num_prescriptions": float(record.get("num_prescriptions", 0)),
        "abnormal_lab_ratio": float(record.get("abnormal_lab_ratio", 0.0)),
        "has_diabetes": 1.0 if any("diabetes" in c for c in conditions) else 0.0,
        "has_hypertension": 1.0 if any("hypertension" in c for c in conditions) else 0.0,
        "has_heart_disease": 1.0 if any(
            "heart" in c or "cardiac" in c or "coronary" in c for c in conditions
        ) else 0.0,
        "latest_glucose": float(record.get("latest_glucose", 90.0)),
        "latest_systolic_bp": float(record.get("latest_systolic_bp", 120.0)),
    }
