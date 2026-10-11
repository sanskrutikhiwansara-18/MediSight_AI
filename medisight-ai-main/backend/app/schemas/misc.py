from datetime import datetime
from pydantic import BaseModel


class QRGenerateResponse(BaseModel):
    token: str
    qr_payload: str          # the string encoded in the QR image, e.g. medisight://patient/<token>
    qr_image_base64: str     # PNG, base64-encoded, ready for <img src="data:image/png;base64,...">
    expires_at: datetime


class QRValidateRequest(BaseModel):
    token: str


class QRValidateResponse(BaseModel):
    valid: bool
    patient_id: int | None = None
    reason: str | None = None


class RiskFeatureContribution(BaseModel):
    feature: str
    label: str
    value: float | str
    shap_value: float
    direction: str
    explanation: str


class RiskPredictionOut(BaseModel):
    risk_score: float
    risk_level: str
    model_version: str
    shap_explanation: list[RiskFeatureContribution]
    explanation_method: str = (
        "SHAP feature contributions show how each recorded input influenced "
        "this model's output for this prediction. They do not establish causation."
    )
    data_note: str = (
        "The model requires recorded fasting glucose and systolic blood pressure. "
        "Other unavailable features may be represented by the feature pipeline's "
        "defaults; verify the source record before interpreting this result."
    )
    disclaimer: str = (
        "Research/demo decision support only, not a diagnosis or treatment advice. "
        "The model was trained on synthetic Synthea data and has not been clinically "
        "validated. A qualified clinician must independently review the record."
    )


class DiseaseDistributionItem(BaseModel):
    condition: str
    count: int | None
    suppressed: bool
    reason: str | None = None


class DiseaseTrendPoint(BaseModel):
    period: str
    condition: str
    count: int | None
    suppressed: bool
    reason: str | None = None


class RegionalDistributionItem(BaseModel):
    region: str
    count: int | None
    suppressed: bool
    reason: str | None = None


class AuditLogOut(BaseModel):
    id: int
    timestamp: datetime
    actor_role: str
    action: str
    resource: str
    success: bool
    detail: str

    class Config:
        from_attributes = True


class RegionalDiseaseRatioItem(BaseModel):
    region: str
    condition: str
    count: int | None
    regional_patient_count: int | None
    percentage: float | None
    suppressed: bool
    reason: str | None = None
