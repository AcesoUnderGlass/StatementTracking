#!/usr/bin/env python3
"""Strip title prefixes from Person.name, merge duplicates, move prefix to role."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[1]
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from sqlalchemy import update
from app.database import SessionLocal
from app.models import Person, Quote

# Explicit full-name overrides for cases where prefix-stripping leaves an
# incomplete name (last-name-only, ambiguous, etc.).
_NAME_OVERRIDES: dict[int, str] = {
    144: "Donald Trump",       # "President Trump"
    149: "Donald Trump",       # "The President"
    395: "Joe Biden",          # "President Biden"
    393: "Mark Warner",        # "Sen. Warner"
    453: "Tina Stowell",       # "Baroness Stowell"
    173: "Tina Stowell",       # "Tina Stowell, Baroness Stowell of Beeston"
    115: "Steve Padilla",      # "Sen. Steve Padilla office" → gov_inst handled by registry
    145: "Li Qiang",           # "Chinese Premier Li Qiang"
}

_TITLE_PREFIXES = re.compile(
    r"^(?:Senator|Sen\.|Representative|Rep\.|Governor|Gov\.|"
    r"President|Chinese Premier|Chairwoman|Chairman|"
    r"Vice President|Dame|Dr\.?|Baroness|Viscount)\s+",
    re.I,
)
_TITLE_SUFFIXES = re.compile(r"\s+MP$", re.I)

_ROLE_FROM_PREFIX: dict[str, str] = {
    "sen.": "Senator",
    "senator": "Senator",
    "rep.": "Representative",
    "representative": "Representative",
    "gov.": "Governor",
    "governor": "Governor",
    "president": "President",
    "chairwoman": "Chairwoman",
    "chairman": "Chairman",
    "vice president": "Vice President",
    "dame": None,
    "dr.": None,
    "dr": None,
    "chinese premier": "Premier",
    "baroness": None,
    "viscount": None,
}


def _clean_name(person_id: int, raw: str) -> tuple[str, str | None]:
    """Return (clean_name, prefix_label_or_None)."""
    if person_id in _NAME_OVERRIDES:
        m = _TITLE_PREFIXES.match(raw)
        prefix = m.group(0).strip() if m else None
        return _NAME_OVERRIDES[person_id], prefix

    m = _TITLE_PREFIXES.match(raw)
    if not m:
        return raw, None
    prefix = m.group(0).strip()
    rest = raw[m.end():].strip()
    rest = _TITLE_SUFFIXES.sub("", rest).strip()
    if not rest:
        return raw, None
    return rest, prefix


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    db = SessionLocal()
    try:
        people = db.query(Person).order_by(Person.id).all()
        name_index: dict[str, Person] = {}
        for person in people:
            name_index.setdefault(person.name.strip().lower(), person)

        renamed = 0
        merged = 0

        for person in list(people):
            clean, prefix = _clean_name(person.id, person.name)
            if clean == person.name and prefix is None:
                continue

            # If role is empty and prefix carries a meaningful title, set role
            if prefix and not person.role:
                role_label = _ROLE_FROM_PREFIX.get(prefix.lower().rstrip(".") + "." if prefix.endswith(".") else prefix.lower())
                if role_label is None:
                    role_label = _ROLE_FROM_PREFIX.get(prefix.lower())
                if role_label:
                    person.role = role_label

            target = name_index.get(clean.lower())

            if target and target.id != person.id:
                # Merge: reassign quotes, then delete
                quote_count = db.query(Quote).filter(Quote.person_id == person.id).count()
                db.execute(
                    update(Quote)
                    .where(Quote.person_id == person.id)
                    .values(person_id=target.id)
                )
                print(
                    f"  MERGE  id={person.id:>4} {person.name!r:45s} → id={target.id} {target.name!r} "
                    f"({quote_count} quotes moved)"
                )
                db.delete(person)
                merged += 1
            else:
                # Rename in place
                print(
                    f"  RENAME id={person.id:>4} {person.name!r:45s} → {clean!r}"
                )
                old_key = person.name.strip().lower()
                person.name = clean
                # Update index so later rows find this person
                name_index[clean.lower()] = person
                if old_key in name_index and name_index[old_key].id == person.id:
                    del name_index[old_key]
                renamed += 1

        if args.dry_run:
            db.rollback()
            print(f"\n[dry-run] would rename {renamed}, merge {merged}; rolled back.")
        else:
            db.commit()
            print(f"\nRenamed {renamed}, merged {merged}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
