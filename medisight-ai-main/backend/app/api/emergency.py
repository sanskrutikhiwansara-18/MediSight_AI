from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.emergency_access import EmergencyAccess
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.services.audit import log_event

router = APIRouter(prefix="/api/emergency-access", tags=["emergency-access"])
ALLOWED_SCOPES = {"record", "visits", "conditions", "labs", "prescriptions", "qr_access"}


class EmergencyAccessCreate(BaseModel):
    patient_id: int = Field(gt=0)
    reason: str = Field(min_length=10, max_length=1000)
    access_scope: list[str] = Field(min_length=1, max_length=6)
    duration_minutes: int = Field(gt=0, le=60)


class EmergencyAccessOut(BaseModel):
    id: int
    patient_id: int
    clinician_user_id: int
    reason: str
    access_scope: str
    created_at: datetime
    expires_at: datetime
    revoked_at: datetime | None

    model_config = {"from_attributes": True}


@router.post("", response_model=EmergencyAccessOut, status_code=201)
def create_emergency_access(
    payload: EmergencyAccessCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.CLINICIAN)),
    db: Session = Depends(get_db),
):
    if db.get(Patient, payload.patient_id) is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    reason = payload.reason.strip()
    scopes = sorted(set(payload.access_scope))
    if len(reason) < 10:
        raise HTTPException(status_code=422, detail="A meaningful emergency reason is required")
    if not scopes or not set(scopes).issubset(ALLOWED_SCOPES):
        raise HTTPException(status_code=422, detail="Invalid emergency access scope")
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    grant = EmergencyAccess(
        patient_id=payload.patient_id,
        clinician_user_id=current_user.id,
        reason=reason,
        access_scope=",".join(scopes),
        created_at=now,
        expires_at=now + timedelta(minutes=payload.duration_minutes),
    )
    db.add(grant)
    db.flush()
    log_event(db, action="EMERGENCY_ACCESS_GRANTED", actor_user_id=current_user.id,
              actor_role=current_user.role.value, resource=f"patient:{grant.patient_id}",
              success=True,
              detail=f"emergency_access_id={grant.id}; reason={reason[:240]}; scope={grant.access_scope}; expires_at={grant.expires_at.isoformat()}",
              ip_address=request.client.host if request.client else "")
    db.commit()
    db.refresh(grant)
    return grant


@router.post("/{grant_id}/revoke")
def revoke_emergency_access(
    grant_id: int,
    request: Request,
    current_user: User = Depends(require_role(UserRole.CLINICIAN)),
    db: Session = Depends(get_db),
):
    grant = db.get(EmergencyAccess, grant_id)
    if grant is None or grant.clinician_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Emergency access grant not found")
    if grant.revoked_at is None:
        grant.revoked_at = datetime.now(timezone.utc).replace(tzinfo=None)
        log_event(db, action="EMERGENCY_ACCESS_REVOKED", actor_user_id=current_user.id,
                  actor_role=current_user.role.value, resource=f"patient:{grant.patient_id}",
                  success=True, detail=f"emergency_access_id={grant.id}",
                  ip_address=request.client.host if request.client else "")
        db.commit()
    return {"revoked": True, "id": grant.id}
