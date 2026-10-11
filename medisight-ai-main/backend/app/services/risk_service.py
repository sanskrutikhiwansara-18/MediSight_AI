"""
Loads the trained XGBoost model (produced by ml/src/train_model.py) and
produces a risk score + SHAP explanation for a given patient.

If no trained model is found on disk, endpoints using this service return
a clear 503 rather than fabricating a score — see api/risk.py.
"""
import json
import os
from datetime import date

import joblib
import numpy as np
import pandas as pd
import shap
from sqlalchemy.orm import Session

from app.ml.features import FEATURE_NAMES, build_feature_row
from app.models.patient import Patient, Condition, Visit, LabResult, Prescription

FEATURE_LABELS = {
    "age": "Age",
    "is_male": "Recorded gender",
    "num_active_conditions": "Active conditions",
    "num_visits_last_year": "Visits in the last year",
    "num_prescriptions": "Prescription count",
    "abnormal_lab_ratio": "Abnormal lab-result ratio",
    "has_diabetes": "Recorded diabetes history",
    "has_hypertension": "Recorded hypertension history",
    "has_heart_disease": "Recorded heart-disease history",
    "latest_glucose": "Latest fasting glucose",
    "latest_systolic_bp": "Latest systolic blood pressure",
}


def explain_contribution(feature: str, value, shap_value: float) -> dict:
    """Turn a SHAP contribution into cautious, patient-readable context.

    Direction describes this model's contribution, not a causal medical effect.
    """
    direction = "raises" if shap_value >= 0 else "lowers"
    label = FEATURE_LABELS.get(feature, feature.replace("_", " ").title())
    magnitude = "more" if abs(shap_value) >= 0.25 else "some"
    if abs(shap_value) < 0.05:
        magnitude = "little"
    return {
        "feature": feature,
        "label": label,
        "value": value,
        "shap_value": float(shap_value),
        "direction": direction,
        "explanation": (
            f"{label} is associated with {magnitude} influence on this model's "
            f"score and {direction} it for this prediction. This is a model "
            "association, not proof of cause."
        ),
    }


MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "ml", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "risk_model.joblib")
METADATA_PATH = os.path.join(MODEL_DIR, "model_metadata.json")

RISK_LEVEL_BANDS = [
    (0.66, "HIGH"),
    (0.33, "MODERATE"),
    (0.0, "LOW"),
]


def risk_level_for_score(score: float) -> str:
    for threshold, label in RISK_LEVEL_BANDS:
        if score >= threshold:
            return label
    return "LOW"


class RiskModelUnavailable(Exception):
    pass


class InsufficientClinicalData(Exception):
    """Raised when required observed measurements are absent for live scoring."""
    pass


class RiskService:
    _model = None
    _explainer = None
    _metadata = None

    @classmethod
    def _load(cls):
        if cls._model is not None:
            return
        if not os.path.exists(MODEL_PATH):
            raise RiskModelUnavailable(
                "No trained model found. Run `python -m ml.src.train_model_synthea` first."
            )
        cls._model = joblib.load(MODEL_PATH)
        cls._explainer = shap.TreeExplainer(cls._model)
        with open(METADATA_PATH) as f:
            cls._metadata = json.load(f)

    @classmethod
    def model_version(cls) -> str:
        cls._load()
        return cls._metadata.get("version", "unknown")

    @staticmethod
    def summarize_patient_for_model(db: Session, patient: Patient) -> dict:
        """Pull a patient's clinical data and reduce it to model-ready fields."""
        conditions = db.query(Condition).filter(
            Condition.patient_id == patient.id, Condition.active.is_(True)
        ).all()
        one_year_ago = date.today().replace(year=date.today().year - 1)
        visits_last_year = db.query(Visit).filter(
            Visit.patient_id == patient.id, Visit.visit_date >= one_year_ago
        ).count()
        labs = db.query(LabResult).filter(LabResult.patient_id == patient.id).all()
        prescriptions = db.query(Prescription).filter(
            Prescription.patient_id == patient.id
        ).count()

        abnormal_ratio = (
            sum(1 for l in labs if l.abnormal) / len(labs) if labs else 0.0
        )

        def latest_value(test_name: str):
            matches = [l for l in labs if l.test_name.strip().casefold() == test_name.casefold()]
            if not matches:
                return None
            return sorted(matches, key=lambda l: l.result_date)[-1].value

        return {
            "age": patient.age,
            "gender": patient.gender,
            "num_active_conditions": len(conditions),
            "num_visits_last_year": visits_last_year,
            "num_prescriptions": prescriptions,
            "abnormal_lab_ratio": abnormal_ratio,
            "condition_names": [c.name for c in conditions],
            "latest_glucose": latest_value("Fasting Glucose"),
            "latest_systolic_bp": latest_value("Systolic BP"),
        }

    @classmethod
    def predict(cls, db: Session, patient: Patient) -> dict:
        cls._load()

        record = cls.summarize_patient_for_model(db, patient)
        # Never silently substitute defaults for required live measurements.
        missing = []
        if record.get("latest_glucose") is None:
            missing.append("Fasting Glucose")
        if record.get("latest_systolic_bp") is None:
            missing.append("Systolic BP")
        if missing:
            raise InsufficientClinicalData(
                "Insufficient data for assessment. Record: " + ", ".join(missing) + "."
            )
        feature_row = build_feature_row(record)
        X = pd.DataFrame([feature_row], columns=FEATURE_NAMES)

        proba = float(cls._model.predict_proba(X)[0, 1])
        level = risk_level_for_score(proba)

        shap_values = cls._explainer.shap_values(X)
        # shap_values shape: (1, n_features) for binary XGBoost classifier
        row_shap = shap_values[0] if isinstance(shap_values, np.ndarray) else shap_values[0][0]

        contributions = [
            explain_contribution(feat, feature_row[feat], float(val))
            for feat, val in zip(FEATURE_NAMES, row_shap)
        ]
        contributions.sort(key=lambda c: abs(c["shap_value"]), reverse=True)

        return {
            "risk_score": round(proba, 4),
            "risk_level": level,
            "model_version": cls.model_version(),
            "shap_explanation": contributions[:6],  # top 6 contributing features
        }
