"""Admin-only outbreak monitoring over privacy-approved aggregates."""
from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.patient import Condition, Patient
from app.models.user import User, UserRole
from app.services.audit import log_event
from app.services.outbreak_detection import detect_outbreaks
from app.services.privacy import apply_k_anonymity

router = APIRouter(prefix="/api/analytics", tags=["outbreak monitoring"])


@router.get("/outbreak-anomalies")
def outbreak_anomalies(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
    k: int = Query(default=5, ge=5, le=20),
    demo: bool = Query(default=False, description="Use clearly labeled synthetic sequences for demonstration"),
):
    """Return aggregate region/condition/month anomaly signals only.

    Small groups are suppressed before detector input and are never exposed
    as zero. No patient identifiers or patient-level records are returned.
    """
    if demo:
        # Synthetic, privacy-safe sequences for a reproducible demonstration.
        # Every emitted count meets k; suppressed groups are represented only
        # by aggregate metadata, never as counts or named groups.
        scenarios = [
            {
                "region": "Demo North",
                "condition": "Seasonal respiratory illness",
                "label": "normal_seasonal_rise",
                "counts": [10, 11, 12, 13, 14, 15, 16, 17],
            },
            {
                "region": "Demo South",
                "condition": "Synthetic outbreak scenario",
                "label": "synthetic_outbreak",
                "counts": [10, 11, 9, 10, 10, 35, 38, 12, 10],
            },
        ]
        results = []
        for scenario in scenarios:
            observations = [
                {"period": f"2025-{index:02d}", "count": count}
                for index, count in enumerate(scenario["counts"], start=1)
                if count >= k
            ]
            points = detect_outbreaks(observations, k=k)
            for point in points:
                results.append({
                    "region": scenario["region"],
                    "condition": scenario["condition"],
                    "scenario_label": scenario["label"],
                    **point,
                    "privacy_threshold": k,
                    "interpretation": (
                        "Synthetic signal for human review; not a confirmed outbreak."
                        if point["anomaly"] else
                        "No alert from the available reportable synthetic history."
                    ),
                })
        outbreak_rows = [row for row in results if row["scenario_label"] == "synthetic_outbreak"]
        truth_by_period = {
            f"2025-{index:02d}": value
            for index, value in enumerate([False, False, False, False, False, True, True, False, False], start=1)
        }
        false_alerts = sum(
            1 for row in outbreak_rows
            if row["anomaly"] and not truth_by_period.get(row["period"], False)
        )
        detected_periods = [
            int(row["period"].split("-")[1])
            for row in outbreak_rows
            if row["anomaly"] and truth_by_period.get(row["period"], False)
        ]
        first_truth_period = next(
            (int(period.split("-")[1]) for period, truth_value in truth_by_period.items() if truth_value),
            None,
        )
        detection_delay = (
            max(0, min(detected_periods) - first_truth_period)
            if detected_periods and first_truth_period is not None else None
        )
        log_event(
            db, action="ADMIN_ANALYTICS_DEMO_REQUEST", actor_user_id=current_user.id,
            actor_role=current_user.role.value, resource="outbreak-anomalies-demo", success=True,
        )
        return {
            "model_version": "aggregate-baseline-v1",
            "privacy_threshold": k,
            "demo_mode": True,
            "synthetic_data_only": True,
            "suppressed_buckets_omitted": True,
            "suppressed_bucket_count": 1,
            "evaluation": {
                "scenario": "labelled synthetic sequence",
                "false_alerts": false_alerts,
                "detection_delay_periods": detection_delay,
                "note": "Illustrative evaluation on a small synthetic sequence, not a real-world performance guarantee.",
            },
            "results": results,
        }

    rows = (
        db.query(Patient.region, Condition.name, Condition.diagnosed_date, Condition.patient_id)
        .join(Condition, Condition.patient_id == Patient.id)
        .filter(Condition.active.is_(True))
        .all()
    )

    # Deduplicate patients within a region/condition/month aggregate.
    buckets = defaultdict(set)
    for region, condition, diagnosed_date, patient_id in rows:
        if not diagnosed_date:
            continue
        period = diagnosed_date.strftime("%Y-%m") if isinstance(diagnosed_date, date) else str(diagnosed_date)[:7]
        buckets[(region or "UNSPECIFIED", condition, period)].add(patient_id)

    grouped = defaultdict(list)
    suppressed_bucket_count = 0
    for (region, condition, period), patient_ids in buckets.items():
        safe_count = apply_k_anonymity(len(patient_ids), k=k)
        # Crucial: suppressed buckets are not passed to the detector as zero.
        if safe_count["suppressed"]:
            suppressed_bucket_count += 1
            continue
        grouped[(region, condition)].append({"period": period, "count": safe_count["count"]})

    results = []
    for (region, condition), observations in sorted(grouped.items()):
        for point in detect_outbreaks(observations, k=k):
            results.append({
                "region": region,
                "condition": condition,
                **point,
                "privacy_threshold": k,
                "interpretation": (
                    "Aggregate signal for human review; not a confirmed outbreak."
                    if point["anomaly"] else
                    "No alert from the available reportable aggregate history."
                ),
            })

    log_event(
        db, action="ADMIN_ANALYTICS_REQUEST", actor_user_id=current_user.id,
        actor_role=current_user.role.value, resource="outbreak-anomalies", success=True,
    )
    return {
        "model_version": "aggregate-baseline-v1",
        "privacy_threshold": k,
        "suppressed_buckets_omitted": True,
        # Aggregate metadata only: count of omitted buckets, with no group labels or raw counts.
        "suppressed_bucket_count": suppressed_bucket_count,
        "results": results,
    }
