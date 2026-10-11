from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.user import User, UserRole
from app.models.patient import Patient, Visit, Condition, LabResult, Prescription
from app.schemas.patient import (
    PatientDetailOut, VisitOut, ConditionOut, LabResultOut, PrescriptionOut,
    VisitCreate, ConditionCreate, LabResultCreate, PrescriptionCreate,
)
from app.services.audit import log_event
from app.services.consent_access import enforce_patient_access

router = APIRouter(prefix="/api/patients", tags=["patients"])


def _get_patient_or_404(db: Session, patient_id: int) -> Patient:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return patient


@router.get("/{patient_id}", response_model=PatientDetailOut)
def get_patient(
    patient_id: int,
    request: Request,
    current_user: User = Depends(require_role(UserRole.CLINICIAN)),
    db: Session = Depends(get_db),
):
    patient = _get_patient_or_404(db, patient_id)
    access_scope = enforce_patient_access(db, request, current_user, patient_id, "record")
    log_event(
        db, action="PATIENT_RECORD_ACCESS", actor_user_id=current_user.id,
        actor_role=current_user.role.value, resource=f"patient:{patient_id}",
        success=True, ip_address=request.client.host if request.client else "",
    )
    if access_scope == "limited":
        return {
            "id": patient.id, "patient_ref": patient.patient_ref, "age": patient.age,
            "gender": patient.gender, "region": patient.region,
            "blood_group": patient.blood_group, "blood_group_verified": patient.blood_group_verified, "access_scope": "limited",
            "conditions": patient.conditions, "visits": patient.visits,
            "lab_results": patient.lab_results, "prescriptions": [],
        }
    data = PatientDetailOut.model_validate(patient).model_dump()
    data["access_scope"] = access_scope
    return data


@router.get("/{patient_id}/visits", response_model=list[VisitOut])
def get_visits(
    patient_id: int,
    request: Request,
    current_user: User = Depends(require_role(UserRole.CLINICIAN)),
    db: Session = Depends(get_db),
):
    patient = _get_patient_or_404(db, patient_id)
    enforce_patient_access(db, request, current_user, patient_id, "visits")
    return patient.visits


@router.get("/{patient_id}/conditions", response_model=list[ConditionOut])
def get_conditions(
    patient_id: int,
    request: Request,
    current_user: User = Depends(require_role(UserRole.CLINICIAN)),
    db: Session = Depends(get_db),
):
    patient = _get_patient_or_404(db, patient_id)
    enforce_patient_access(db, request, current_user, patient_id, "conditions")
    return patient.conditions


@router.get("/{patient_id}/labs", response_model=list[LabResultOut])
def get_labs(
    patient_id: int,
    request: Request,
    current_user: User = Depends(require_role(UserRole.CLINICIAN)),
    db: Session = Depends(get_db),
):
    patient = _get_patient_or_404(db, patient_id)
    enforce_patient_access(db, request, current_user, patient_id, "labs")
    return patient.lab_results


@router.get("/{patient_id}/prescriptions", response_model=list[PrescriptionOut])
def get_prescriptions(
    patient_id: int,
    request: Request,
    current_user: User = Depends(require_role(UserRole.CLINICIAN)),
    db: Session = Depends(get_db),
):
    patient = _get_patient_or_404(db, patient_id)
    enforce_patient_access(db, request, current_user, patient_id, "prescriptions")
    return patient.prescriptions


# ---- Clinician write endpoints -------------------------------------------
# A clinician can log a visit, diagnose a condition, record a lab result, or
# start a prescription directly from the patient record. Each new entry
# feeds the same feature pipeline the risk model reads (app/ml/features.py),
# so re-running "Calculate risk" after adding data reflects it immediately.

@router.post("/{patient_id}/visits", response_model=VisitOut, status_code=status.HTTP_201_CREATED)
def add_visit(
    patient_id: int,
    payload: VisitCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.CLINICIAN)),
    db: Session = Depends(get_db),
):
    patient = _get_patient_or_404(db, patient_id)
    enforce_patient_access(db, request, current_user, patient_id, "visits")
    visit = Visit(patient_id=patient.id, **payload.model_dump())
    db.add(visit)
    log_event(
        db, action="VISIT_ADDED", actor_user_id=current_user.id,
        actor_role=current_user.role.value, resource=f"patient:{patient_id}",
        success=True, detail=payload.reason,
        ip_address=request.client.host if request.client else "",
    )
    db.commit()
    db.refresh(visit)
    return visit


