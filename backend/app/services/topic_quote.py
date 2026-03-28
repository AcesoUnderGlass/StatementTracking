"""Resolve and persist quote <-> topic links."""

from typing import Iterable, List, Optional, Set

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Topic, Quote


def resolve_topic_ids(db: Session, names: Optional[Iterable[str]]) -> List[int]:
    """Map tag strings to topic rows. Unknown names become new rows."""
    if not names:
        return []

    seen: Set[int] = set()
    out: List[int] = []

    for raw in names:
        if not raw or not str(raw).strip():
            continue
        name = str(raw).strip()

        t = db.query(Topic).filter(func.lower(Topic.name) == name.lower()).first()
        if not t:
            t = Topic(name=name)
            db.add(t)
            db.flush()

        if t.id not in seen:
            seen.add(t.id)
            out.append(t.id)

    return out


def set_quote_topics(db: Session, quote: Quote, names: Optional[List[str]]) -> None:
    """Replace quote topics from canonical / free-form names."""
    ids = resolve_topic_ids(db, names or [])
    if not ids:
        quote.topics = []
        return
    quote.topics = db.query(Topic).filter(Topic.id.in_(ids)).all()
