import base64
import io
from datetime import datetime, timedelta, timezone

import qrcode
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import generate_secure_token
from app.models.qr_token import QRToken
from app.models.patient import Patient


def issue_qr_token(db: Session, patient: Patient) -> tuple[QRToken, str, str]:
    """
    Create a new random, revocable, expirable token for this patient and
    render it as a QR code. The QR payload carries ONLY the opaque token —
    never any patient identity or medical data.
    """
    token_value = generate_secure_token(settings.QR_TOKEN_BYTES)
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.QR_TOKEN_EXPIRE_MINUTES
    )

    qr_token = QRToken(token=token_value, patient_id=patient.id, expires_at=expires_at)
    db.add(qr_token)
    db.commit()
    db.refresh(qr_token)

    payload = f"medisight://patient/{token_value}"

    img = qrcode.make(payload)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    image_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    return qr_token, payload, image_b64


def resolve_qr_token(db: Session, token_value: str) -> tuple[QRToken | None, str | None]:
    """Returns (qr_token, error_reason). error_reason is None on success."""
    qr_token = db.query(QRToken).filter(QRToken.token == token_value).first()
    if qr_token is None:
        return None, "Token not found"
    if qr_token.revoked:
        return None, "Token has been revoked"
    if not qr_token.is_valid():
        return None, "Token has expired"
    return qr_token, None


def revoke_qr_token(db: Session, token_value: str) -> bool:
    qr_token = db.query(QRToken).filter(QRToken.token == token_value).first()
    if qr_token is None:
        return False
    qr_token.revoked = True
    db.commit()
    return True
