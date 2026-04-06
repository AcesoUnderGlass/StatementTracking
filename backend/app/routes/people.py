import csv
import json
from datetime import date
from io import StringIO
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Person, Quote, SpeakerType, Party, Chamber
from ..schemas import PersonOut, PersonUpdate, QuoteOut, ArticleMetadata, PersonBase

router = APIRouter(prefix="/api/people", tags=["people"])


@router.get("", response_model=list)
def list_people(search: Optional[str] = None, db: Session = Depends(get_db)):
    results = _build_people_query(db, search=search).all()
    return [_person_to_dict(person, count) for person, count in results]


PEOPLE_CSV_COLUMNS = [
    "id", "name", "type", "party", "role", "chamber",
    "locale", "employer", "notes", "quote_count", "created_at", "updated_at",
]


def _person_to_dict(person: Person, count: int) -> dict:
    return {
        "id": person.id,
        "name": person.name,
        "type": person.type.value if person.type else None,
        "party": person.party.value if person.party else None,
        "role": person.role,
        "chamber": person.chamber.value if person.chamber else None,
        "locale": person.locale,
        "employer": person.employer,
        "notes": person.notes,
        "created_at": person.created_at.isoformat() if person.created_at else None,
        "updated_at": person.updated_at.isoformat() if person.updated_at else None,
        "quote_count": count,
    }


def _build_people_query(db: Session, *, search: Optional[str] = None):
    query = (
        db.query(Person, func.count(Quote.id).label("quote_count"))
        .outerjoin(
            Quote,
            (Quote.person_id == Person.id) & (Quote.is_duplicate == False),  # noqa: E712
        )
        .group_by(Person.id)
    )
    if search:
        query = query.filter(Person.name.ilike(f"%{search}%"))
    return query.order_by(Person.name)


@router.get("/export")
def export_people(
    search: Optional[str] = None,
    format: str = Query("csv"),
    db: Session = Depends(get_db),
):
    results = _build_people_query(db, search=search).all()
    rows = [_person_to_dict(person, count) for person, count in results]
    today = date.today().isoformat()

    if format == "json":
        content = json.dumps(rows, indent=2)
        return StreamingResponse(
            StringIO(content),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=speakers_export_{today}.json"},
        )

    buf = StringIO()
    writer = csv.writer(buf)
    writer.writerow(PEOPLE_CSV_COLUMNS)
    for d in rows:
        writer.writerow([str(d.get(col) or "") for col in PEOPLE_CSV_COLUMNS])
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=speakers_export_{today}.csv"},
    )


@router.get("/{person_id}")
def get_person(person_id: int, db: Session = Depends(get_db)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found.")

    quotes = (
        db.query(Quote)
        .filter(Quote.person_id == person_id)
        .filter(Quote.is_duplicate == False)  # noqa: E712
        .order_by(Quote.date_said.desc().nullslast(), Quote.created_at.desc())
        .all()
    )

    person_data = {
        "id": person.id,
        "name": person.name,
        "type": person.type.value if person.type else None,
        "party": person.party.value if person.party else None,
        "role": person.role,
        "chamber": person.chamber.value if person.chamber else None,
        "locale": person.locale,
        "employer": person.employer,
        "notes": person.notes,
        "created_at": person.created_at.isoformat() if person.created_at else None,
        "updated_at": person.updated_at.isoformat() if person.updated_at else None,
        "quote_count": len(quotes),
    }

    quotes_data = []
    for q in quotes:
        qd = {
            "id": q.id,
            "quote_text": q.quote_text,
            "original_text": q.original_text,
            "context": q.context,
            "date_said": q.date_said.isoformat() if q.date_said else None,
            "date_recorded": q.date_recorded.isoformat() if q.date_recorded else None,
            "created_at": q.created_at.isoformat() if q.created_at else None,
            "article": {
                "url": q.article.url,
                "title": q.article.title,
                "publication": q.article.publication,
                "published_date": (
                    q.article.published_date.isoformat()
                    if q.article.published_date
                    else None
                ),
            } if q.article else None,
        }
        quotes_data.append(qd)

    return {**person_data, "quotes": quotes_data}


@router.put("/{person_id}")
def update_person(
    person_id: int, updates: PersonUpdate, db: Session = Depends(get_db)
):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found.")

    update_data = updates.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        if field == "type" and value is not None:
            value = SpeakerType(value)
        elif field == "party" and value is not None:
            value = Party(value)
        elif field == "chamber" and value is not None:
            value = Chamber(value)
        setattr(person, field, value)

    db.commit()
    db.refresh(person)

    return {
        "id": person.id,
        "name": person.name,
        "type": person.type.value if person.type else None,
        "party": person.party.value if person.party else None,
        "role": person.role,
        "chamber": person.chamber.value if person.chamber else None,
        "locale": person.locale,
        "employer": person.employer,
        "notes": person.notes,
        "created_at": person.created_at.isoformat() if person.created_at else None,
        "updated_at": person.updated_at.isoformat() if person.updated_at else None,
    }
