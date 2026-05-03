"""Per-user quote favorites.

Two endpoint shapes:

- ``POST/DELETE /api/quotes/{quote_id}/favorite`` toggle a star for the
  current user. Both verbs are idempotent so the frontend never needs
  to know the prior state before issuing a request.
- ``GET /api/users/me/favorites/ids`` returns the user's full list of
  favorited quote IDs. The frontend caches this once and renders the
  star fill state from the cache, which keeps every quote card free of
  per-row API calls.

Anonymous traffic gets 401 on every endpoint here; the
``favorited_only`` filter on ``/api/quotes`` is the only place that
silently degrades to "no results" for anonymous callers.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import insert
from sqlalchemy.orm import Session

from ..auth import current_user
from ..database import get_db
from ..models import Quote, QuoteFavorite, User

quote_router = APIRouter(prefix="/api/quotes", tags=["favorites"])
me_router = APIRouter(prefix="/api/users/me", tags=["favorites"])


def _quote_exists(db: Session, quote_id: int) -> bool:
    return db.query(Quote.id).filter(Quote.id == quote_id).first() is not None


@quote_router.post("/{quote_id}/favorite")
def favorite_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    """Star ``quote_id`` for the current user. Idempotent."""
    if not _quote_exists(db, quote_id):
        raise HTTPException(status_code=404, detail="Quote not found.")

    existing = (
        db.query(QuoteFavorite)
        .filter(
            QuoteFavorite.user_id == user.id,
            QuoteFavorite.quote_id == quote_id,
        )
        .first()
    )
    if existing is None:
        # Use a plain INSERT so the unique-PK race between concurrent
        # double-clicks raises an IntegrityError we can swallow rather
        # than surface as a 500. SQLAlchemy's ORM .add() would do the
        # same thing but with more session bookkeeping.
        try:
            db.execute(
                insert(QuoteFavorite).values(
                    user_id=user.id, quote_id=quote_id
                )
            )
            db.commit()
        except Exception:
            db.rollback()
            # If the row exists now, the desired state is already
            # achieved; otherwise re-raise as a 500.
            still_missing = (
                db.query(QuoteFavorite)
                .filter(
                    QuoteFavorite.user_id == user.id,
                    QuoteFavorite.quote_id == quote_id,
                )
                .first()
                is None
            )
            if still_missing:
                raise

    return {"favorited": True, "quote_id": quote_id}


@quote_router.delete("/{quote_id}/favorite")
def unfavorite_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    """Unstar ``quote_id`` for the current user. Idempotent."""
    db.query(QuoteFavorite).filter(
        QuoteFavorite.user_id == user.id,
        QuoteFavorite.quote_id == quote_id,
    ).delete(synchronize_session=False)
    db.commit()
    return {"favorited": False, "quote_id": quote_id}


@me_router.get("/favorites/ids")
def list_favorite_ids(
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    """Return the current user's favorited quote IDs, newest first."""
    rows = (
        db.query(QuoteFavorite.quote_id)
        .filter(QuoteFavorite.user_id == user.id)
        .order_by(QuoteFavorite.created_at.desc(), QuoteFavorite.quote_id.desc())
        .all()
    )
    return {"quote_ids": [r[0] for r in rows]}
