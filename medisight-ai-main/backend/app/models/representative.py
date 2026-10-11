from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class RepresentativeRelationship(Base):
    """Patient-designated relationship; a representative never self-assigns a patient."""
    __tablename__ = "representative_relationships"
    __table_args__ = (UniqueConstraint("patient_id", "representative_user_id", name="uq_patient_representative"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    patient_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    representative_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class AccessRequest(Base):
    """Clinician access request reviewed by the patient (veto) and their designated representative."""
    __tablename__ = "representative_access_requests"
    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    patient_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    requester_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    representative_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    access_scope: Mapped[str] = mapped_column(String(16), nullable=False, default="limited")
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    is_emergency: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class AppNotification(Base):
    """In-app notifications. No email delivery is claimed by this model."""
    __tablename__ = "app_notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    patient_id: Mapped[int | None] = mapped_column(ForeignKey("patients.id"), nullable=True, index=True)
    request_id: Mapped[int | None] = mapped_column(ForeignKey("representative_access_requests.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(String(32), nullable=False, default="info")
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
