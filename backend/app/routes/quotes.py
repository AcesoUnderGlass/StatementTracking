import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Quote, Person, Article, Jurisdiction, Topic, quote_jurisdictions, quote_topics
from ..schemas import QuoteUpdate, DuplicateCheckRequest, SuggestTagsRequest, SuggestTagsResponse
from ..services.dedup import check_duplicates_batch
from ..services.jurisdiction_quote import set_quote_jurisdictions
from ..services.topic_quote import set_quote_topics
from ..services.topic_tagger import infer_topic_tags, TopicTagError
from ..services.jurisdiction_tagger import infer_jurisdiction_tags, JurisdictionTagError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/quotes", tags=["quotes"])


def _quote_to_dict(q: Quote) -> dict:
    return {
        "id": q.id,
        "quote_text": q.quote_text,
        "original_text": q.original_text,
        "context": q.context,
        "date_said": q.date_said.isoformat() if q.date_said else None,
        "date_recorded": q.date_recorded.isoformat() if q.date_recorded else None,
        "is_duplicate": q.is_duplicate,
        "duplicate_of_id": q.duplicate_of_id,
        "review_status": q.review_status or "approved",
        "created_at": q.created_at.isoformat() if q.created_at else None,
        "person": {
            "id": q.person.id,
            "name": q.person.name,
            "type": q.person.type.value if q.person.type else None,
            "party": q.person.party.value if q.person.party else None,
            "role": q.person.role,
            "chamber": q.person.chamber.value if q.person.chamber else None,
            "state": q.person.state,
            "employer": q.person.employer,
        } if q.person else None,
        "article": {
            "id": q.article.id,
            "url": q.article.url,
            "title": q.article.title,
            "publication": q.article.publication,
            "published_date": (
                q.article.published_date.isoformat()
                if q.article.published_date
                else None
            ),
        } if q.article else None,
        "jurisdictions": sorted({j.name for j in (q.jurisdictions or [])}),
        "topics": sorted({t.name for t in (q.topics or [])}),
    }


@router.post("/check-duplicates")
def check_duplicates(
    req: DuplicateCheckRequest,
    db: Session = Depends(get_db),
):
    results = check_duplicates_batch(
        db, [item.model_dump() for item in req.items]
    )
    return {"results": results}


@router.post("/suggest-tags", response_model=SuggestTagsResponse)
def suggest_tags(req: SuggestTagsRequest, db: Session = Depends(get_db)):
    """Infer jurisdiction and topic tags for a quote using the same Claude
    tagger services used during extraction."""
    jurisdiction_rows = db.query(Jurisdiction).order_by(Jurisdiction.name).all()
    jurisdiction_block = "\n".join(
        f"- {r.name}" + (f" (abbreviation: {r.abbreviation})" if r.abbreviation else "")
        for r in jurisdiction_rows
    ) or "(No jurisdictions seeded.)"

    topic_rows = db.query(Topic).order_by(Topic.name).all()
    topic_block = "\n".join(f"- {r.name}" for r in topic_rows) or "(No topics seeded.)"

    jurisdictions: list[str] = []
    topics: list[str] = []

    try:
        jurisdictions = infer_jurisdiction_tags(
            canonical_jurisdiction_block=jurisdiction_block,
            quote_text=req.quote_text,
            context=req.context,
            speaker_name=req.speaker_name or "Unknown",
            article_title=req.article_title,
            article_url=req.article_url,
        )
    except JurisdictionTagError as e:
        logger.warning("Jurisdiction tag inference failed: %s", e)

    try:
        topics = infer_topic_tags(
            canonical_topic_block=topic_block,
            quote_text=req.quote_text,
            context=req.context,
            speaker_name=req.speaker_name or "Unknown",
            article_title=req.article_title,
            article_url=req.article_url,
        )
    except TopicTagError as e:
        logger.warning("Topic tag inference failed: %s", e)

    return SuggestTagsResponse(jurisdictions=jurisdictions, topics=topics)


SORT_COLUMNS = {
    "date_said": Quote.date_said,
    "created_at": Quote.created_at,
    "speaker": None,  # handled separately via Person.name
}


