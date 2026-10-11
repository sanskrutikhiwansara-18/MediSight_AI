import enum
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserRole(str, enum.Enum):
    CLINICIAN = "clinician"
    ADMIN = "admin"
    PATIENT = "patient"
    REPRESENTATIVE = "representative"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True)
    # Only set for role == PATIENT. Identity (name/email) lives on User; the
    # clinical record lives on Patient, which stays de-identified. This link
    # is the only bridge between the two, and it is never exposed to
    # clinicians or admins.
    patient_id: Mapped[int | None] = mapped_column(
        ForeignKey("patients.id"), unique=True, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
