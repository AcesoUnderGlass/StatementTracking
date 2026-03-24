"""Resolve and persist quote ↔ jurisdiction links."""

from typing import Iterable, List, Optional, Set

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Jurisdiction, Quote


def _meta_state_id(db: Session) -> Optional[int]:
    row = db.query(Jurisdiction).filter(Jurisdiction.name == "US-state").first()
    return row.id if row else None


def _meta_local_id(db: Session) -> Optional[int]:
    row = db.query(Jurisdiction).filter(Jurisdiction.name == "US-local").first()
    return row.id if row else None


def resolve_jurisdiction_ids(db: Session, names: Optional[Iterable[str]]) -> List[int]:
    """Map tag strings to jurisdiction rows. Unknown names become new localities (category=local)."""
    if not names:
        return []

    seen: Set[int] = set()
    out: List[int] = []

    for raw in names:
        if not raw or not str(raw).strip():
            continue
        name = str(raw).strip()

        j = db.query(Jurisdiction).filter(Jurisdiction.name == name).first()
        if not j:
            j = (
                db.query(Jurisdiction)
                .filter(
                    Jurisdiction.abbreviation.isnot(None),
                    func.upper(Jurisdiction.abbreviation) == name.upper(),
                )
                .first()
            )
        if not j:
            j = Jurisdiction(name=name, abbreviation=None, category="local")
            db.add(j)
            db.flush()

        if j.id not in seen:
            seen.add(j.id)
            out.append(j.id)

    rows = db.query(Jurisdiction).filter(Jurisdiction.id.in_(out)).all()
    id_by_row = {r.id: r for r in rows}

    if any(id_by_row[i].category == "state" for i in out if i in id_by_row):
        mid = _meta_state_id(db)
        if mid and mid not in seen:
            seen.add(mid)
            out.append(mid)

    if any(id_by_row[i].category == "local" for i in out if i in id_by_row):
        lid = _meta_local_id(db)
        if lid and lid not in seen:
            out.append(lid)

    return out


def set_quote_jurisdictions(db: Session, quote: Quote, names: Optional[List[str]]) -> None:
    """Replace quote jurisdictions from canonical / free-form names."""
    ids = resolve_jurisdiction_ids(db, names or [])
    if not ids:
        quote.jurisdictions = []
        return
    quote.jurisdictions = db.query(Jurisdiction).filter(Jurisdiction.id.in_(ids)).all()
