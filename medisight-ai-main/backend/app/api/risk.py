from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.risk_audit import RiskPrediction
from app.schemas.misc import RiskPredictionOut
from app.services.risk_service import RiskService, RiskModelUnavailable, InsufficientClinicalData
from app.services.audit import log_event
from app.services.consent_access import enforce_patient_access

router = APIRouter(prefix="/api/patients", tags=["risk"])


@router.get("/{patient_id}/risk", response_model=RiskPredictionOut)
def get_patient_risk(
    patient_id: int,
    request: Request,
    current_user: User = Depends(require_role(UserRole.CLINICIAN)),
    db: Session = Depends(get_db),
):
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    access_scope = enforce_patient_access(db, request, current_user, patient_id, "record")
    if access_scope == "limited":
        raise HTTPException(status_code=403, detail="Full record access is required for AI risk calculation")

    try:
        result = RiskService.predict(db, patient)
    except InsufficientClinicalData as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except RiskModelUnavailable as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))

    db.add(RiskPrediction(
        patient_id=patient.id,
        risk_score=result["risk_score"],
        risk_level=result["risk_level"],
        model_version=result["model_version"],
        shap_explanation=result["shap_explanation"],
    ))
    log_event(
        db, action="RISK_PREDICTION", actor_user_id=current_user.id,
        actor_role=current_user.role.value, resource=f"patient:{patient_id}",
        success=True, detail=f"risk_level={result['risk_level']}",
    )
    db.commit()

    return result
