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

router = APIRouter(prefix="/api/representative", tags=["representative"])

class DesignateRepresentative(BaseModel):
    representative_email: str = Field(min_length=5, max_length=255)

class RequestDecision(BaseModel):
    decision: str = Field(pattern="^(approve|reject)$")

class EmergencyGrantRequest(BaseModel):
    patient_id: int = Field(gt=0)
    reason: str = Field(min_length=10, max_length=1000)
    duration_minutes: int = Field(default=30, ge=5, le=60)

class RelationshipOut(BaseModel):
    id: int
    patient_id: int
    patient_ref: str
    patient_name: str
    status: str
    created_at: datetime

class RequestOut(BaseModel):
    id: int
    patient_id: int
    patient_ref: str
    patient_name: str
    requester_name: str
    requester_email: str
    access_scope: str
    reason: str
    status: str
    is_emergency: bool
    created_at: datetime
    expires_at: datetime | None


def _notify(db: Session, user_id: int, patient_id: int | None, request_id: int | None, title: str, message: str, kind="info"):
    db.add(AppNotification(user_id=user_id, patient_id=patient_id, request_id=request_id,
                           title=title, message=message, notification_type=kind))


def _active_relationship(db, patient_id, rep_id):
    return db.query(RepresentativeRelationship).filter_by(
        patient_id=patient_id, representative_user_id=rep_id, status="active"
    ).first()


@router.post("/designate")
def designate_representative(
    payload: DesignateRepresentative, request: Request,
    current_user: User = Depends(require_role(UserRole.PATIENT)), db: Session = Depends(get_db),
):
    if not current_user.patient_id:
        raise HTTPException(status_code=404, detail="No health record is linked to this account")
    rep = db.query(User).filter(User.email.ilike(payload.representative_email.strip())).first()
    if rep is None or rep.role != UserRole.REPRESENTATIVE or not rep.is_active:
        raise HTTPException(status_code=404, detail="Representative account not found. Use the designated representative account.")
    relationship = db.query(RepresentativeRelationship).filter_by(
        patient_id=current_user.patient_id, representative_user_id=rep.id
    ).first()
    if relationship and relationship.status == "active":
        return {"relationship_id": relationship.id, "status": "active", "message": "Representative is already designated."}
    if relationship:
        relationship.status = "active"
        relationship.revoked_at = None
    else:
        relationship = RepresentativeRelationship(patient_id=current_user.patient_id,
            patient_user_id=current_user.id, representative_user_id=rep.id, status="active")
        db.add(relationship)
    _notify(db, rep.id, current_user.patient_id, None, "You were designated as a representative",
            f"{current_user.full_name} has designated you to review record-access requests.")
    log_event(db, action="REPRESENTATIVE_DESIGNATED", actor_user_id=current_user.id,
              actor_role=current_user.role.value, resource=f"patient:{current_user.patient_id}", success=True,
              detail=f"representative_user_id={rep.id}", ip_address=request.client.host if request.client else "")
    db.commit(); db.refresh(relationship)
    return {"relationship_id": relationship.id, "status": relationship.status, "message": "Representative designated."}


@router.get("/relationships", response_model=list[RelationshipOut])
def list_relationships(current_user: User = Depends(require_role(UserRole.REPRESENTATIVE)), db: Session = Depends(get_db)):
    relationships = db.query(RepresentativeRelationship).filter_by(representative_user_id=current_user.id, status="active").order_by(RepresentativeRelationship.created_at.desc()).all()
    result = []
    for rel in relationships:
        patient = db.get(Patient, rel.patient_id)
        patient_user = db.get(User, rel.patient_user_id)
        if patient and patient_user:
            result.append(RelationshipOut(id=rel.id, patient_id=patient.id, patient_ref=patient.patient_ref,
                patient_name=patient_user.full_name, status=rel.status, created_at=rel.created_at))
    return result


