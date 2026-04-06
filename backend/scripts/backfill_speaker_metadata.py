#!/usr/bin/env python3
"""Apply speaker registry + title inference to every Person row (fill empty fields only)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[1]
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from app.database import SessionLocal
from app.models import Person
from app.services.speaker_metadata import enrich_person_from_existing_role


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Print changes only; do not commit.",
    )
    args = p.parse_args()

    db = SessionLocal()
    try:
        people = db.query(Person).order_by(Person.id).all()
        updated = 0
        for person in people:
            before = (
                person.party,
                person.chamber,
                person.locales,
                person.role,
                person.type,
            )
            if enrich_person_from_existing_role(person):
                after = (
                    person.party,
                    person.chamber,
                    person.locales,
                    person.role,
                    person.type,
                )
                if after != before:
                    updated += 1
                    print(
                        f"id={person.id} {person.name!r}: "
                        f"{before} -> {after}"
                    )
        if args.dry_run:
            db.rollback()
            print(f"[dry-run] would update {updated} row(s); rolled back.")
        else:
            db.commit()
            print(f"Updated {updated} speaker(s).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
