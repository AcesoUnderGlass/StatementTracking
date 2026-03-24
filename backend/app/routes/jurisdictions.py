from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Jurisdiction

router = APIRouter(prefix="/api/jurisdictions", tags=["jurisdictions"])


@router.get("")
def list_jurisdictions(db: Session = Depends(get_db)):
    rows = db.query(Jurisdiction).order_by(Jurisdiction.name).all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "abbreviation": r.abbreviation,
            "category": r.category,
        }
        for r in rows
    ]
