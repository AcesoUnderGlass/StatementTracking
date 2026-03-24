#!/usr/bin/env python3
"""Assign Claude-inferred topic tags to every quote in the database."""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[1]
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from sqlalchemy.orm import Session, joinedload

from app.database import SessionLocal
from app.models import Topic, Quote
from app.services.topic_quote import set_quote_topics
from app.services.topic_tagger import TopicTagError, infer_topic_tags


def topic_prompt_block(db: Session) -> str:
    rows = db.query(Topic).order_by(Topic.name).all()
    if not rows:
        return "(No topics seeded — run migrations.)"
    return "\n".join(f"- {r.name}" for r in rows)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Print tags only; do not write to the database.",
    )
    p.add_argument(
        "--skip-tagged",
        action="store_true",
        help="Skip quotes that already have at least one topic.",
    )
    p.add_argument(
        "--include-duplicates",
        action="store_true",
        help="Also process quotes marked is_duplicate.",
    )
    p.add_argument("--limit", type=int, default=None, help="Max quotes to process.")
    p.add_argument(
        "--quote-ids",
        type=str,
        default=None,
        help="Comma-separated quote IDs only (e.g. 12,13).",
    )
    p.add_argument("--sleep", type=float, default=0.15, help="Seconds between API calls.")
    args = p.parse_args()

    db = SessionLocal()
    try:
        block = topic_prompt_block(db)
        if block.startswith("(No topics"):
            print(block, file=sys.stderr)
            sys.exit(1)

        q = (
            db.query(Quote)
            .options(joinedload(Quote.person), joinedload(Quote.article), joinedload(Quote.topics))
            .order_by(Quote.id)
        )
        if args.quote_ids:
            ids = [int(x.strip()) for x in args.quote_ids.split(",") if x.strip()]
            q = q.filter(Quote.id.in_(ids))
        if not args.include_duplicates:
            q = q.filter(Quote.is_duplicate.is_(False))
        quotes = q.all()
        if args.limit is not None:
            quotes = quotes[: args.limit]

        total = len(quotes)
        done = 0
        skipped = 0
        errors = 0

        for quote in quotes:
            if args.skip_tagged and quote.topics and len(quote.topics) > 0:
                skipped += 1
                continue

            person = quote.person
            article = quote.article
            speaker = person.name if person else "Unknown"

            try:
                names = infer_topic_tags(
                    canonical_topic_block=block,
                    quote_text=quote.quote_text,
                    context=quote.context,
                    speaker_name=speaker,
                    article_title=article.title if article else None,
                    article_url=article.url if article else None,
                )
            except TopicTagError as e:
                print(f"[error] quote {quote.id}: {e}", file=sys.stderr)
                errors += 1
                continue

            done += 1
            label = f"quote {quote.id}"
            print(f"{label}: {names}", flush=True)

            if not args.dry_run:
                set_quote_topics(db, quote, names)
                db.commit()

            if args.sleep:
                time.sleep(args.sleep)

        print(
            f"Finished: processed {done}, skipped (already tagged) {skipped}, errors {errors}, "
            f"candidates {total}.",
            file=sys.stderr,
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
