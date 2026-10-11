"""
Seed the database with:
  - demo users (1 clinician, 1 admin, 1 patient, 1 representative)
  - ~250 real Synthea patients (real conditions, visits, labs and
    prescriptions), pre-extracted into scripts/data/synthea_seed_sample.json
  - the demo patient login is linked to one of those records
  - EVERY other seeded patient also gets a login (password Patient123! for
    all), written to scripts/data/patient_logins.csv, so you can sign in as
    any of the 250 real Synthea patients, not just the one demo login

No more Faker. `synthea_seed_sample.json` was built by
`ml/src/build_synthea_features.py`'s sibling extraction step from the two
full Synthea CSV exports (see ml/data/synthea_features.csv for the matching
30,921-patient set used to train the risk model) — a random sample of 250
living Synthea-simulated patients, trimmed to their most recent 8 visits /
10 labs / 8 prescriptions / 8 conditions each, with Synthea's non-clinical
"social determinants" entries (employment, education, housing, etc.)
filtered out of the Conditions tab.

These are still NOT real people and NOT MIMIC-IV — Synthea patients are
synthetic, simulated by Synthea's disease-progression models, just not
Faker-random. Swap in a real MIMIC-IV ingestion pipeline under ml/ for
Phase 2 — keep that ingestion modular and never commit restricted MIMIC
data.

Run from backend/:  python -m scripts.seed_data
"""
import json
from datetime import date, timedelta
from pathlib import Path

from app.core.database import Base, engine, SessionLocal
from app.core.dev_migrations import upgrade_for_patient_role
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.patient import Patient, Visit, Condition, LabResult, Prescription

SEED_FILE = Path(__file__).parent / "data" / "synthea_seed_sample.json"

DEMO_STAFF = [
    ("clinician@medisight.dev", "Dr. Asha Verma", "Clinician123!", UserRole.CLINICIAN),
    ("admin@medisight.dev", "Rahul Nair", "Admin123!", UserRole.ADMIN),
    ("representative@medisight.dev", "MediSight Representative", "Guardian123!", UserRole.REPRESENTATIVE),
]


def seed_users(db):
    """Idempotent per account, so re-running the script on an older database
    only adds whatever is missing."""
    created = []
    for email, name, password, role in DEMO_STAFF:
        existing = db.query(User).filter(User.email == email).first()
        if existing is not None:
            # Keep all three original demo logins untouched. The representative
            # account is a fixed local demo credential, so repair only that
            # account when it already exists with an outdated password.
            if role == UserRole.REPRESENTATIVE and existing.role == UserRole.REPRESENTATIVE:
                existing.full_name = name
                existing.hashed_password = hash_password(password)
                existing.is_active = True
                created.append(f"  refreshed {email} demo password")
            continue
        db.add(User(email=email, full_name=name, hashed_password=hash_password(password), role=role))
        created.append(f"  {email} / {password}")
    db.commit()
    if created:
        print("Seeded demo users:")
        print("\n".join(created))
    else:
        print("Staff demo users already present, skipping.")


def seed_demo_patient_user(db):
    """Link a patient login to a real Synthea record that has enough data to
    make the patient dashboard worth looking at."""
    email = "patient@medisight.dev"
    if db.query(User).filter(User.email == email).first():
        print("Demo patient user already present, skipping.")
        return

    linked_ids = {pid for (pid,) in db.query(User.patient_id).filter(User.patient_id.isnot(None))}
    candidates = (
        db.query(Patient)
        .filter(Patient.id.notin_(linked_ids) if linked_ids else True)
        .order_by(Patient.id)
        .all()
    )
    rich = [
        p for p in candidates
        if len([c for c in p.conditions if c.active]) >= 2 and p.lab_results and p.visits and p.prescriptions
    ]
    # Prefer a female record so it matches the demo name.
    chosen = next((p for p in rich if p.gender == "Female"), rich[0] if rich else None)
    if chosen is None:
        print("No suitable patient record found to link the demo patient login to.")
        return

    db.add(User(
        email=email,
        full_name="Priya Sharma",
        hashed_password=hash_password("Patient123!"),
        role=UserRole.PATIENT,
        patient_id=chosen.id,
    ))
    db.commit()
    print(f"Seeded demo patient login (linked to {chosen.patient_ref}):")
    print(f"  {email} / Patient123!")


def _age_from_birthdate(birthdate_str):
    b = date.fromisoformat(birthdate_str)
    today = date.today()
    years = today.year - b.year - ((today.month, today.day) < (b.month, b.day))
    return max(0, min(years, 110))


def _parse_date(s, fallback_days_ago=30):
    if not s:
        return None
    try:
        return date.fromisoformat(s)
    except ValueError:
        return date.today() - timedelta(days=fallback_days_ago)


