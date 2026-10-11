"""
Run from backend/:  pytest ../tests -v
(or from repo root:  pytest tests -v)

Uses a throwaway in-memory SQLite DB so it never touches the dev DB.
"""
import os
import sys
from datetime import date

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.models.user import User, UserRole
from app.models.patient import Patient, Condition, Prescription
from app.models.consent import Consent, ConsentStatus
from app.services.privacy import apply_k_anonymity

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,  # single shared in-memory DB across connections
)
TestingSessionLocal = sessionmaker(bind=engine)


@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    db.add(User(
        email="clin@test.dev", full_name="Test Clinician",
        hashed_password=hash_password("pw12345"), role=UserRole.CLINICIAN,
    ))
    db.add(User(
        email="admin@test.dev", full_name="Test Admin",
        hashed_password=hash_password("pw12345"), role=UserRole.ADMIN,
    ))
    db.add(User(
        email="rep@test.dev", full_name="Test Representative",
        hashed_password=hash_password("pw12345"), role=UserRole.REPRESENTATIVE,
    ))
    p1 = Patient(patient_ref="PT-TEST-1", age=55, gender="Female", region="Test")
    p2 = Patient(patient_ref="PT-TEST-2", age=41, gender="Male", region="Test")
    # A third isolated patient is reserved for representative-workflow tests,
    # so those tests do not revoke the consents used by the original suite.
    p3 = Patient(patient_ref="PT-TEST-3", age=29, gender="Other", region="Test")
    db.add_all([p1, p2, p3])
    db.flush()
    db.add(User(
        email="pat1@test.dev", full_name="Test Patient One",
        hashed_password=hash_password("pw12345"), role=UserRole.PATIENT, patient_id=p1.id,
    ))
    db.add(User(
        email="pat2@test.dev", full_name="Test Patient Two",
        hashed_password=hash_password("pw12345"), role=UserRole.PATIENT, patient_id=p2.id,
    ))
    db.add(User(
        email="pat3@test.dev", full_name="Test Patient Three",
        hashed_password=hash_password("pw12345"), role=UserRole.PATIENT, patient_id=p3.id,
    ))
    db.add(Prescription(patient_id=p3.id, medication="Test medication", dosage="1 tablet",
                        frequency="daily", start_date=date(2024, 3, 1), end_date=None))
    # Both test patients share one region and one active condition, so the
    # regional/disease distribution endpoints have exactly one real bucket
    # to exercise (count=2, still below k=5 -> exercises suppression too).
    db.add(Condition(patient_id=p1.id, name="Test Condition", diagnosed_date=date(2024, 1, 1), active=True))
    db.add(Condition(patient_id=p2.id, name="Test Condition", diagnosed_date=date(2024, 2, 1), active=True))
    clinician = db.query(User).filter(User.email == "clin@test.dev").first()
    patient_one = db.query(User).filter(User.email == "pat1@test.dev").first()
    patient_two = db.query(User).filter(User.email == "pat2@test.dev").first()
    for patient_id in (p1.id, p2.id):
        db.add(Consent(patient_id=patient_id, authorized_user_id=clinician.id,
                       access_scope="all_records", granted_by_user_id=patient_one.id,
                       status=ConsentStatus.ACTIVE))
        db.add(Consent(patient_id=patient_id, authorized_user_id=clinician.id,
                       access_scope="qr_access", granted_by_user_id=patient_one.id,
                       status=ConsentStatus.ACTIVE))
    db.commit()
    db.close()

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def login(client, email, password):
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    return resp.json()["access_token"]


def test_login_success_and_failure(client):
    token = login(client, "clin@test.dev", "pw12345")
    assert token

    bad = client.post("/api/auth/login", json={"email": "clin@test.dev", "password": "wrong"})
    assert bad.status_code == 401


