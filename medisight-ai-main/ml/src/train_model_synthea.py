"""
Train the MediSight risk model on REAL Synthea data (30,921 patients across
pop1 + pop2), instead of the 100-patient Faker dev seed.

Drop this file into ml/src/ alongside the existing train_model.py, and put
synthea_features.csv into ml/data/.

WHAT CHANGED vs the original train_model.py
---------------------------------------------
- Data source: reads ml/data/synthea_features.csv (pre-extracted from the
  two Synthea CSV exports) instead of querying the Postgres `patients` table
  seeded by scripts/seed_data.py (Faker, n=100).
- Label: no more heuristic-score-plus-noise. The label here is a REAL
  observed outcome from the Synthea simulation: for each patient we cut
  their encounter history at ~70% of the way through, compute features from
  everything up to that point, and label = 1 if that patient went on to
  have an INPATIENT or EMERGENCY encounter afterwards. That's a genuine
  forward-looking prediction target, not a fabricated score.
- Everything else (feature set, XGBoost config, train/test split, metrics,
  SHAP-readiness, joblib output) is unchanged and stays wire-compatible
  with app/ml/features.py and app/services/risk_service.py, so the API
  inference path doesn't need to change at all.

Run from repo root:  python -m ml.src.train_model_synthea
"""
import json
import os
import sys
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    roc_auc_score, accuracy_score, precision_score, recall_score, f1_score,
)
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

# Make `app.*` importable when run from repo root (same convention as train_model.py).
BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "backend")
sys.path.insert(0, os.path.abspath(BACKEND_DIR))

from app.ml.features import FEATURE_NAMES  # noqa: E402  single source of truth, unchanged

np.random.seed(42)

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "synthea_features.csv")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "risk_model.joblib")
METADATA_PATH = os.path.join(MODEL_DIR, "model_metadata.json")


def main():
    os.makedirs(MODEL_DIR, exist_ok=True)

    if not os.path.exists(DATA_PATH):
        raise RuntimeError(
            f"{DATA_PATH} not found. Run ml/src/build_synthea_features.py first "
            "(reads the two Synthea CSV zips and writes synthea_features.csv)."
        )

    df = pd.read_csv(DATA_PATH)
    print(f"Loaded {len(df)} real Synthea patients "
          f"({df['population'].nunique()} populations)")
    print(f"Label balance: {df['label'].sum()} positive / "
          f"{len(df) - df['label'].sum()} negative "
          f"({100*df['label'].mean():.1f}% positive)")

    X = df[FEATURE_NAMES]
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    n_pos = max(int(y_train.sum()), 1)
    n_neg = max(len(y_train) - n_pos, 1)
    scale_pos_weight = n_neg / n_pos

    model = XGBClassifier(
        n_estimators=150,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.9,
        colsample_bytree=0.9,
        eval_metric="logloss",
        scale_pos_weight=scale_pos_weight,
        random_state=42,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": round(accuracy_score(y_test, y_pred), 4),
        "precision": round(precision_score(y_test, y_pred, zero_division=0), 4),
        "recall": round(recall_score(y_test, y_pred, zero_division=0), 4),
        "f1": round(f1_score(y_test, y_pred, zero_division=0), 4),
        "roc_auc": round(roc_auc_score(y_test, y_proba), 4) if y_test.nunique() > 1 else None,
        "n_train": len(X_train),
        "n_test": len(X_test),
    }
    print("Held-out test metrics (real data, real forward-looking label):")
    for k, v in metrics.items():
        print(f"  {k}: {v}")

    joblib.dump(model, MODEL_PATH)

    metadata = {
        "version": f"xgb-synthea-v1-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "feature_names": FEATURE_NAMES,
        "metrics": metrics,
        "dataset": (
            "synthea-30921 (pop1 + pop2, Synthea-generated synthetic patients; "
            "label = real Synthea encounter history, future inpatient/ER "
            "utilization, not a fabricated heuristic)"
        ),
        "n_samples": len(df),
    }
    with open(METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"\nSaved model to {MODEL_PATH}")
    print(f"Saved metadata to {METADATA_PATH}")


if __name__ == "__main__":
    main()