@router.post("/{patient_id}/conditions", response_model=ConditionOut, status_code=status.HTTP_201_CREATED)
def add_condition(
    patient_id: int,
    payload: ConditionCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.CLINICIAN)),
    db: Session = Depends(get_db),
):
    patient = _get_patient_or_404(db, patient_id)
    enforce_patient_access(db, request, current_user, patient_id, "conditions")
    condition = Condition(patient_id=patient.id, **payload.model_dump())
    db.add(condition)
    log_event(
        db, action="CONDITION_ADDED", actor_user_id=current_user.id,
        actor_role=current_user.role.value, resource=f"patient:{patient_id}",
        success=True, detail=payload.name,
        ip_address=request.client.host if request.client else "",
    )
    db.commit()
    db.refresh(condition)
    return condition


@router.post("/{patient_id}/labs", response_model=LabResultOut, status_code=status.HTTP_201_CREATED)
def add_lab_result(
    patient_id: int,
    payload: LabResultCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.CLINICIAN)),
    db: Session = Depends(get_db),
):
    patient = _get_patient_or_404(db, patient_id)
    enforce_patient_access(db, request, current_user, patient_id, "labs")
    lab = LabResult(patient_id=patient.id, **payload.model_dump())
    db.add(lab)
    log_event(
        db, action="LAB_RESULT_ADDED", actor_user_id=current_user.id,
        actor_role=current_user.role.value, resource=f"patient:{patient_id}",
        success=True, detail=f"{payload.test_name}={payload.value}{payload.unit}",
        ip_address=request.client.host if request.client else "",
    )
    db.commit()
    db.refresh(lab)
    return lab


@router.post("/{patient_id}/prescriptions", response_model=PrescriptionOut, status_code=status.HTTP_201_CREATED)
def add_prescription(
    patient_id: int,
    payload: PrescriptionCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.CLINICIAN)),
    db: Session = Depends(get_db),
):
    patient = _get_patient_or_404(db, patient_id)
    enforce_patient_access(db, request, current_user, patient_id, "prescriptions")
    prescription = Prescription(patient_id=patient.id, **payload.model_dump())
    db.add(prescription)
    log_event(
        db, action="PRESCRIPTION_ADDED", actor_user_id=current_user.id,
        actor_role=current_user.role.value, resource=f"patient:{patient_id}",
        success=True, detail=payload.medication,
        ip_address=request.client.host if request.client else "",
    )
    db.commit()
    db.refresh(prescription)
    return prescription


class BloodGroupVerification(BaseModel):
    blood_group: str = Field(min_length=2, max_length=3)
    verification_note: str = Field(min_length=5, max_length=300)

@router.patch("/{patient_id}/blood-group/verify")
def verify_blood_group(
    patient_id: int, payload: BloodGroupVerification, request: Request,
    current_user: User = Depends(require_role(UserRole.CLINICIAN)),
    db: Session = Depends(get_db),
):
    patient = _get_patient_or_404(db, patient_id)
    access_scope = enforce_patient_access(db, request, current_user, patient_id, "record")
    if access_scope == "limited":
        raise HTTPException(status_code=403, detail="Full record access is required to verify blood group")
    value = payload.blood_group.strip().upper()
    if value not in {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"}:
        raise HTTPException(status_code=422, detail="Choose a valid blood group")
    patient.blood_group = value
    patient.blood_group_verified = True
    log_event(db, action="BLOOD_GROUP_VERIFIED", actor_user_id=current_user.id,
              actor_role=current_user.role.value, resource=f"patient:{patient.id}", success=True,
              detail=f"Clinician verified blood group; {payload.verification_note.strip()[:240]}",
              ip_address=request.client.host if request.client else "")
    db.commit()
    return {"blood_group": value, "blood_group_verified": True, "message": "Blood group marked as clinician-verified."}
