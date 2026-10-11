from sqlalchemy.orm import Session

from app.models.risk_audit import AuditLog


def log_event(
    db: Session,
    *,
    action: str,
    actor_user_id: int | None = None,
    actor_role: str = "unknown",
    resource: str = "",
    success: bool = True,
    detail: str = "",
    ip_address: str = "",
) -> AuditLog:
    entry = AuditLog(
        actor_user_id=actor_user_id,
        actor_role=actor_role,
        action=action,
        resource=resource,
        success=success,
        detail=detail,
        ip_address=ip_address,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