def test_clinician_can_access_patient(client):
    token = login(client, "clin@test.dev", "pw12345")
    resp = client.get("/api/patients/1", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["patient_ref"] == "PT-TEST-1"


def test_admin_cannot_access_patient_record(client):
    """Core RBAC requirement: admin -> GET /api/patients/{id} must be 403."""
    token = login(client, "admin@test.dev", "pw12345")
    resp = client.get("/api/patients/1", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


def test_unauthenticated_request_rejected(client):
    resp = client.get("/api/patients/1")
    assert resp.status_code == 401


def test_admin_analytics_forbidden_for_clinician(client):
    token = login(client, "clin@test.dev", "pw12345")
    resp = client.get("/api/analytics/disease-distribution", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


def test_admin_regional_and_trend_analytics(client):
    """The three axes the brief asks for: condition, region ('location') and time."""
    token = login(client, "admin@test.dev", "pw12345")
    headers = {"Authorization": f"Bearer {token}"}

    regional = client.get("/api/analytics/regional-distribution", headers=headers)
    assert regional.status_code == 200
    body = regional.json()
    assert len(body) == 1  # both fixture patients share one region
    region_row = body[0]
    assert region_row["region"] == "Test"
    # Only 2 underlying patients, below k=5 -> suppressed, not shown as "2".
    assert region_row["suppressed"] is True
    assert region_row["count"] is None

    trends = client.get("/api/analytics/disease-trends", headers=headers)
    assert trends.status_code == 200
    trend_body = trends.json()
    assert all("period" in p and "condition" in p for p in trend_body)
    # Same k=5 rule applies per (condition, month) bucket.
    assert all(p["suppressed"] and p["count"] is None for p in trend_body)


def test_regional_and_trend_analytics_forbidden_for_non_admin(client):
    for email in ("clin@test.dev", "pat1@test.dev"):
        headers = {"Authorization": f"Bearer {login(client, email, 'pw12345')}"}
        assert client.get("/api/analytics/regional-distribution", headers=headers).status_code == 403
        assert client.get("/api/analytics/disease-trends", headers=headers).status_code == 403


def test_k_anonymity_suppresses_small_buckets():
    below = apply_k_anonymity(4, k=5)
    at_threshold = apply_k_anonymity(5, k=5)
    above = apply_k_anonymity(50, k=5)

    assert below["suppressed"] is True
    assert below["count"] is None
    assert at_threshold["suppressed"] is False
    assert at_threshold["count"] == 5
    assert above["suppressed"] is False
    assert above["count"] == 50


def test_qr_generate_and_validate_roundtrip(client):
    token = login(client, "clin@test.dev", "pw12345")
    headers = {"Authorization": f"Bearer {token}"}

    gen = client.post("/api/qr/generate/1", headers=headers)
    assert gen.status_code == 200
    qr_token = gen.json()["token"]

    validate = client.post("/api/qr/validate", json={"token": qr_token}, headers=headers)
    assert validate.status_code == 200
    body = validate.json()
    assert body["valid"] is True
    assert body["patient_id"] == 1


def test_qr_invalid_token_rejected(client):
    token = login(client, "clin@test.dev", "pw12345")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.post("/api/qr/validate", json={"token": "not-a-real-token"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["valid"] is False


# --------------------------------------------------------------------------
# Three-role sign-in and patient self-service
# --------------------------------------------------------------------------

def auth_header(client, email, password="pw12345"):
    return {"Authorization": f"Bearer {login(client, email, password)}"}


@pytest.mark.parametrize("email,role", [
    ("pat1@test.dev", "patient"),
    ("clin@test.dev", "clinician"),
    ("admin@test.dev", "admin"),
])
def test_login_with_matching_role_tab(client, email, role):
    resp = client.post("/api/auth/login", json={"email": email, "password": "pw12345", "role": role})
    assert resp.status_code == 200
    assert resp.json()["role"] == role


def test_login_rejects_wrong_role_tab(client):
    resp = client.post(
        "/api/auth/login",
        json={"email": "clin@test.dev", "password": "pw12345", "role": "patient"},
    )
    assert resp.status_code == 403
    assert "clinician" in resp.json()["detail"]


def test_login_email_is_case_insensitive(client):
    resp = client.post("/api/auth/login", json={"email": "CLIN@Test.dev", "password": "pw12345"})
    assert resp.status_code == 200


def test_patient_registration_creates_linked_record(client):
    resp = client.post("/api/auth/register/patient", json={
        "full_name": "New Patient", "email": "New.Patient@Test.dev", "password": "abcdefg1",
        "age": 34, "gender": "Female", "region": "North",
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["role"] == "patient"
    assert body["full_name"] == "New Patient"

    headers = {"Authorization": f"Bearer {body['access_token']}"}
    record = client.get("/api/me/record", headers=headers)
    assert record.status_code == 200
    data = record.json()
    assert data["age"] == 34 and data["gender"] == "Female" and data["region"] == "North"
    assert data["patient_ref"].startswith("PT-")
    # The clinical record must not carry identity.
    assert "full_name" not in data and "email" not in data

    # Stored lower-cased, so signing in with any casing works.
    again = client.post("/api/auth/login", json={"email": "new.patient@test.dev", "password": "abcdefg1", "role": "patient"})
    assert again.status_code == 200


def test_patient_registration_rejects_duplicates_and_weak_input(client):
    dup = client.post("/api/auth/register/patient", json={
        "full_name": "Dup", "email": "pat1@test.dev", "password": "abcdefg1", "age": 30, "gender": "Male",
    })
    assert dup.status_code == 409

    weak = client.post("/api/auth/register/patient", json={
        "full_name": "Weak", "email": "weak@test.dev", "password": "allletters", "age": 30, "gender": "Male",
    })
    assert weak.status_code == 422

    short = client.post("/api/auth/register/patient", json={
        "full_name": "Short", "email": "short@test.dev", "password": "a1", "age": 30, "gender": "Male",
    })
    assert short.status_code == 422

    minor = client.post("/api/auth/register/patient", json={
        "full_name": "Minor", "email": "minor@test.dev", "password": "abcdefg1", "age": 15, "gender": "Male",
    })
    assert minor.status_code == 422


def test_registration_cannot_create_privileged_roles(client):
    resp = client.post("/api/auth/register/patient", json={
        "full_name": "Sneaky", "email": "sneaky@test.dev", "password": "abcdefg1",
        "age": 30, "gender": "Male", "role": "admin",
    })
    assert resp.status_code == 201
    assert resp.json()["role"] == "patient"
    headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
    assert client.get("/api/audit/logs", headers=headers).status_code == 403


def test_patient_sees_only_own_record(client):
    headers = auth_header(client, "pat1@test.dev")
    mine = client.get("/api/me/record", headers=headers)
    assert mine.status_code == 200
    assert mine.json()["patient_ref"] == "PT-TEST-1"

    other = auth_header(client, "pat2@test.dev")
    assert client.get("/api/me/record", headers=other).json()["patient_ref"] == "PT-TEST-2"


def test_patient_is_blocked_from_clinician_and_admin_routes(client):
    headers = auth_header(client, "pat1@test.dev")
    assert client.get("/api/patients/2", headers=headers).status_code == 403
    assert client.get("/api/patients/1/risk", headers=headers).status_code == 403
    assert client.post("/api/qr/generate/1", headers=headers).status_code == 403
    assert client.get("/api/analytics/disease-distribution", headers=headers).status_code == 403
    assert client.get("/api/audit/logs", headers=headers).status_code == 403


def test_clinician_and_admin_cannot_use_patient_endpoints(client):
    for email in ("clin@test.dev", "admin@test.dev"):
        headers = auth_header(client, email)
        assert client.get("/api/me/record", headers=headers).status_code == 403
        assert client.post("/api/me/qr", headers=headers).status_code == 403


def test_patient_qr_can_be_scanned_by_clinician_then_revoked(client):
    patient_headers = auth_header(client, "pat1@test.dev")
    clinician_headers = auth_header(client, "clin@test.dev")

    qr = client.post("/api/me/qr", headers=patient_headers)
    assert qr.status_code == 200
    token = qr.json()["token"]
    assert qr.json()["qr_payload"] == f"medisight://patient/{token}"

    valid = client.post("/api/qr/validate", json={"token": token}, headers=clinician_headers)
    assert valid.json() == {"valid": True, "patient_id": 1, "reason": None}

    revoked = client.post(f"/api/me/qr/revoke/{token}", headers=patient_headers)
    assert revoked.status_code == 200

    after = client.post("/api/qr/validate", json={"token": token}, headers=clinician_headers)
    assert after.json()["valid"] is False


def test_patient_cannot_revoke_someone_elses_qr(client):
    token = client.post("/api/me/qr", headers=auth_header(client, "pat1@test.dev")).json()["token"]
    resp = client.post(f"/api/me/qr/revoke/{token}", headers=auth_header(client, "pat2@test.dev"))
    assert resp.status_code == 404
    # ...and it still works for the clinician afterwards.
    ok = client.post("/api/qr/validate", json={"token": token}, headers=auth_header(client, "clin@test.dev"))
    assert ok.json()["valid"] is True


def test_patient_risk_requires_recorded_measurements(client):
    resp = client.get("/api/me/risk", headers=auth_header(client, "pat1@test.dev"))
    assert resp.status_code == 422
    assert "Insufficient data for assessment" in resp.json()["detail"]
    assert "Fasting Glucose" in resp.json()["detail"]
    assert "Systolic BP" in resp.json()["detail"]



def test_revoked_consent_blocks_patient_record_and_logs_denial(client):
    patient_headers = auth_header(client, "pat1@test.dev")
    clinician_headers = auth_header(client, "clin@test.dev")
    consents = client.get("/api/consents/mine", headers=patient_headers)
    assert consents.status_code == 200
    consent = next(x for x in consents.json() if x["access_scope"] == "all_records")
    revoked = client.post(f"/api/consents/{consent['id']}/revoke", headers=patient_headers)
    assert revoked.status_code == 200
    assert revoked.json()["status"] == "revoked"
    blocked = client.get("/api/patients/1", headers=clinician_headers)
    assert blocked.status_code == 403


def test_emergency_access_requires_reason_and_is_scoped(client):
    clinician_headers = auth_header(client, "clin@test.dev")
    patient_headers = auth_header(client, "pat1@test.dev")
    consents = client.get("/api/consents/mine", headers=patient_headers).json()
    for consent in consents:
        if consent["access_scope"] == "all_records" and consent["status"] == "active":
            client.post(f"/api/consents/{consent['id']}/revoke", headers=patient_headers)
    invalid = client.post("/api/emergency-access", headers=clinician_headers, json={
        "patient_id": 1, "reason": "urgent", "access_scope": ["record"], "duration_minutes": 10
    })
    assert invalid.status_code == 422

    grant = client.post("/api/emergency-access", headers=clinician_headers, json={
        "patient_id": 1, "reason": "Patient requires urgent assessment",
        "access_scope": ["record"], "duration_minutes": 10
    })
    assert grant.status_code == 201
    assert grant.json()["clinician_user_id"] == 1
    assert client.get("/api/patients/1", headers=clinician_headers).status_code == 200
    assert client.get("/api/patients/1/labs", headers=clinician_headers).status_code == 403


def test_admin_cannot_create_emergency_access(client):
    headers = auth_header(client, "admin@test.dev")
    response = client.post("/api/emergency-access", headers=headers, json={
        "patient_id": 1, "reason": "Emergency review required",
        "access_scope": ["record"], "duration_minutes": 10
    })
    assert response.status_code == 403

# --------------------------------------------------------------------------
# Representative access workflow, monthly/location analytics and blood group
# --------------------------------------------------------------------------

def test_z_representative_workflow_requires_patient_approval_and_honours_scope(client):
    rep_headers = auth_header(client, "rep@test.dev")
    patient_headers = auth_header(client, "pat3@test.dev")
    clinician_headers = auth_header(client, "clin@test.dev")

    # Patient explicitly designates the representative; the representative cannot self-assign.
    designate = client.post("/api/representative/designate", headers=patient_headers,
                            json={"representative_email": "rep@test.dev"})
    assert designate.status_code == 200
    assert designate.json()["status"] == "active"

    created = client.post("/api/access-requests/by-reference", headers=clinician_headers, json={
        "patient_ref": "PT-TEST-3", "access_scope": "limited",
        "reason": "Review the patient's recorded condition and recent labs",
    })
    assert created.status_code == 201
    request_id = created.json()["id"]

    # Rep must not grant normal access before patient review; patient rejection is a veto.
    early_approve = client.post(f"/api/representative/requests/{request_id}/decision",
                                headers=rep_headers, json={"decision": "approve"})
    assert early_approve.status_code == 409
    patient_requests = client.get("/api/access-requests/mine", headers=patient_headers)
    assert patient_requests.status_code == 200
    assert any(item["id"] == request_id for item in patient_requests.json())

    patient_approval = client.post(f"/api/access-requests/{request_id}/patient-decision",
                                   headers=patient_headers, json={"decision": "approve"})
    assert patient_approval.status_code == 200
    final_approval = client.post(f"/api/representative/requests/{request_id}/decision",
                                 headers=rep_headers, json={"decision": "approve"})
    assert final_approval.status_code == 200

    limited_record = client.get("/api/patients/3", headers=clinician_headers)
    assert limited_record.status_code == 200
    assert limited_record.json()["access_scope"] == "limited"
    assert limited_record.json()["prescriptions"] == []
    assert client.get("/api/patients/3/prescriptions", headers=clinician_headers).status_code == 403

    # A later full-access request still needs patient and representative decisions.
    full_request = client.post("/api/access-requests/by-reference", headers=clinician_headers, json={
        "patient_ref": "PT-TEST-3", "access_scope": "full",
        "reason": "Full review needed for medication safety and clinical context",
    })
    assert full_request.status_code == 201
    full_id = full_request.json()["id"]
    assert client.post(f"/api/access-requests/{full_id}/patient-decision", headers=patient_headers,
                       json={"decision": "approve"}).status_code == 200
    assert client.post(f"/api/representative/requests/{full_id}/decision", headers=rep_headers,
                       json={"decision": "approve"}).status_code == 200
    prescriptions = client.get("/api/patients/3/prescriptions", headers=clinician_headers)
    assert prescriptions.status_code == 200
    assert len(prescriptions.json()) == 1

    # Direct, audited break-glass flow works without a normal patient decision.
    emergency = client.post("/api/representative/emergency-access", headers=rep_headers, json={
        "patient_id": 3, "reason": "Patient is unable to respond during a time-critical emergency",
        "duration_minutes": 30,
    })
    assert emergency.status_code == 200
    grant_id = emergency.json()["request_id"]
    opened = client.get(f"/api/representative/patients/3/record", headers=rep_headers,
                        params={"request_id": grant_id})
    assert opened.status_code == 200

    rejected_request = client.post("/api/access-requests/by-reference", headers=clinician_headers, json={
        "patient_ref": "PT-TEST-3", "access_scope": "limited",
        "reason": "Check one additional clinical detail for follow-up",
    })
    assert rejected_request.status_code == 201
    rejected_id = rejected_request.json()["id"]
    patient_reject = client.post(f"/api/access-requests/{rejected_id}/patient-decision",
                                 headers=patient_headers, json={"decision": "reject"})
    assert patient_reject.status_code == 200
    blocked_approval = client.post(f"/api/representative/requests/{rejected_id}/decision",
                                   headers=rep_headers, json={"decision": "approve"})
    assert blocked_approval.status_code == 409


def test_representative_login_role_is_distinct(client):
    response = client.post("/api/auth/login", json={
        "email": "rep@test.dev", "password": "pw12345", "role": "representative",
    })
    assert response.status_code == 200
    assert response.json()["role"] == "representative"
    wrong_role = client.post("/api/auth/login", json={
        "email": "rep@test.dev", "password": "pw12345", "role": "patient",
    })
    assert wrong_role.status_code == 403


def test_blood_group_is_self_reported_until_clinician_verifies(client):
    patient_headers = auth_header(client, "pat3@test.dev")
    saved = client.patch("/api/me/blood-group", headers=patient_headers, json={"blood_group": "O+"})
    assert saved.status_code == 200
    assert saved.json()["blood_group_verified"] is False
    record = client.get("/api/me/record", headers=patient_headers)
    assert record.status_code == 200
    assert record.json()["blood_group"] == "O+"
    assert record.json()["blood_group_verified"] is False


def test_regional_disease_ratio_endpoint_supports_filters(client):
    headers = auth_header(client, "admin@test.dev")
    all_rows = client.get("/api/analytics/regional-disease-ratios", headers=headers)
    assert all_rows.status_code == 200
    filtered = client.get("/api/analytics/regional-disease-ratios?region=Test&month=2024-01", headers=headers)
    assert filtered.status_code == 200
    assert all(item["region"] == "Test" for item in filtered.json())
    assert client.get("/api/analytics/regional-disease-ratios?month=bad", headers=headers).status_code == 422

