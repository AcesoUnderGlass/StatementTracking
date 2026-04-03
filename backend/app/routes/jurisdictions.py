from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Jurisdiction

router = APIRouter(prefix="/api/jurisdictions", tags=["jurisdictions"])

CACHE_1H = "public, s-maxage=3600, stale-while-revalidate=86400"


@router.get("")
def list_jurisdictions(db: Session = Depends(get_db)):
    rows = db.query(Jurisdiction).order_by(Jurisdiction.name).all()
    data = [
        {
            "id": r.id,
            "name": r.name,
            "abbreviation": r.abbreviation,
            "category": r.category,
        }
        for r in rows
    ]
    return JSONResponse(content=data, headers={"Cache-Control": CACHE_1H})
