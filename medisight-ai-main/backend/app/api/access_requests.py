from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import require_role
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.models.representative import RepresentativeRelationship, AccessRequest, AppNotification
from app.services.audit import log_event

router = APIRouter(prefix="/api/access-requests", tags=["representative-access-requests"])

class CreateAccessRequest(BaseModel):
    patient_id: int = Field(gt=0)
    access_scope: str = Field(pattern="^(limited|full)$")
    reason: str = Field(min_length=10, max_length=1000)

class PatientDecision(BaseModel):
    decision: str = Field(pattern="^(approve|reject)$")

class PatientRequestOut(BaseModel):
    id: int
    patient_id: int
    patient_ref: str
    requester_name: str
    requester_email: str
    representative_name: str
    access_scope: str
    reason: str
    status: str
    created_at: datetime
    expires_at: datetime | None


def _notify(db, user_id, patient_id, request_id, title, message, kind="info"):
    db.add(AppNotification(user_id=user_id, patient_id=patient_id, request_id=request_id,
        title=title, message=message, notification_type=kind))

@router.post("", status_code=201)
def create_access_request(payload: CreateAccessRequest, request: Request,
    current_user: User = Depends(require_role(UserRole.CLINICIAN)), db: Session = Depends(get_db)):
    patient = db.get(Patient, payload.patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient_user = db.query(User).filter_by(patient_id=patient.id, role=UserRole.PATIENT).first()
    if patient_user is None:
        raise HTTPException(status_code=404, detail="Patient login not found for this record")
    relationship = db.query(RepresentativeRelationship).filter_by(patient_id=patient.id, status="active").order_by(RepresentativeRelationship.created_at.desc()).first()
    if relationship is None:
        raise HTTPException(status_code=409, detail="The patient has not designated a representative yet")
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    item = AccessRequest(patient_id=patient.id, patient_user_id=patient_user.id,
        requester_user_id=current_user.id, representative_user_id=relationship.representative_user_id,
        access_scope=payload.access_scope, reason=payload.reason.strip(), status="pending",
        is_emergency=False, created_at=now, expires_at=now + timedelta(hours=24))
    db.add(item); db.flush()
    rep = db.get(User, relationship.representative_user_id)
    display_scope = "limited" if item.access_scope == "limited" else "full"
    # Patient notification is emitted immediately; patient rejection vetoes all approvals.
    _notify(db, patient_user.id, patient.id, item.id, "Record access request needs your review",
        f"{current_user.full_name} ({current_user.email}) requested {display_scope} access. Reject it if you do not recognise the request. Your designated representative will review it too.", "warning")
    _notify(db, rep.id, patient.id, item.id, "New patient record-access request",
        f"{current_user.full_name} requested {display_scope} access to {patient.patient_ref}. Review the reason and approve or reject.", "info")
    log_event(db, action="REPRESENTATIVE_ACCESS_REQUEST_CREATED", actor_user_id=current_user.id,
        actor_role=current_user.role.value, resource=f"patient:{patient.id}", success=True,
        detail=f"request_id={item.id}; scope={item.access_scope}; representative_user_id={rep.id}",
        ip_address=request.client.host if request.client else "")
    db.commit(); db.refresh(item)
    return {"id": item.id, "status": item.status, "message": "Patient and designated representative have been notified in the app."}

@router.get("/mine", response_model=list[PatientRequestOut])
def my_access_requests(current_user: User = Depends(require_role(UserRole.PATIENT)), db: Session = Depends(get_db)):
    if not current_user.patient_id:
        return []
    items = db.query(AccessRequest).filter(AccessRequest.patient_id == current_user.patient_id,
        AccessRequest.is_emergency.is_(False)).order_by(AccessRequest.created_at.desc()).all()
    out = []
    for item in items:
        patient = db.get(Patient, item.patient_id); requester = db.get(User, item.requester_user_id); rep = db.get(User, item.representative_user_id)
        if patient and requester and rep:
            out.append(PatientRequestOut(id=item.id, patient_id=item.patient_id, patient_ref=patient.patient_ref,
                requester_name=requester.full_name, requester_email=requester.email, representative_name=rep.full_name,
                access_scope=item.access_scope, reason=item.reason, status=item.status,
                created_at=item.created_at, expires_at=item.expires_at))
    return out

@router.post("/{request_id}/patient-decision")
def patient_decision(request_id: int, payload: PatientDecision, request: Request,
    current_user: User = Depends(require_role(UserRole.PATIENT)), db: Session = Depends(get_db)):
    item = db.get(AccessRequest, request_id)
    if item is None or item.patient_user_id != current_user.id or item.is_emergency:
        raise HTTPException(status_code=404, detail="Access request not found")
    if item.status not in {"pending", "patient_approved"}:
        raise HTTPException(status_code=409, detail=f"This request is already {item.status}.")
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    requester = db.get(User, item.requester_user_id)
    representative = db.get(User, item.representative_user_id)
    if payload.decision == "reject":
        item.status = "patient_rejected"; item.resolved_at = now
        _notify(db, representative.id, item.patient_id, item.id, "Patient rejected the request", "The patient rejected this request. Do not grant access.", "warning")
        _notify(db, requester.id, item.patient_id, item.id, "Access request rejected by patient", "The patient rejected this request.", "warning")
    else:
        item.status = "patient_approved"
        _notify(db, representative.id, item.patient_id, item.id, "Patient approved representative review", "The patient approved review of this access request. You must still approve or reject the final grant.", "success")
        _notify(db, requester.id, item.patient_id, item.id, "Patient responded to access request", "The patient approved representative review. Final access still requires representative approval.", "info")
    log_event(db, action=f"PATIENT_ACCESS_REQUEST_{payload.decision.upper()}", actor_user_id=current_user.id,
        actor_role=current_user.role.value, resource=f"access_request:{item.id}", success=True,
        detail=f"status={item.status}", ip_address=request.client.host if request.client else "")
    db.commit()
    return {"id": item.id, "status": item.status, "message": "Your decision was saved."}


class CreateAccessRequestByReference(BaseModel):
    patient_ref: str = Field(min_length=4, max_length=32)
    access_scope: str = Field(pattern="^(limited|full)$")
    reason: str = Field(min_length=10, max_length=1000)

class SentRequestOut(BaseModel):
    id: int
    patient_id: int
    patient_ref: str
    patient_name: str
    access_scope: str
    reason: str
    status: str
    created_at: datetime
    expires_at: datetime | None

@router.post("/by-reference", status_code=201)
def create_access_request_by_reference(payload: CreateAccessRequestByReference, request: Request,
    current_user: User = Depends(require_role(UserRole.CLINICIAN)), db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.patient_ref.ilike(payload.patient_ref.strip())).first()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient reference was not found")
    patient_user = db.query(User).filter_by(patient_id=patient.id, role=UserRole.PATIENT).first()
    if patient_user is None:
        raise HTTPException(status_code=404, detail="Patient login not found for this record")
    relationship = db.query(RepresentativeRelationship).filter_by(patient_id=patient.id, status="active").order_by(RepresentativeRelationship.created_at.desc()).first()
    if relationship is None:
        raise HTTPException(status_code=409, detail="The patient has not designated a representative yet")
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    item = AccessRequest(patient_id=patient.id, patient_user_id=patient_user.id,
        requester_user_id=current_user.id, representative_user_id=relationship.representative_user_id,
        access_scope=payload.access_scope, reason=payload.reason.strip(), status="pending",
        is_emergency=False, created_at=now, expires_at=now + timedelta(hours=24))
    db.add(item); db.flush()
    rep = db.get(User, relationship.representative_user_id)
    _notify(db, patient_user.id, patient.id, item.id, "Record access request needs your review",
        f"{current_user.full_name} ({current_user.email}) requested {item.access_scope} access for patient reference {patient.patient_ref}. Reject this request if it looks unfamiliar. Your designated representative will review it too.", "warning")
    _notify(db, rep.id, patient.id, item.id, "New patient record-access request",
        f"{current_user.full_name} requested {item.access_scope} access to {patient.patient_ref}. Review the reason and approve or reject.", "info")
    log_event(db, action="REPRESENTATIVE_ACCESS_REQUEST_CREATED", actor_user_id=current_user.id,
        actor_role=current_user.role.value, resource=f"patient:{patient.id}", success=True,
        detail=f"request_id={item.id}; scope={item.access_scope}; representative_user_id={rep.id}",
        ip_address=request.client.host if request.client else "")
    db.commit(); db.refresh(item)
    return {"id": item.id, "patient_id": patient.id, "patient_ref": patient.patient_ref, "status": item.status,
            "message": "Patient and designated representative have been notified in-app."}

@router.get("/sent", response_model=list[SentRequestOut])
def list_sent_requests(current_user: User = Depends(require_role(UserRole.CLINICIAN)), db: Session = Depends(get_db)):
    items = db.query(AccessRequest).filter_by(requester_user_id=current_user.id, is_emergency=False).order_by(AccessRequest.created_at.desc()).limit(100).all()
    out = []
    for item in items:
        patient = db.get(Patient, item.patient_id)
        patient_user = db.get(User, item.patient_user_id)
        if patient and patient_user:
            out.append(SentRequestOut(id=item.id, patient_id=item.patient_id, patient_ref=patient.patient_ref,
                patient_name=patient_user.full_name, access_scope=item.access_scope, reason=item.reason, status=item.status,
                created_at=item.created_at, expires_at=item.expires_at))
    return out
