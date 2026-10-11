from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey, Float, JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RiskPrediction(Base):
    __tablename__ = "risk_predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    risk_score: Mapped[float] = mapped_column(Float)  # model probability, 0-1
    risk_level: Mapped[str] = mapped_column(String(16))  # LOW / MODERATE / HIGH
    model_version: Mapped[str] = mapped_column(String(32))
    # SHAP feature contributions, stored as [{feature, value, shap_value}, ...]
    shap_explanation: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    patient: Mapped["Patient"] = relationship(back_populates="risk_predictions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), index=True
    )
    actor_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actor_role: Mapped[str] = mapped_column(String(16), default="unknown")
    action: Mapped[str] = mapped_column(String(64))  # e.g. QR_ACCESS, LOGIN_FAILED
    resource: Mapped[str] = mapped_column(String(128), default="")  # e.g. patient:42
    success: Mapped[bool] = mapped_column(default=True)
    detail: Mapped[str] = mapped_column(String(512), default="")
    ip_address: Mapped[str] = mapped_column(String(64), default="")
