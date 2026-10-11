"""
Patient self-service endpoints.

A patient can only ever see their OWN record: the patient id comes from the
authenticated user row, never from the URL, so there is no id to tamper with.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.patient import Patient
from app.models.qr_token import QRToken
from app.models.user import User, UserRole
from app.schemas.misc import QRGenerateResponse, RiskPredictionOut
from app.schemas.patient import PatientDetailOut
from app.models.risk_audit import RiskPrediction
from app.services.audit import log_event
from app.services.qr_service import issue_qr_token, revoke_qr_token
from app.services.risk_service import RiskService, RiskModelUnavailable, InsufficientClinicalData

router = APIRouter(prefix="/api/me", tags=["me"])


def _own_patient(db: Session, user: User) -> Patient:
    patient = db.get(Patient, user.patient_id) if user.patient_id else None
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No health record is linked to this account.",
        )
    return patient


@router.get("/record", response_model=PatientDetailOut)
def my_record(
    request: Request,
    current_user: User = Depends(require_role(UserRole.PATIENT)),
    db: Session = Depends(get_db),
):
    patient = _own_patient(db, current_user)
    log_event(
        db, action="OWN_RECORD_VIEW", actor_user_id=current_user.id,
        actor_role=current_user.role.value, resource=f"patient:{patient.id}",
        success=True, ip_address=request.client.host if request.client else "",
    )
    return patient


@router.get("/risk", response_model=RiskPredictionOut)
def my_risk(
    current_user: User = Depends(require_role(UserRole.PATIENT)),
    db: Session = Depends(get_db),
):
    patient = _own_patient(db, current_user)
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
        db, action="OWN_RISK_VIEW", actor_user_id=current_user.id,
        actor_role=current_user.role.value, resource=f"patient:{patient.id}",
        success=True, detail=f"risk_level={result['risk_level']}",
    )
    db.commit()
    return result


@router.post("/qr", response_model=QRGenerateResponse)
def my_qr(
    current_user: User = Depends(require_role(UserRole.PATIENT)),
    db: Session = Depends(get_db),
):
    """Let a patient mint a short-lived QR to hand to a clinician."""
    patient = _own_patient(db, current_user)
    qr_token, payload, image_b64 = issue_qr_token(db, patient)
    log_event(
        db, action="QR_GENERATED_BY_PATIENT", actor_user_id=current_user.id,
        actor_role=current_user.role.value, resource=f"patient:{patient.id}", success=True,
    )
    return QRGenerateResponse(
        token=qr_token.token,
        qr_payload=payload,
        qr_image_base64=image_b64,
        expires_at=qr_token.expires_at,
    )


@router.post("/qr/revoke/{token}")
def revoke_my_qr(
    token: str,
    current_user: User = Depends(require_role(UserRole.PATIENT)),
    db: Session = Depends(get_db),
):
    """Stop sharing: a patient can revoke only tokens that belong to them."""
    patient = _own_patient(db, current_user)
    owned = (
        db.query(QRToken)
        .filter(QRToken.token == token, QRToken.patient_id == patient.id)
        .first()
    )
    # Same response for "not found" and "not yours" so tokens can't be probed.
    if owned is None or not revoke_qr_token(db, token):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token not found")

    log_event(
        db, action="QR_REVOKED_BY_PATIENT", actor_user_id=current_user.id,
        actor_role=current_user.role.value, resource=f"qr_token:{token[:8]}...", success=True,
    )
    return {"revoked": True}


from pydantic import BaseModel, Field

BLOOD_GROUPS = {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"}

class BloodGroupUpdate(BaseModel):
    blood_group: str = Field(min_length=2, max_length=3)

@router.patch("/blood-group")
def update_my_blood_group(
    payload: BloodGroupUpdate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.PATIENT)),
    db: Session = Depends(get_db),
):
    patient = _own_patient(db, current_user)
    value = payload.blood_group.strip().upper()
    if value not in BLOOD_GROUPS:
        raise HTTPException(status_code=422, detail="Choose a valid blood group")
    patient.blood_group = value
    patient.blood_group_verified = False
    log_event(db, action="BLOOD_GROUP_UPDATED_SELF_REPORTED", actor_user_id=current_user.id,
              actor_role=current_user.role.value, resource=f"patient:{patient.id}", success=True,
              detail="Blood group saved as patient-reported, not clinically verified",
              ip_address=request.client.host if request.client else "")
    db.commit()
    return {"blood_group": patient.blood_group, "blood_group_verified": patient.blood_group_verified,
            "message": "Saved as patient-reported. Confirm with a laboratory or clinician before transfusion decisions."}
