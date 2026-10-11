"""
Tiny, idempotent schema upgrades for existing dev databases.

`Base.metadata.create_all` only creates missing TABLES; it never alters an
existing one. Databases created before the patient role existed therefore
need two small changes. Real deployments should use Alembic instead
(alembic is already in requirements.txt).
"""
import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

log = logging.getLogger("medisight.migrations")


def upgrade_for_patient_role(engine: Engine) -> None:
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return  # fresh database: create_all already built the new schema

    # 1) users.patient_id (links a patient login to its clinical record)
    columns = {c["name"] for c in inspector.get_columns("users")}
    if "patient_id" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN patient_id INTEGER REFERENCES patients(id)"))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_patient_id ON users (patient_id)"))
        log.info("Added users.patient_id")

    # 2) Add nullable patient blood group fields without touching existing patient rows.
    patient_columns = {c["name"] for c in inspector.get_columns("patients")} if "patients" in inspector.get_table_names() else set()
    if "patients" in inspector.get_table_names():
        with engine.begin() as conn:
            if "blood_group" not in patient_columns:
                conn.execute(text("ALTER TABLE patients ADD COLUMN blood_group VARCHAR(3) NULL"))
                log.info("Added patients.blood_group")
            if "blood_group_verified" not in patient_columns:
                default_value = "FALSE" if engine.dialect.name == "postgresql" else "0"
                conn.execute(text(f"ALTER TABLE patients ADD COLUMN blood_group_verified BOOLEAN NOT NULL DEFAULT {default_value}"))
                log.info("Added patients.blood_group_verified")

    # 3) PostgreSQL stores UserRole as a native ENUM that needs new values.
    #    SQLite stores it as plain text, so nothing to do there.
    if engine.dialect.name == "postgresql":
        try:
            with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
                conn.execute(text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'PATIENT'"))
                conn.execute(text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'REPRESENTATIVE'"))
        except Exception as exc:  # pragma: no cover - depends on the deployment
            log.warning("Could not extend userrole enum automatically: %s", exc)