@router.get("/requests", response_model=list[RequestOut])
def list_requests(current_user: User = Depends(require_role(UserRole.REPRESENTATIVE)), db: Session = Depends(get_db)):
    requests = db.query(AccessRequest).filter_by(representative_user_id=current_user.id).order_by(AccessRequest.created_at.desc()).limit(100).all()
    result = []
    for item in requests:
        patient = db.get(Patient, item.patient_id)
        patient_user = db.get(User, item.patient_user_id)
        requester = db.get(User, item.requester_user_id)
        if patient and patient_user and requester:
            result.append(RequestOut(id=item.id, patient_id=item.patient_id, patient_ref=patient.patient_ref,
                patient_name=patient_user.full_name, requester_name=requester.full_name, requester_email=requester.email,
                access_scope=item.access_scope, reason=item.reason, status=item.status, is_emergency=item.is_emergency,
                created_at=item.created_at, expires_at=item.expires_at))
    return result


@router.post("/requests/{request_id}/decision")
def decide_request(
    request_id: int, payload: RequestDecision, request: Request,
    current_user: User = Depends(require_role(UserRole.REPRESENTATIVE)), db: Session = Depends(get_db),
):
    item = db.get(AccessRequest, request_id)
    if item is None or item.representative_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Access request not found")
    if item.status == "patient_rejected":
        raise HTTPException(status_code=409, detail="The patient rejected this request. Access cannot be granted.")
    if item.status not in {"pending", "patient_approved"}:
        raise HTTPException(status_code=409, detail=f"This request is already {item.status}.")
    if payload.decision == "approve" and item.status != "patient_approved":
        raise HTTPException(status_code=409, detail="Wait for the patient's approval first. For a genuine emergency, use the audited emergency-access option instead.")
    patient = db.get(Patient, item.patient_id)
    if _active_relationship(db, item.patient_id, current_user.id) is None:
        raise HTTPException(status_code=403, detail="You are no longer designated by this patient")
    patient_user = db.get(User, item.patient_user_id)
    requester = db.get(User, item.requester_user_id)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if payload.decision == "reject":
        item.status = "representative_rejected"
        item.resolved_at = now
        _notify(db, item.patient_user_id, item.patient_id, item.id, "Access request rejected by representative",
                f"Your representative rejected {requester.full_name}'s request.", "warning")
        _notify(db, item.requester_user_id, item.patient_id, item.id, "Access request rejected",
                "The designated representative rejected your request.", "warning")
    else:
        if item.expires_at and item.expires_at <= now:
            item.status = "expired"
            db.commit()
            raise HTTPException(status_code=410, detail="Access request has expired")
        item.status = "representative_approved"
        item.resolved_at = now
        item.expires_at = now + timedelta(hours=8)
        # This is the existing clinician-consent mechanism, so all existing access checks still apply.
        from app.models.consent import Consent, ConsentStatus
        scope = "limited" if item.access_scope == "limited" else "full_record"
        # Replace only record grants for this clinician; never revoke the independent
        # short-lived QR permission as a side effect of a representative decision.
        record_scopes = {"record", "patient_record", "all_records", "full_record", "limited", "full",
                         "visits", "conditions", "labs", "prescriptions"}
        active = db.query(Consent).filter(
            Consent.patient_id == item.patient_id,
            Consent.authorized_user_id == item.requester_user_id,
            Consent.status == ConsentStatus.ACTIVE,
            Consent.access_scope.in_(record_scopes),
        ).all()
        for c in active:
            c.status = ConsentStatus.REVOKED
        db.add(Consent(patient_id=item.patient_id, authorized_user_id=item.requester_user_id,
            access_scope=scope, granted_by_user_id=current_user.id, status=ConsentStatus.ACTIVE,
            expires_at=now + timedelta(hours=8)))
        _notify(db, item.patient_user_id, item.patient_id, item.id, "Representative approved access",
                f"Your representative approved {item.access_scope} access for {requester.full_name}. You can review this notification and revoke future consent from your care team.", "success")
        _notify(db, item.requester_user_id, item.patient_id, item.id, "Access approved",
                f"The designated representative approved {item.access_scope} access. This grant expires in 8 hours.", "success")
    log_event(db, action=f"REPRESENTATIVE_ACCESS_{payload.decision.upper()}", actor_user_id=current_user.id,
              actor_role=current_user.role.value, resource=f"access_request:{item.id}", success=True,
              detail=f"patient_id={item.patient_id}; status={item.status}; scope={item.access_scope}",
              ip_address=request.client.host if request.client else "")
    db.commit()
    return {"id": item.id, "status": item.status, "message": "Decision saved."}


