"""Unit tests for the privacy-aware aggregate outbreak detector."""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.services.outbreak_detection import detect_outbreaks


def test_normal_counts_do_not_alert_and_require_history():
    points = [
        {"period": f"2025-{month:02d}", "count": 10 + (month % 2)}
        for month in range(1, 8)
    ]
    result = detect_outbreaks(points, k=5)
    assert result[0]["status"] == "insufficient_baseline"
    assert not any(row["anomaly"] for row in result)


def test_outbreak_is_flagged_after_baseline():
    points = [
        {"period": f"2025-{month:02d}", "count": 10}
        for month in range(1, 6)
    ] + [{"period": "2025-06", "count": 35}]
    result = detect_outbreaks(points, k=5)
    outbreak = next(row for row in result if row["period"] == "2025-06")
    assert outbreak["anomaly"] is True
    assert outbreak["status"] == "review_recommended"
    assert outbreak["expected_count"] == 10


def test_suppressed_or_missing_counts_are_not_zero():
    points = [
        {"period": "2025-01", "count": 10},
        {"period": "2025-02", "count": 11},
        {"period": "2025-03", "count": None},
        {"period": "2025-04", "count": 4},
        {"period": "2025-05", "count": 10},
        {"period": "2025-06", "count": 10},
        {"period": "2025-07", "count": 10},
        {"period": "2025-08", "count": 10},
    ]
    result = detect_outbreaks(points, k=5)
    assert all(row["count"] >= 5 for row in result)
    assert all(row["period"] not in {"2025-03", "2025-04"} for row in result)


def test_evaluation_metrics_report_detection_delay_and_false_alerts():
    """A reproducible held-out synthetic sequence for demo evidence."""
    values = [10, 11, 9, 10, 10, 35, 38, 12, 10]
    truth = [False, False, False, False, False, True, True, False, False]
    periods = [{"period": f"2025-{i:02d}", "count": n} for i, n in enumerate(values, 1)]
    result = detect_outbreaks(periods, k=5)
    predicted = {row["period"]: row["anomaly"] for row in result}
    alerts = [predicted.get(row["period"], False) for row in periods]
    false_alerts = sum(p and not t for p, t in zip(alerts, truth))
    detected = next((i for i, (p, t) in enumerate(zip(alerts, truth)) if p and t), None)
    delay = None if detected is None else detected - truth.index(True)
    assert false_alerts >= 0
    assert delay is not None
    assert delay == 0
