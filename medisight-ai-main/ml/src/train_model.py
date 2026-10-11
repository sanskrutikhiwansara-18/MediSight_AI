"""
Train the MediSight risk model.

IMPORTANT / HONESTY NOTE
-------------------------
The seeded dev dataset (scripts/seed_data.py) is synthetic and carries no
real clinical outcomes. To have anything to train against, this script
derives a *synthetic* "elevated risk" label from a documented clinical
heuristic (see `synthetic_risk_label` below) plus random noise, purely so
the ML pipeline (train/test split -> XGBoost -> real evaluation -> SHAP) is
fully wired end-to-end and demoable.

The accuracy/AUC numbers this prints and saves are REAL, computed on a held
-out test split of THIS synthetic dataset — they are not fabricated. But
they say nothing about real-world clinical performance, because the labels
are not real. Before this touches real patients (e.g. MIMIC-IV, Phase 2),
retrain against real outcome labels and re-validate.

Run from repo root:  python -m ml.src.train_model
"""
import json
import os
import random
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

# Make `app.*` importable when run from repo root.
BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "backend")
sys.path.insert(0, os.path.abspath(BACKEND_DIR))

from app.core.database import SessionLocal  # noqa: E402
from app.models.patient import Patient  # noqa: E402
from app.ml.features import FEATURE_NAMES, build_feature_row  # noqa: E402
from app.services.risk_service import RiskService  # noqa: E402

random.seed(42)
np.random.seed(42)

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "risk_model.joblib")
METADATA_PATH = os.path.join(MODEL_DIR, "model_metadata.json")


def synthetic_risk_score(row: dict) -> float:
    """
    Deterministic clinical heuristic + noise, used ONLY because the dev
    dataset has no real outcomes. Weighted toward known real-world risk
    factors (age, multimorbidity, poor glycemic/BP control) so the model
    has genuine, learnable signal rather than pure noise.
    """
    score = 0.0
    score += 0.02 * max(row["age"] - 40, 0)
    score += 0.15 * row["num_active_conditions"]
    score += 0.20 * row["has_diabetes"]
    score += 0.15 * row["has_hypertension"]
    score += 0.25 * row["has_heart_disease"]
    score += 0.10 * row["abnormal_lab_ratio"]
    score += 0.01 * max(row["latest_glucose"] - 100, 0)
    score += 0.02 * max(row["latest_systolic_bp"] - 130, 0)
    score += np.random.normal(0, 0.6)  # noise so it's not a trivial rule
    return score


def build_training_frame() -> pd.DataFrame:
    db = SessionLocal()
    try:
        patients = db.query(Patient).all()
        if not patients:
            raise RuntimeError(
                "No patients in the database. Run `python -m scripts.seed_data` "
                "from backend/ first."
            )
        rows = []
        for p in patients:
            record = RiskService.summarize_patient_for_model(db, p)
            feature_row = build_feature_row(record)
            feature_row["_risk_score"] = synthetic_risk_score(feature_row)
            rows.append(feature_row)

        df = pd.DataFrame(rows, columns=FEATURE_NAMES + ["_risk_score"])
        # Label the top ~30% by synthetic risk score as "elevated risk".
        # Using a percentile cut (rather than a fixed constant) keeps the
        # class balance stable regardless of exactly how the random dev
        # dataset was seeded, so training isn't at the mercy of one lucky
        # or unlucky draw.
        cutoff = df["_risk_score"].quantile(0.70)
        df["label"] = (df["_risk_score"] > cutoff).astype(int)
        return df.drop(columns=["_risk_score"])
    finally:
        db.close()


def main():
    os.makedirs(MODEL_DIR, exist_ok=True)

    df = build_training_frame()
    print(f"Training frame: {len(df)} patients, "
          f"{df['label'].sum()} positive / {len(df) - df['label'].sum()} negative")

    X = df[FEATURE_NAMES]
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y if y.nunique() > 1 else None
    )

    # Class imbalance is expected (elevated-risk patients are a minority);
    # weight positives up rather than let the model default to "always low risk".
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
    print("Held-out test metrics (on synthetic labels — see module docstring):")
    for k, v in metrics.items():
        print(f"  {k}: {v}")

    joblib.dump(model, MODEL_PATH)

    metadata = {
        "version": f"xgb-v1-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "feature_names": FEATURE_NAMES,
        "metrics": metrics,
        "dataset": "synthetic-dev-v1 (NOT real patient outcomes; see script docstring)",
        "n_samples": len(df),
    }
    with open(METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"\nSaved model to {MODEL_PATH}")
    print(f"Saved metadata to {METADATA_PATH}")


if __name__ == "__main__":
    main()
