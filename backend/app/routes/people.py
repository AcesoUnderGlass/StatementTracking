import csv
import json
from datetime import date
from io import StringIO
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import require_editor
from ..database import get_db
from ..models import Person, Quote, SpeakerType, Party, Chamber, safe_speaker_type
from ..schemas import PersonOut, PersonUpdate, QuoteOut, ArticleMetadata, PersonBase

router = APIRouter(prefix="/api/people", tags=["people"])


@router.get("", response_model=list)
def list_people(
    search: Optional[str] = None,
    type: Optional[str] = None,
    party: Optional[str] = None,
    locale: Optional[str] = None,
    role: Optional[str] = None,
    sort_by: Optional[str] = Query(None, pattern="^(name|quote_count|created_at)$"),
    sort_dir: Optional[str] = Query("asc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    results = _build_people_query(
        db, search=search, type=type, party=party, locale=locale,
        role=role, sort_by=sort_by, sort_dir=sort_dir,
    ).all()
    return [_person_to_dict(person, count) for person, count in results]


PEOPLE_CSV_COLUMNS = [
    "id", "name", "type", "party", "role", "chamber",
    "locales", "employer", "notes", "quote_count", "created_at", "updated_at",
]


def _person_to_dict(person: Person, count: int) -> dict:
    return {
        "id": person.id,
        "name": person.name,
        "type": person.type.value if person.type else None,
        "party": person.party.value if person.party else None,
        "role": person.role,
        "chamber": person.chamber.value if person.chamber else None,
        "locales": person.locales or [],
        "employer": person.employer,
        "notes": person.notes,
        "created_at": person.created_at.isoformat() if person.created_at else None,
        "updated_at": person.updated_at.isoformat() if person.updated_at else None,
        "quote_count": count,
    }


def _build_people_query(
    db: Session,
    *,
    search: Optional[str] = None,
    type: Optional[str] = None,
    party: Optional[str] = None,
    locale: Optional[str] = None,
    role: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_dir: Optional[str] = "asc",
):
    quote_count = func.count(Quote.id).label("quote_count")
    query = (
        db.query(Person, quote_count)
        .outerjoin(
            Quote,
            (Quote.person_id == Person.id) & (Quote.is_duplicate == False),  # noqa: E712
        )
        .group_by(Person.id)
    )
    if search:
        query = query.filter(Person.name.ilike(f"%{search}%"))
    if role:
        query = query.filter(Person.role.ilike(f"%{role}%"))
    if type:
        query = query.filter(Person.type == safe_speaker_type(type))
    if party:
        query = query.filter(Person.party == Party(party))
    if locale:
        query = query.filter(Person.locales.contains([locale]))

    order_col = Person.name
    if sort_by == "quote_count":
        order_col = quote_count
    elif sort_by == "created_at":
        order_col = Person.created_at

    if sort_dir == "desc":
        query = query.order_by(order_col.desc())
    else:
        query = query.order_by(order_col.asc())

    return query


@router.get("/export")
def export_people(
    search: Optional[str] = None,
    type: Optional[str] = None,
    party: Optional[str] = None,
    locale: Optional[str] = None,
    role: Optional[str] = None,
    sort_by: Optional[str] = Query(None, pattern="^(name|quote_count|created_at)$"),
    sort_dir: Optional[str] = Query("asc", pattern="^(asc|desc)$"),
    format: str = Query("csv"),
    db: Session = Depends(get_db),
):
    results = _build_people_query(
        db, search=search, type=type, party=party, locale=locale,
        role=role, sort_by=sort_by, sort_dir=sort_dir,
    ).all()
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
        row_vals = []
        for col in PEOPLE_CSV_COLUMNS:
            v = d.get(col)
            if col == "locales":
                row_vals.append("; ".join(v) if v else "")
            else:
                row_vals.append(str(v) if v else "")
        writer.writerow(row_vals)
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
        "locales": person.locales or [],
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


@router.put("/{person_id}", dependencies=[Depends(require_editor)])
def update_person(
    person_id: int, updates: PersonUpdate, db: Session = Depends(get_db)
):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found.")

    update_data = updates.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        if field == "type" and value is not None:
            value = safe_speaker_type(value)
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
        "locales": person.locales or [],
        "employer": person.employer,
        "notes": person.notes,
        "created_at": person.created_at.isoformat() if person.created_at else None,
        "updated_at": person.updated_at.isoformat() if person.updated_at else None,
    }
