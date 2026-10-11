import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ConsentStatus(str, enum.Enum):
    ACTIVE = "active"
    REVOKED = "revoked"
    EXPIRED = "expired"


class Consent(Base):
    """A patient's consent record authorizing a user to access a defined scope."""

    __tablename__ = "consents"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    authorized_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    access_scope: Mapped[str] = mapped_column(String(128), nullable=False)
    granted_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[ConsentStatus] = mapped_column(
        Enum(ConsentStatus), nullable=False, default=ConsentStatus.ACTIVE
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
