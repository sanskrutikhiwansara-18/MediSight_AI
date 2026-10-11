"""Create/repair only the fixed local representative demo account.

Run from backend/: python -m scripts.ensure_representative
This does not seed patients and does not write/alter any dataset files.
"""
from app.core.database import Base, engine, SessionLocal
from app.core.dev_migrations import upgrade_for_patient_role
from app.core.security import hash_password
from app.models.user import User, UserRole
import app.models  # register all SQLAlchemy models before create_all

EMAIL = "representative@medisight.dev"
PASSWORD = "Guardian123!"


def main():
    Base.metadata.create_all(bind=engine)
    upgrade_for_patient_role(engine)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email.ilike(EMAIL)).first()
        if user is None:
            db.add(User(email=EMAIL, full_name="MediSight Representative",
                        hashed_password=hash_password(PASSWORD), role=UserRole.REPRESENTATIVE,
                        is_active=True, patient_id=None))
            db.commit()
            print(f"Created local representative account: {EMAIL}")
        elif user.role != UserRole.REPRESENTATIVE:
            raise RuntimeError(
                f"{EMAIL} already exists with role {user.role.value}; refusing to change another account's role."
            )
        else:
            user.full_name = "MediSight Representative"
            user.hashed_password = hash_password(PASSWORD)
            user.is_active = True
            db.commit()
            print(f"Updated local representative account: {EMAIL}")
        print("Local demo password: Guardian123!")
        print("Dataset files were not modified by this script.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
