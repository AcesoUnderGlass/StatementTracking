from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Topic

router = APIRouter(prefix="/api/topics", tags=["topics"])

CACHE_1H = "public, s-maxage=3600, stale-while-revalidate=86400"


@router.get("")
def list_topics(db: Session = Depends(get_db)):
    rows = db.query(Topic).order_by(Topic.name).all()
    data = [{"id": r.id, "name": r.name} for r in rows]
    return JSONResponse(content=data, headers={"Cache-Control": CACHE_1H})
