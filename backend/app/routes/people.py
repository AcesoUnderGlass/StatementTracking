from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Person, Quote, SpeakerType, Party, Chamber
from ..schemas import PersonOut, PersonUpdate, QuoteOut, ArticleMetadata, PersonBase

router = APIRouter(prefix="/api/people", tags=["people"])


@router.get("", response_model=list)
def list_people(search: Optional[str] = None, db: Session = Depends(get_db)):
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

    query = query.order_by(Person.name)
    results = query.all()

    out = []
    for person, count in results:
        d = {
            "id": person.id,
            "name": person.name,
            "type": person.type.value if person.type else None,
            "party": person.party.value if person.party else None,
            "role": person.role,
            "chamber": person.chamber.value if person.chamber else None,
            "state": person.state,
            "employer": person.employer,
            "notes": person.notes,
            "created_at": person.created_at.isoformat() if person.created_at else None,
            "updated_at": person.updated_at.isoformat() if person.updated_at else None,
            "quote_count": count,
        }
        out.append(d)
    return out


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
        "state": person.state,
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
        "state": person.state,
        "employer": person.employer,
        "notes": person.notes,
        "created_at": person.created_at.isoformat() if person.created_at else None,
        "updated_at": person.updated_at.isoformat() if person.updated_at else None,
    }
