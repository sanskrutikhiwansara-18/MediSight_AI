"""
Server-side k-anonymity enforcement for aggregate analytics.

Rule: any aggregate bucket with count < K_ANONYMITY_THRESHOLD is suppressed
before it ever leaves the backend. The admin dashboard never sees raw counts
below the threshold, let alone patient-level rows.
"""
from app.core.config import settings


def apply_k_anonymity(count: int, k: int | None = None) -> dict:
    """
    Given a raw aggregate count, return the value the API is allowed to emit.
    """
    threshold = k if k is not None else settings.K_ANONYMITY_THRESHOLD
    if count >= threshold:
        return {"count": count, "suppressed": False, "reason": None}
    return {
        "count": None,
        "suppressed": True,
        "reason": f"Minimum privacy threshold not met (k={threshold})",
    }
