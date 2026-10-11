from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.consent import Consent, ConsentStatus
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.services.audit import log_event

router = APIRouter(prefix="/api/consents", tags=["consents"])


class ConsentCreate(BaseModel):
    authorized_user_id: int = Field(gt=0)
    access_scope: str = Field(min_length=1, max_length=128)
    expires_at: datetime | None = None


class ConsentOut(BaseModel):
    id: int
    patient_id: int
    authorized_user_id: int
    access_scope: str
    status: ConsentStatus
    created_at: datetime
    expires_at: datetime | None

    model_config = {"from_attributes": True}


def _get_own_patient(db: Session, user: User) -> Patient:
    if user.patient_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No patient record is linked to this account",
        )
    patient = db.get(Patient, user.patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient record not found")
    return patient


@router.post("", response_model=ConsentOut, status_code=status.HTTP_201_CREATED)
def grant_consent(
    payload: ConsentCreate,
    current_user: User = Depends(require_role(UserRole.PATIENT)),
    db: Session = Depends(get_db),
):
    patient = _get_own_patient(db, current_user)
    authorized_user = db.get(User, payload.authorized_user_id)
    if (
        authorized_user is None
        or not authorized_user.is_active
        or authorized_user.role != UserRole.CLINICIAN
    ):
        raise HTTPException(status_code=404, detail="Authorized account not found")

    if payload.expires_at is not None:
        expiry = payload.expires_at
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        if expiry <= datetime.now(timezone.utc):
            raise HTTPException(status_code=422, detail="Expiry must be in the future")

    scope = payload.access_scope.strip()
    if scope.lower() not in {"record", "patient_record", "all_records", "full_record", "visits", "conditions", "labs", "prescriptions", "qr_access", "limited", "full"}:
        raise HTTPException(status_code=422, detail="Unsupported access scope")

    consent = Consent(
        patient_id=patient.id,
        authorized_user_id=authorized_user.id,
        access_scope=scope,
        granted_by_user_id=current_user.id,
        status=ConsentStatus.ACTIVE,
        expires_at=payload.expires_at,
    )
    db.add(consent)
    db.flush()
    log_event(
        db,
        action="CONSENT_GRANTED",
        actor_user_id=current_user.id,
        actor_role=current_user.role.value,
        resource=f"consent:{consent.id}",
        success=True,
        detail=f"Patient {patient.id}; authorized user {authorized_user.id}; scope {consent.access_scope}",
    )
    db.commit()
    db.refresh(consent)
    return consent


@router.get("/mine", response_model=list[ConsentOut])
def list_my_consents(
    current_user: User = Depends(require_role(UserRole.PATIENT)),
    db: Session = Depends(get_db),
):
    patient = _get_own_patient(db, current_user)
    consents = (
        db.query(Consent)
        .filter(Consent.patient_id == patient.id)
        .order_by(Consent.created_at.desc())
        .all()
    )
    now = datetime.now(timezone.utc)
    changed = False
    for consent in consents:
        if consent.status == ConsentStatus.ACTIVE and consent.expires_at is not None:
            expiry = consent.expires_at
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            if expiry <= now:
                consent.status = ConsentStatus.EXPIRED
                changed = True
    if changed:
        db.commit()
    return consents


@router.post("/{consent_id}/revoke", response_model=ConsentOut)
def revoke_consent(
    consent_id: int,
    current_user: User = Depends(require_role(UserRole.PATIENT)),
    db: Session = Depends(get_db),
):
    patient = _get_own_patient(db, current_user)
    consent = db.get(Consent, consent_id)
    if consent is None or consent.patient_id != patient.id:
        raise HTTPException(status_code=404, detail="Consent not found")

    if consent.status == ConsentStatus.ACTIVE:
        consent.status = ConsentStatus.REVOKED
        log_event(
            db,
            action="CONSENT_REVOKED",
            actor_user_id=current_user.id,
            actor_role=current_user.role.value,
            resource=f"consent:{consent.id}",
            success=True,
        )
        db.commit()
        db.refresh(consent)
    return consent
