"""Privacy-aware aggregate outbreak anomaly detection.

Only counts that pass k-anonymity are passed to the detector. Suppressed
periods are omitted, never converted to zero. This is a review signal, not
a clinical or public-health diagnosis.
"""
from statistics import mean, pstdev

from app.services.privacy import apply_k_anonymity


MODEL_VERSION = "aggregate-baseline-v1"


def detect_outbreaks(period_counts: list[dict], *, k: int = 5) -> list[dict]:
    """Evaluate ordered {period, count} aggregate observations.

    Uses a simple trailing baseline of up to six previously reportable
    observations. At least four prior observations are required. An alert
    requires a rise above both 1.8x the baseline and baseline + 2 standard
    deviations + a small-count guard of 3. This deliberately favors review
    over claiming certainty.
    """
    safe = []
    for item in sorted(period_counts, key=lambda x: x["period"]):
        count = item.get("count")
        # Missing/suppressed values are not interpreted as zero.
        if count is None:
            continue
        privacy = apply_k_anonymity(int(count), k=k)
        if privacy["suppressed"]:
            continue
        safe.append({"period": str(item["period"]), "count": int(count)})

    output = []
    for index, current in enumerate(safe):
        history = safe[max(0, index - 6):index]
        if len(history) < 4:
            output.append({
                **current, "expected_count": None, "anomaly": False,
                "status": "insufficient_baseline", "model_version": MODEL_VERSION,
            })
            continue

        values = [point["count"] for point in history]
        baseline = mean(values)
        spread = pstdev(values) if len(values) > 1 else 0.0
        threshold = max(baseline * 1.8, baseline + 2 * spread + 3)
        is_anomaly = current["count"] > threshold
        output.append({
            **current,
            "expected_count": round(baseline, 2),
            "anomaly": is_anomaly,
            "status": "review_recommended" if is_anomaly else "within_expected_range",
            "model_version": MODEL_VERSION,
        })
    return output
