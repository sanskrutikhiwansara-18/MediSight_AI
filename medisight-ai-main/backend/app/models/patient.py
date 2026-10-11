from datetime import date, datetime, timezone

from sqlalchemy import String, Integer, Date, DateTime, ForeignKey, Float, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Patient(Base):
    """
    Only de-identified reference data lives here. No name, no address,
    no MRN-style identifiers that map back to a real-world identity —
    that separation is the whole point of the platform.
    """
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_ref: Mapped[str] = mapped_column(String(32), unique=True, index=True)  # e.g. PT-00042
    age: Mapped[int] = mapped_column(Integer)
    gender: Mapped[str] = mapped_column(String(16))
    region: Mapped[str] = mapped_column(String(64), default="UNSPECIFIED")  # for aggregate analytics
    # Intentionally nullable: never infer a blood group from synthetic records.
    blood_group: Mapped[str | None] = mapped_column(String(3), nullable=True, default=None)
    blood_group_verified: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    visits: Mapped[list["Visit"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    conditions: Mapped[list["Condition"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    lab_results: Mapped[list["LabResult"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    prescriptions: Mapped[list["Prescription"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    qr_tokens: Mapped[list["QRToken"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    risk_predictions: Mapped[list["RiskPrediction"]] = relationship(back_populates="patient", cascade="all, delete-orphan")


class Visit(Base):
    __tablename__ = "visits"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    visit_date: Mapped[date] = mapped_column(Date)
    reason: Mapped[str] = mapped_column(String(255))
    notes: Mapped[str] = mapped_column(Text, default="")

    patient: Mapped["Patient"] = relationship(back_populates="visits")


class Condition(Base):
    __tablename__ = "conditions"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    name: Mapped[str] = mapped_column(String(128))
    icd10_code: Mapped[str] = mapped_column(String(16), default="")
    diagnosed_date: Mapped[date] = mapped_column(Date)
    active: Mapped[bool] = mapped_column(default=True)

    patient: Mapped["Patient"] = relationship(back_populates="conditions")


class LabResult(Base):
    __tablename__ = "lab_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    test_name: Mapped[str] = mapped_column(String(128))
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(32))
    reference_range: Mapped[str] = mapped_column(String(64), default="")
    result_date: Mapped[date] = mapped_column(Date)
    abnormal: Mapped[bool] = mapped_column(default=False)

    patient: Mapped["Patient"] = relationship(back_populates="lab_results")


class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    medication: Mapped[str] = mapped_column(String(128))
    dosage: Mapped[str] = mapped_column(String(64))
    frequency: Mapped[str] = mapped_column(String(64))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    patient: Mapped["Patient"] = relationship(back_populates="prescriptions")