def seed_patients(db):
    if db.query(Patient).count() > 0:
        print("Patients already seeded, skipping.")
        return

    if not SEED_FILE.exists():
        raise RuntimeError(
            f"{SEED_FILE} not found. Re-run ml/src/build_synthea_features.py's "
            "seed-sample extraction (see docs) or restore synthea_seed_sample.json."
        )

    data = json.loads(SEED_FILE.read_text())["patients"]

    for i, rec in enumerate(data, start=1):
        patient = Patient(
            patient_ref=f"PT-{i:05d}",
            age=_age_from_birthdate(rec["birthdate"]),
            gender="Male" if rec["gender"] == "M" else "Female",
            region=f"{rec['city']}, {rec['state']}" if rec.get("city") else rec.get("state", ""),
        )
        db.add(patient)
        db.flush()  # get patient.id

        for c in rec["conditions"]:
            db.add(Condition(
                patient_id=patient.id,
                name=c["name"],
                icd10_code=c["code"],
                diagnosed_date=_parse_date(c["diagnosed_date"]),
                active=c["active"],
            ))

        for v in rec["visits"]:
            db.add(Visit(
                patient_id=patient.id,
                visit_date=_parse_date(v["visit_date"]),
                reason=v["reason"],
                notes="",
            ))

        for lab in rec["labs"]:
            db.add(LabResult(
                patient_id=patient.id,
                test_name=lab["test_name"],
                value=lab["value"],
                unit=lab["unit"],
                reference_range=lab["reference_range"],
                result_date=_parse_date(lab["result_date"]),
                abnormal=lab["abnormal"],
            ))

        for rx in rec["prescriptions"]:
            db.add(Prescription(
                patient_id=patient.id,
                medication=rx["medication"],
                dosage=rx["dosage"],
                frequency=rx["frequency"],
                start_date=_parse_date(rx["start_date"]),
                end_date=_parse_date(rx["end_date"]) if rx["end_date"] else None,
            ))

    db.commit()
    print(f"Seeded {len(data)} real Synthea patients with visits/conditions/labs/prescriptions.")


def seed_all_patient_logins(db):
    """
    Give every seeded patient a login too (not just the one 'demo patient'
    account), so any of the 250 real Synthea records can be signed into
    directly for a demo. Same dev password for all of them — this is a
    local/demo convenience, not how you'd provision real patient accounts.
    Writes the full list to scripts/data/patient_logins.csv so any
    patient_ref can be looked up.
    """
    linked_ids = {pid for (pid,) in db.query(User.patient_id).filter(User.patient_id.isnot(None))}
    unlinked = (
        db.query(Patient)
        .filter(Patient.id.notin_(linked_ids) if linked_ids else True)
        .order_by(Patient.id)
        .all()
    )
    for patient in unlinked:
        email = f"{patient.patient_ref.lower()}@medisight.dev"
        db.add(User(
            email=email,
            full_name=f"Demo Patient {patient.patient_ref}",
            hashed_password=hash_password("Patient123!"),
            role=UserRole.PATIENT,
            patient_id=patient.id,
        ))
    if unlinked:
        db.commit()
        print(f"Seeded logins for {len(unlinked)} more patients (password Patient123! for all).")
    else:
        print("Every patient already has a login, skipping.")

    # Full lookup table, written every run so it always matches the DB.
    all_linked = (
        db.query(User, Patient)
        .join(Patient, Patient.id == User.patient_id)
        .filter(User.role == UserRole.PATIENT)
        .order_by(Patient.patient_ref)
        .all()
    )
    logins_path = Path(__file__).parent / "data" / "patient_logins.csv"
    # Do not rewrite a checked-in dataset/lookup file during a normal app run.
    # The packaged patient_logins.csv is intentionally preserved byte-for-byte.
    # To explicitly regenerate a local lookup file, set REBUILD_PATIENT_LOGIN_CSV=1.
    import os
    if os.getenv("REBUILD_PATIENT_LOGIN_CSV") == "1":
        with open(logins_path, "w", newline="", encoding="utf-8") as f:
            f.write("patient_ref,email,password,full_name\n")
            for user, patient in all_linked:
                password = "Patient123!"  # same for every seeded login
                f.write(f"{patient.patient_ref},{user.email},{password},{user.full_name}\n")
        print(f"Full patient login list ({len(all_linked)} rows) regenerated at {logins_path}")
    else:
        print(f"Preserved existing patient login data file: {logins_path}")


def main():
    Base.metadata.create_all(bind=engine)
    upgrade_for_patient_role(engine)  # older dev databases predate the patient role
    db = SessionLocal()
    try:
        seed_users(db)
        seed_patients(db)
        seed_demo_patient_user(db)
        seed_all_patient_logins(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
