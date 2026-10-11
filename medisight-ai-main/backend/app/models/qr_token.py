from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class QRToken(Base):
    """
    The QR code itself only ever encodes `token`. It carries no patient
    identity, no medical data — just a random, revocable, expirable
    reference the backend resolves after validating the caller's role.
    """
    __tablename__ = "qr_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    token: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    used_count: Mapped[int] = mapped_column(default=0)

    patient: Mapped["Patient"] = relationship(back_populates="qr_tokens")

    def is_valid(self) -> bool:
        if self.revoked:
            return False
        now = datetime.now(timezone.utc)
        expires = self.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        return now <= expires
