from datetime import date, datetime
from io import StringIO
import json

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, insert, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Article, Person, Quote, Jurisdiction, quote_jurisdictions, Topic, quote_topics

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _serialize_row(obj) -> dict:
    data = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name)
        if isinstance(val, (date, datetime)):
            val = val.isoformat()
        elif hasattr(val, "value"):
            val = val.value
        data[col.name] = val
    return data


@router.get("/export")
def export_db(db: Session = Depends(get_db)):
    qj_rows = db.execute(
        select(quote_jurisdictions).order_by(
            quote_jurisdictions.c.quote_id,
            quote_jurisdictions.c.jurisdiction_id,
        )
    ).all()
    qt_rows = db.execute(
        select(quote_topics).order_by(
            quote_topics.c.quote_id,
            quote_topics.c.topic_id,
        )
    ).all()
    payload = {
        "people": [_serialize_row(p) for p in db.query(Person).all()],
        "articles": [_serialize_row(a) for a in db.query(Article).all()],
        "quotes": [_serialize_row(q) for q in db.query(Quote).all()],
        "jurisdictions": [_serialize_row(j) for j in db.query(Jurisdiction).all()],
        "quote_jurisdictions": [
            {"quote_id": r[0], "jurisdiction_id": r[1]}
            for r in qj_rows
        ],
        "topics": [_serialize_row(t) for t in db.query(Topic).all()],
        "quote_topics": [
            {"quote_id": r[0], "topic_id": r[1]}
            for r in qt_rows
        ],
    }
    content = json.dumps(payload, indent=2)
    return StreamingResponse(
        StringIO(content),
        media_type="application/json",
        headers={
            "Content-Disposition": "attachment; filename=quote_tracker_export.json"
        },
    )


def _parse_date(val):
    if val is None:
        return None
    if isinstance(val, (date, datetime)):
        return val
    try:
        return datetime.fromisoformat(val)
    except (ValueError, TypeError):
        pass
    try:
        return date.fromisoformat(val)
    except (ValueError, TypeError):
        return None


@router.post("/import")
async def import_db(file: UploadFile = File(...), db: Session = Depends(get_db)):
    raw = await file.read()
    data = json.loads(raw)

    db.execute(delete(quote_topics))
    db.execute(delete(quote_jurisdictions))
    db.query(Quote).delete()
    db.query(Article).delete()
    db.query(Person).delete()
    if data.get("jurisdictions"):
        db.query(Jurisdiction).delete()
    if data.get("topics"):
        db.query(Topic).delete()
    db.flush()

    jurisdictions_count = 0
    for row in data.get("jurisdictions", []):
        j = Jurisdiction(
            id=row["id"],
            name=row["name"],
            abbreviation=row.get("abbreviation"),
            category=row["category"],
        )
        db.add(j)
        jurisdictions_count += 1

    if jurisdictions_count:
        db.flush()

    people_count = 0
    for row in data.get("people", []):
        p = Person(
            id=row["id"],
            name=row["name"],
            type=row.get("type"),
            party=row.get("party"),
            role=row.get("role"),
            chamber=row.get("chamber"),
            state=row.get("state"),
            employer=row.get("employer"),
            notes=row.get("notes"),
            created_at=_parse_date(row.get("created_at")),
            updated_at=_parse_date(row.get("updated_at")),
        )
        db.add(p)
        people_count += 1

    articles_count = 0
    for row in data.get("articles", []):
        a = Article(
            id=row["id"],
            url=row["url"],
            title=row.get("title"),
            publication=row.get("publication"),
            published_date=_parse_date(row.get("published_date")),
            fetched_at=_parse_date(row.get("fetched_at")),
        )
        db.add(a)
        articles_count += 1

    db.flush()

    quotes_count = 0
    for row in data.get("quotes", []):
        q = Quote(
            id=row["id"],
            person_id=row["person_id"],
            article_id=row["article_id"],
            quote_text=row["quote_text"],
            context=row.get("context"),
            date_said=_parse_date(row.get("date_said")),
            date_recorded=_parse_date(row.get("date_recorded")),
            is_duplicate=row.get("is_duplicate", False),
            duplicate_of_id=row.get("duplicate_of_id"),
            created_at=_parse_date(row.get("created_at")),
        )
        db.add(q)
        quotes_count += 1

    db.flush()

    topics_count = 0
    for row in data.get("topics", []):
        t = Topic(id=row["id"], name=row["name"])
        db.add(t)
        topics_count += 1

    if topics_count:
        db.flush()

    qj_count = 0
    for row in data.get("quote_jurisdictions", []):
        db.execute(
            insert(quote_jurisdictions).values(
                quote_id=row["quote_id"],
                jurisdiction_id=row["jurisdiction_id"],
            )
        )
        qj_count += 1

    qt_count = 0
    for row in data.get("quote_topics", []):
        db.execute(
            insert(quote_topics).values(
                quote_id=row["quote_id"],
                topic_id=row["topic_id"],
            )
        )
        qt_count += 1

    db.commit()

    return {
        "ok": True,
        "imported": {
            "people": people_count,
            "articles": articles_count,
            "quotes": quotes_count,
            "jurisdictions": jurisdictions_count,
            "quote_jurisdictions": qj_count,
            "topics": topics_count,
            "quote_topics": qt_count,
        },
    }


@router.post("/clear")
def clear_db(db: Session = Depends(get_db)):
    q_count = db.query(Quote).delete()
    a_count = db.query(Article).delete()
    p_count = db.query(Person).delete()
    db.commit()
    return {
        "ok": True,
        "deleted": {"people": p_count, "articles": a_count, "quotes": q_count},
    }