@router.post("/emergency-access")
def grant_emergency_access(
    payload: EmergencyGrantRequest, request: Request,
    current_user: User = Depends(require_role(UserRole.REPRESENTATIVE)), db: Session = Depends(get_db),
):
    patient = db.get(Patient, payload.patient_id)
    relationship = _active_relationship(db, payload.patient_id, current_user.id)
    if patient is None or relationship is None:
        raise HTTPException(status_code=404, detail="Designated patient not found")
    patient_user = db.get(User, relationship.patient_user_id)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    grant = AccessRequest(patient_id=patient.id, patient_user_id=relationship.patient_user_id,
        requester_user_id=current_user.id, representative_user_id=current_user.id,
        access_scope="full", reason=payload.reason.strip(), status="emergency_granted", is_emergency=True,
        created_at=now, resolved_at=now, expires_at=now + timedelta(minutes=payload.duration_minutes))
    db.add(grant); db.flush()
    _notify(db, relationship.patient_user_id, patient.id, grant.id, "Emergency representative access used",
            f"Your representative used emergency access for this record. Reason: {payload.reason.strip()}. Access automatically expires in {payload.duration_minutes} minutes.", "warning")
    log_event(db, action="REPRESENTATIVE_EMERGENCY_ACCESS_GRANTED", actor_user_id=current_user.id,
              actor_role=current_user.role.value, resource=f"patient:{patient.id}", success=True,
              detail=f"request_id={grant.id}; duration={payload.duration_minutes} minutes; reason={payload.reason.strip()[:240]}",
              ip_address=request.client.host if request.client else "")
    db.commit(); db.refresh(grant)
    return {"request_id": grant.id, "status": grant.status, "expires_at": grant.expires_at,
            "message": "Emergency access is active and audit-logged. Patient was notified."}


@router.get("/patients/{patient_id}/record")
def get_representative_record(
    patient_id: int, request_id: int, request: Request,
    current_user: User = Depends(require_role(UserRole.REPRESENTATIVE)), db: Session = Depends(get_db),
):
    item = db.get(AccessRequest, request_id)
    if item is None or item.patient_id != patient_id or item.representative_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Access grant not found")
    if _active_relationship(db, patient_id, current_user.id) is None:
        raise HTTPException(status_code=403, detail="You are no longer designated by this patient")
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if item.status not in {"emergency_granted", "representative_approved"}:
        raise HTTPException(status_code=403, detail="There is no active approval for this record")
    if item.expires_at and item.expires_at <= now:
        raise HTTPException(status_code=410, detail="This access grant has expired")
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient record not found")
    result = {"id": patient.id, "patient_ref": patient.patient_ref, "age": patient.age, "gender": patient.gender,
              "region": patient.region, "blood_group": patient.blood_group,
              "blood_group_verified": patient.blood_group_verified,
              "conditions": [{"id": c.id, "name": c.name, "icd10_code": c.icd10_code,
                              "diagnosed_date": c.diagnosed_date, "active": c.active} for c in patient.conditions],
              "visits": [{"id": v.id, "visit_date": v.visit_date, "reason": v.reason, "notes": v.notes} for v in patient.visits],
              "lab_results": [{"id": l.id, "test_name": l.test_name, "value": l.value, "unit": l.unit,
                               "reference_range": l.reference_range, "result_date": l.result_date, "abnormal": l.abnormal} for l in patient.lab_results],
              "prescriptions": []}
    if item.access_scope == "full" or item.is_emergency:
        result["prescriptions"] = [{"id": rx.id, "medication": rx.medication, "dosage": rx.dosage,
                                    "frequency": rx.frequency, "start_date": rx.start_date, "end_date": rx.end_date}
                                   for rx in patient.prescriptions]
    log_event(db, action="REPRESENTATIVE_RECORD_VIEW", actor_user_id=current_user.id,
              actor_role=current_user.role.value, resource=f"patient:{patient_id}", success=True,
              detail=f"request_id={item.id}; emergency={item.is_emergency}; scope={item.access_scope}",
              ip_address=request.client.host if request.client else "")
    db.commit()
    return result
