from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.user import User, UserRole
from app.models.risk_audit import AuditLog
from app.schemas.misc import AuditLogOut

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/logs", response_model=list[AuditLogOut])
def get_audit_logs(
    limit: int = Query(100, le=500),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    return (
        db.query(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .limit(limit)
        .all()
    )
