from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.consent import Consent, ConsentStatus
from app.schemas.misc import QRGenerateResponse, QRValidateRequest, QRValidateResponse
from app.services.qr_service import issue_qr_token, resolve_qr_token, revoke_qr_token
from app.services.audit import log_event

router = APIRouter(prefix="/api/qr", tags=["qr"])


@router.post("/generate/{patient_id}", response_model=QRGenerateResponse)
def generate_qr(
    patient_id: int,
    current_user: User = Depends(require_role(UserRole.CLINICIAN)),
    db: Session = Depends(get_db),
):
    """Clinician-only: mint a short-lived QR token for a patient (e.g. to
    print on a wristband or badge for scanning at point of care)."""
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")

    qr_token, payload, image_b64 = issue_qr_token(db, patient)

    log_event(
        db, action="QR_GENERATED", actor_user_id=current_user.id,
        actor_role=current_user.role.value, resource=f"patient:{patient_id}", success=True,
    )

    return QRGenerateResponse(
        token=qr_token.token,
        qr_payload=payload,
        qr_image_base64=image_b64,
        expires_at=qr_token.expires_at,
    )


@router.post("/validate", response_model=QRValidateResponse)
def validate_qr(
    payload: QRValidateRequest,
    request: Request,
    current_user: User = Depends(require_role(UserRole.CLINICIAN)),
    db: Session = Depends(get_db),
):
    """
    Login -> Scan QR -> Validate token -> Check role -> Fetch patient.
    Only a clinician can resolve a QR token to a patient; the token itself
    carries no patient identity, so this endpoint is the only place the
    mapping happens, and every attempt is audit-logged.
    """
    qr_token, error = resolve_qr_token(db, payload.token)

    if error:
        log_event(
            db, action="QR_ACCESS_FAILED", actor_user_id=current_user.id,
            actor_role=current_user.role.value, resource=f"qr_token:{payload.token[:8]}...",
            success=False, detail=error,
            ip_address=request.client.host if request.client else "",
        )
        return QRValidateResponse(valid=False, reason=error)

    # Patient consent is required before a clinician can resolve a QR token.
    now = datetime.now(timezone.utc)
    consent = (
        db.query(Consent)
        .filter(
            Consent.patient_id == qr_token.patient_id,
            Consent.authorized_user_id == current_user.id,
            Consent.access_scope == "qr_access",
            Consent.status == ConsentStatus.ACTIVE,
        )
        .order_by(Consent.created_at.desc())
        .first()
    )
    if consent is not None and consent.expires_at is not None:
        expiry = consent.expires_at
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        if expiry <= now:
            consent = None

    if consent is None:
        log_event(
            db,
            action="QR_ACCESS_DENIED_NO_CONSENT",
            actor_user_id=current_user.id,
            actor_role=current_user.role.value,
            resource=f"patient:{qr_token.patient_id}",
            success=False,
            detail="Patient consent is required for QR access",
            ip_address=request.client.host if request.client else "",
        )
        db.commit()
        return QRValidateResponse(valid=False, reason="Patient consent is required for QR access")

    qr_token.used_count += 1
    db.commit()

    log_event(
        db, action="QR_ACCESS", actor_user_id=current_user.id,
        actor_role=current_user.role.value, resource=f"patient:{qr_token.patient_id}",
        success=True, ip_address=request.client.host if request.client else "",
    )

    return QRValidateResponse(valid=True, patient_id=qr_token.patient_id)


@router.post("/revoke/{token}")
def revoke_qr(
    token: str,
    current_user: User = Depends(require_role(UserRole.CLINICIAN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    ok = revoke_qr_token(db, token)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token not found")

    log_event(
        db, action="QR_REVOKED", actor_user_id=current_user.id,
        actor_role=current_user.role.value, resource=f"qr_token:{token[:8]}...", success=True,
    )
    return {"revoked": True}
