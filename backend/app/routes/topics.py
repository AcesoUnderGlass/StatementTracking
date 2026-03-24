from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Topic

router = APIRouter(prefix="/api/topics", tags=["topics"])


@router.get("")
def list_topics(db: Session = Depends(get_db)):
    rows = db.query(Topic).order_by(Topic.name).all()
    return [{"id": r.id, "name": r.name} for r in rows]
