from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Article, Quote

router = APIRouter(prefix="/api/review", tags=["review"])


def _pending_quote_dict(q: Quote) -> dict:
    return {
        "id": q.id,
        "quote_text": q.quote_text,
        "original_text": q.original_text,
        "context": q.context,
        "date_said": q.date_said.isoformat() if q.date_said else None,
        "date_recorded": q.date_recorded.isoformat() if q.date_recorded else None,
        "review_status": q.review_status or "pending",
        "created_at": q.created_at.isoformat() if q.created_at else None,
        "jurisdictions": sorted({j.name for j in (q.jurisdictions or [])}),
        "topics": sorted({t.name for t in (q.topics or [])}),
        "person": {
            "id": q.person.id,
            "name": q.person.name,
            "type": q.person.type.value if q.person.type else None,
            "party": q.person.party.value if q.person.party else None,
            "role": q.person.role,
            "chamber": q.person.chamber.value if q.person.chamber else None,
            "locales": q.person.locales or [],
            "employer": q.person.employer,
        } if q.person else None,
    }


@router.get("/pending")
def list_pending(
    ingestion_source: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Return articles that have at least one pending quote, with their
    pending quotes nested inside, ordered newest first."""

    article_ids_q = (
        db.query(Quote.article_id)
        .filter(Quote.review_status == "pending")
        .distinct()
        .subquery()
    )

    base = db.query(Article).filter(Article.id.in_(
        db.query(article_ids_q.c.article_id)
    ))

    if ingestion_source:
        base = base.filter(Article.ingestion_source == ingestion_source)

    total = base.count()

    articles = (
        base.order_by(Article.fetched_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    result = []
    for a in articles:
        pending_quotes = (
            db.query(Quote)
            .options(selectinload(Quote.person))
            .filter(Quote.article_id == a.id, Quote.review_status == "pending")
            .order_by(Quote.id)
            .all()
        )
        result.append({
            "id": a.id,
            "url": a.url,
            "title": a.title,
            "publication": a.publication,
            "published_date": a.published_date.isoformat() if a.published_date else None,
            "fetched_at": a.fetched_at.isoformat() if a.fetched_at else None,
            "ingestion_source": a.ingestion_source,
            "ingestion_source_detail": a.ingestion_source_detail,
            "quotes": [_pending_quote_dict(q) for q in pending_quotes],
        })

    return {
        "articles": result,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/stats")
def review_stats(db: Session = Depends(get_db)):
    """Lightweight count of pending quotes for sidebar badge."""
    pending_count = db.query(func.count(Quote.id)).filter(
        Quote.review_status == "pending"
    ).scalar()
    return {"pending_count": pending_count or 0}