@router.get("")
def list_quotes(
    person_id: Optional[int] = None,
    person_name: Optional[str] = None,
    article_title: Optional[str] = None,
    search: Optional[str] = None,
    party: Optional[str] = None,
    type: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    added_from_date: Optional[date] = None,
    added_to_date: Optional[date] = None,
    jurisdiction_ids: Optional[list[int]] = Query(None),
    topic_ids: Optional[list[int]] = Query(None),
    include_duplicates: bool = Query(False),
    review_status: Optional[str] = Query("approved"),
    sort_by: Optional[str] = Query(None),
    sort_dir: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    joined_person = False

    base = db.query(Quote)

    if not include_duplicates:
        base = base.filter(Quote.is_duplicate == False)  # noqa: E712

    if review_status:
        base = base.filter(Quote.review_status == review_status)

    if person_id:
        base = base.filter(Quote.person_id == person_id)
    if person_name:
        if not joined_person:
            base = base.join(Person)
            joined_person = True
        base = base.filter(Person.name == person_name)
    if article_title:
        base = base.join(Article).filter(Article.title == article_title)
    if search:
        base = base.filter(Quote.quote_text.ilike(f"%{search}%"))
    if party:
        base = base.join(Person).filter(Person.party == party)
        joined_person = True
    if type:
        if not joined_person:
            base = base.join(Person)
            joined_person = True
        base = base.filter(Person.type == type)
    if from_date:
        base = base.filter(Quote.date_said >= from_date)
    if to_date:
        base = base.filter(Quote.date_said <= to_date)
    if added_from_date:
        base = base.filter(func.date(Quote.created_at) >= added_from_date)
    if added_to_date:
        base = base.filter(func.date(Quote.created_at) <= added_to_date)
    if jurisdiction_ids:
        qj = quote_jurisdictions
        subq = (
            db.query(qj.c.quote_id)
            .filter(qj.c.jurisdiction_id.in_(jurisdiction_ids))
            .distinct()
        )
        base = base.filter(Quote.id.in_(subq))
    if topic_ids:
        qt = quote_topics
        subq = (
            db.query(qt.c.quote_id)
            .filter(qt.c.topic_id.in_(topic_ids))
            .distinct()
        )
        base = base.filter(Quote.id.in_(subq))

    total = base.count()

    asc = (sort_dir or "desc").lower() == "asc"
    if sort_by == "speaker":
        if not joined_person:
            base = base.outerjoin(Person)
        col = Person.name
        order = col.asc().nullslast() if asc else col.desc().nullslast()
    elif sort_by in SORT_COLUMNS and SORT_COLUMNS[sort_by] is not None:
        col = SORT_COLUMNS[sort_by]
        order = col.asc().nullslast() if asc else col.desc().nullslast()
    else:
        order = Quote.created_at.desc()

    quotes = (
        base.options(
            selectinload(Quote.person),
            selectinload(Quote.article),
        )
        .order_by(order, Quote.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "quotes": [_quote_to_dict(q) for q in quotes],
        "total": total,
        "page": page,
        "page_size": page_size,
    }

@router.get("/{quote_id}")
def get_quote(quote_id: int, db: Session = Depends(get_db)):
    quote = (
        db.query(Quote)
        .options(
            selectinload(Quote.person),
            selectinload(Quote.article),
        )
        .filter(Quote.id == quote_id)
        .first()
    )
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found.")
    return _quote_to_dict(quote)


@router.put("/{quote_id}")
def update_quote(
    quote_id: int, updates: QuoteUpdate, db: Session = Depends(get_db)
):
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found.")

    update_data = updates.model_dump(exclude_unset=True)
    jurisdictions = update_data.pop("jurisdiction_names", None)
    topic_names = update_data.pop("topic_names", None)
    for field, value in update_data.items():
        setattr(quote, field, value)

    db.commit()
    db.refresh(quote)

    unset_fields = updates.model_dump(exclude_unset=True)
    if "jurisdiction_names" in unset_fields:
        set_quote_jurisdictions(db, quote, jurisdictions)
        db.commit()
    if "topic_names" in unset_fields:
        set_quote_topics(db, quote, topic_names)
        db.commit()

    loaded = (
        db.query(Quote)
        .options(
            selectinload(Quote.person),
            selectinload(Quote.article),
        )
        .filter(Quote.id == quote_id)
        .first()
    )
    return _quote_to_dict(loaded)


@router.delete("/{quote_id}")
def delete_quote(quote_id: int, db: Session = Depends(get_db)):
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found.")
    db.delete(quote)
    db.commit()
    return {"ok": True}


@router.put("/{quote_id}/approve")
def approve_quote(quote_id: int, db: Session = Depends(get_db)):
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found.")
    quote.review_status = "approved"
    db.commit()
    db.refresh(quote)
    loaded = (
        db.query(Quote)
        .options(selectinload(Quote.person), selectinload(Quote.article))
        .filter(Quote.id == quote_id)
        .first()
    )
    return _quote_to_dict(loaded)


@router.put("/{quote_id}/reject")
def reject_quote(quote_id: int, db: Session = Depends(get_db)):
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found.")
    quote.review_status = "rejected"
    db.commit()
    db.refresh(quote)
    loaded = (
        db.query(Quote)
        .options(selectinload(Quote.person), selectinload(Quote.article))
        .filter(Quote.id == quote_id)
        .first()
    )
    return _quote_to_dict(loaded)
