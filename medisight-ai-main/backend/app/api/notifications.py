from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.representative import AppNotification
from app.models.user import User

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

class NotificationOut(BaseModel):
    id: int
    patient_id: int | None
    request_id: int | None
    title: str
    message: str
    notification_type: str
    is_read: bool
    created_at: datetime
    model_config = {"from_attributes": True}

@router.get("", response_model=list[NotificationOut])
def list_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(AppNotification).filter(AppNotification.user_id == current_user.id).order_by(AppNotification.created_at.desc()).limit(100).all()

@router.post("/{notification_id}/read")
def mark_read(notification_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(AppNotification).filter(AppNotification.id == notification_id, AppNotification.user_id == current_user.id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    item.is_read = True
    db.commit()
    return {"read": True, "id": item.id}
