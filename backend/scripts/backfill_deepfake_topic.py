#!/usr/bin/env python3
"""Attach the 'deepfake' topic to quotes whose text or article metadata match."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[1]
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from sqlalchemy.orm import Session, joinedload

from app.database import SessionLocal
from app.models import Quote
from app.services.topic_quote import set_quote_topics

# Substrings matched case-insensitively against quote_text, context, article title, url.
DEFAULT_KEYWORDS = (
    "deepfake",
    "deep fake",
    "deepfakes",
    "synthetic media",
    "face-swap",
    "faceswap",
    "face swap",
    "voice clone",
    "voice cloning",
)


def _haystack(quote: Quote) -> str:
    parts = [
        quote.quote_text or "",
        quote.context or "",
    ]
    if quote.article:
        parts.extend(
            [
                quote.article.title or "",
                quote.article.url or "",
            ]
        )
    return " ".join(parts).lower()


def _matches(text: str, keywords: tuple[str, ...]) -> bool:
    return any(k in text for k in keywords)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Print matches only; do not write to the database.",
    )
    p.add_argument(
        "--include-duplicates",
        action="store_true",
        help="Also process quotes marked is_duplicate.",
    )
    p.add_argument("--limit", type=int, default=None, help="Max quotes to update.")
    p.add_argument(
        "--keywords",
        type=str,
        default=None,
        help="Comma-separated extra substrings to match (in addition to defaults).",
    )
    args = p.parse_args()

    keywords: tuple[str, ...] = DEFAULT_KEYWORDS
    if args.keywords:
        extra = tuple(
            x.strip().lower()
            for x in args.keywords.split(",")
            if x.strip()
        )
        keywords = DEFAULT_KEYWORDS + extra

    db: Session = SessionLocal()
    try:
        q = (
            db.query(Quote)
            .options(
                joinedload(Quote.article),
                joinedload(Quote.topics),
            )
            .order_by(Quote.id)
        )
        if not args.include_duplicates:
            q = q.filter(Quote.is_duplicate.is_(False))
        quotes = q.all()

        updated = 0
        skipped_has_tag = 0
        scanned = 0

        for quote in quotes:
            scanned += 1
            hay = _haystack(quote)
            if not _matches(hay, keywords):
                continue
            existing = {t.name for t in (quote.topics or [])}
            if "deepfake" in existing:
                skipped_has_tag += 1
                continue

            merged = sorted(existing | {"deepfake"})
            print(f"quote {quote.id}: +deepfake -> {merged}", flush=True)
            updated += 1
            if not args.dry_run:
                set_quote_topics(db, quote, merged)
                db.commit()

            if args.limit is not None and updated >= args.limit:
                break

        print(
            f"Done: scanned {scanned}, would update / updated {updated}, "
            f"already had deepfake {skipped_has_tag}.",
            file=sys.stderr,
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
