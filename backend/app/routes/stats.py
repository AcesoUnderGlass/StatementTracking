from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Quote, Person

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("")
def get_stats(db: Session = Depends(get_db)):
    non_dup = Quote.is_duplicate == False  # noqa: E712

    total_quotes = (
        db.query(func.count(Quote.id)).filter(non_dup).scalar() or 0
    )
    total_people = db.query(func.count(Person.id)).scalar() or 0

    party_rows = (
        db.query(Person.party, func.count(Quote.id))
        .join(Quote, Quote.person_id == Person.id)
        .filter(non_dup)
        .group_by(Person.party)
        .all()
    )
    quotes_by_party = [
        {"party": (p.value if p else "Unknown"), "count": c}
        for p, c in party_rows
    ]

    time_rows = (
        db.query(
            func.to_char(Quote.date_said, 'YYYY-MM').label("month"),
            func.count(Quote.id),
        )
        .filter(Quote.date_said.isnot(None))
        .filter(non_dup)
        .group_by("month")
        .order_by("month")
        .all()
    )
    quotes_over_time = [{"month": m, "count": c} for m, c in time_rows]

    top_rows = (
        db.query(
            Person.id,
            Person.name,
            Person.party,
            Person.role,
            func.count(Quote.id).label("cnt"),
        )
        .join(Quote, Quote.person_id == Person.id)
        .filter(non_dup)
        .group_by(Person.id)
        .order_by(func.count(Quote.id).desc())
        .limit(10)
        .all()
    )
    top_speakers = [
        {
            "person_id": pid,
            "name": name,
            "party": party.value if party else None,
            "role": role,
            "count": cnt,
        }
        for pid, name, party, role, cnt in top_rows
    ]

    return {
        "total_quotes": total_quotes,
        "total_people": total_people,
        "quotes_by_party": quotes_by_party,
        "quotes_over_time": quotes_over_time,
        "top_speakers": top_speakers,
    }
