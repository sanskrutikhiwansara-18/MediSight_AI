from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserRole
from app.services.audit import log_event

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise credentials_exception

    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id = payload.get("user_id")
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise credentials_exception

    return user


def require_role(*allowed_roles: UserRole):
    """
    Dependency factory that enforces RBAC on a route.
    Any denial is audit-logged before the 403 is raised, so unauthorized
    admin access to patient data is both blocked AND recorded.
    """

    def dependency(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if current_user.role not in allowed_roles:
            log_event(
                db,
                actor_user_id=current_user.id,
                actor_role=current_user.role.value,
                action="UNAUTHORIZED_ACCESS",
                resource=str(request.url.path),
                success=False,
                detail=f"Role '{current_user.role.value}' not permitted for this route",
                ip_address=request.client.host if request.client else "",
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )
        return current_user

    return dependency
