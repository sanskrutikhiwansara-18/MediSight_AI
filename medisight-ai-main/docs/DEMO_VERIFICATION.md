# Demo verification log

This is the actual output from running the backend live and exercising the
full demo flow, captured during development of this MVP (not hand-written /
fabricated). Reproduce it yourself with:

```bash
cd backend && python -m scripts.seed_data
cd .. && python -m ml.src.train_model
cd backend && uvicorn app.main:app --port 8000
```

## Model training (real held-out evaluation)

```
Training frame: 100 patients, 30 positive / 70 negative
Held-out test metrics (on synthetic labels — see ml/src/train_model.py docstring):
  accuracy: 0.8
  precision: 0.6667
  recall: 0.5714
  f1: 0.6154
  roc_auc: 0.8095
  n_train: 75
  n_test: 25

Saved model to ml/models/risk_model.joblib
Saved metadata to ml/models/model_metadata.json
```

## API flow (curl, real responses)

**1–2. Login as clinician and admin** — both return a JWT + role.

**3. Clinician generates a QR for patient 1**
```
token: -hVTiMH_M1fzFnKe6lwP
payload: medisight://patient/-hVTiMH_M1fzFnK
image b64 len: 1276
```

**4. Clinician validates the scanned token**
```json
{"valid":true,"patient_id":1,"reason":null}
```

**5. Clinician fetches the patient record** — returns full profile
(conditions, visits, labs, prescriptions).

**6. Clinician runs the risk model**
```json
{
  "risk_score": 0.0009,
  "risk_level": "LOW",
  "model_version": "xgb-v1-20260919145031",
  "shap_explanation": [
    {"feature": "age", "value": 32.0, "shap_value": -2.085461378097534},
    {"feature": "latest_glucose", "value": 90.0, "shap_value": -1.1231424808502197},
    {"feature": "num_active_conditions", "value": 1.0, "shap_value": -1.0552223920822144},
    {"feature": "num_visits_last_year", "value": 5.0, "shap_value": -0.7545788884162903},
    {"feature": "has_heart_disease", "value": 0.0, "shap_value": -0.5245398879051208},
    {"feature": "num_prescriptions", "value": 2.0, "shap_value": -0.38316667079925537}
  ],
  "disclaimer": "This is AI-generated decision support, not a diagnosis. Clinical judgment must confirm any action taken."
}
```

**7. Admin attempts `GET /api/patients/1`**
```
HTTP_STATUS:403
{"detail":"You do not have permission to access this resource"}
```

**8. Admin fetches disease distribution** (100-patient dev dataset, so
every condition happens to clear k=5 — see `test_k_anonymity_suppresses_small_buckets`
in `tests/test_api.py` for a direct unit test of the suppression path at,
above, and below the threshold):
```json
[
  {"condition": "Asthma", "count": 18, "suppressed": false, "reason": null},
  {"condition": "Chronic Kidney Disease Stage 2", "count": 20, "suppressed": false, "reason": null},
  {"condition": "Coronary Artery Disease", "count": 18, "suppressed": false, "reason": null},
  {"condition": "Essential Hypertension", "count": 16, "suppressed": false, "reason": null},
  {"condition": "Hyperlipidemia", "count": 19, "suppressed": false, "reason": null},
  {"condition": "Hypothyroidism", "count": 16, "suppressed": false, "reason": null},
  {"condition": "Major Depressive Disorder", "count": 13, "suppressed": false, "reason": null},
  {"condition": "Obesity", "count": 15, "suppressed": false, "reason": null},
  {"condition": "Osteoarthritis", "count": 23, "suppressed": false, "reason": null},
  {"condition": "Type 2 Diabetes Mellitus", "count": 13, "suppressed": false, "reason": null}
]
```

**9. Audit log** (most recent entries) — confirms every step above was
recorded, including the denied admin access:
```json
[
  {"action": "ADMIN_ANALYTICS_REQUEST", "actor_role": "admin", "resource": "disease-distribution", "success": true},
  {"action": "UNAUTHORIZED_ACCESS", "actor_role": "admin", "resource": "/api/patients/1", "success": false, "detail": "Role 'admin' not permitted for this route"},
  {"action": "RISK_PREDICTION", "actor_role": "clinician", "resource": "patient:1", "success": true, "detail": "risk_level=LOW"},
  {"action": "PATIENT_RECORD_ACCESS", "actor_role": "clinician", "resource": "patient:1", "success": true},
  {"action": "QR_ACCESS", "actor_role": "clinician", "resource": "patient:1", "success": true},
  {"action": "QR_GENERATED", "actor_role": "clinician", "resource": "patient:1", "success": true},
  {"action": "LOGIN_SUCCESS", "actor_role": "admin", "resource": "user:admin@medisight.dev", "success": true},
  {"action": "LOGIN_SUCCESS", "actor_role": "clinician", "resource": "user:clinician@medisight.dev", "success": true}
]
```

## Automated tests

```
tests/test_api.py::test_login_success_and_failure PASSED
tests/test_api.py::test_clinician_can_access_patient PASSED
tests/test_api.py::test_admin_cannot_access_patient_record PASSED
tests/test_api.py::test_unauthenticated_request_rejected PASSED
tests/test_api.py::test_admin_analytics_forbidden_for_clinician PASSED
tests/test_api.py::test_k_anonymity_suppresses_small_buckets PASSED
tests/test_api.py::test_qr_generate_and_validate_roundtrip PASSED
tests/test_api.py::test_qr_invalid_token_rejected PASSED

8 passed
```

## Frontend

`npm run build` completes cleanly (`vite build`, 899 modules transformed,
no errors). The dev server was also started and confirmed to serve
`index.html` on `http://127.0.0.1:5173/`.
