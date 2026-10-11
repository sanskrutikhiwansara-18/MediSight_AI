import secrets

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, hash_password, create_access_token
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest, PatientRegisterRequest, TokenResponse
from app.services.audit import log_event

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else ""


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    email = payload.email.lower()
    user = db.query(User).filter(func.lower(User.email) == email).first()

    if user is None or not verify_password(payload.password, user.hashed_password):
        log_event(
            db,
            action="LOGIN_FAILED",
            actor_role="unknown",
            resource=f"user:{email}",
            success=False,
            detail="Invalid email or password",
            ip_address=_client_ip(request),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    # The password is correct at this point, so it is safe to tell the person
    # which door their account actually belongs to.
    if payload.role is not None and payload.role != user.role.value:
        log_event(
            db,
            action="LOGIN_ROLE_MISMATCH",
            actor_user_id=user.id,
            actor_role=user.role.value,
            resource=f"user:{user.email}",
            success=False,
            detail=f"Attempted {payload.role} sign-in with a {user.role.value} account",
            ip_address=_client_ip(request),
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This is a {user.role.value} account. Switch to the {user.role.value.capitalize()} tab to sign in.",
        )

    token = create_access_token(subject=user.email, role=user.role.value, user_id=user.id)

    log_event(
        db,
        action="LOGIN_SUCCESS",
        actor_user_id=user.id,
        actor_role=user.role.value,
        resource=f"user:{user.email}",
        success=True,
        ip_address=_client_ip(request),
    )

    return TokenResponse(access_token=token, role=user.role.value, full_name=user.full_name)


@router.post("/register/patient", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_patient(payload: PatientRegisterRequest, request: Request, db: Session = Depends(get_db)):
    """
    Self-service sign-up. Only the patient role can be created this way;
    clinician and admin accounts are provisioned by an operator so nobody
    can grant themselves elevated access.

    Identity (name, email) is stored on the user row. The clinical record
    created alongside it holds only age, gender and region, exactly like
    every other patient record in the system.
    """
    email = payload.email.lower()
    if db.query(User).filter(func.lower(User.email) == email).first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Try signing in instead.",
        )

    patient = Patient(
        patient_ref=f"tmp-{secrets.token_hex(6)}",  # replaced by PT-<id> once we have an id
        age=payload.age,
        gender=payload.gender,
        region=payload.region or "UNSPECIFIED",
    )
    try:
        db.add(patient)
        db.flush()
        patient.patient_ref = f"PT-{patient.id:05d}"

        user = User(
            email=email,
            full_name=payload.full_name,
            hashed_password=hash_password(payload.password),
            role=UserRole.PATIENT,
            patient_id=patient.id,
        )
        db.add(user)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Try signing in instead.",
        )
    db.refresh(user)

    log_event(
        db,
        action="PATIENT_REGISTERED",
        actor_user_id=user.id,
        actor_role=user.role.value,
        resource=f"patient:{patient.id}",
        success=True,
        ip_address=_client_ip(request),
    )

    token = create_access_token(subject=user.email, role=user.role.value, user_id=user.id)
    return TokenResponse(access_token=token, role=user.role.value, full_name=user.full_name)
