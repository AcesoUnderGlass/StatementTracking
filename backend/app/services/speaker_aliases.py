"""Normalize known duplicate speaker labels to a single canonical Person name."""

from __future__ import annotations

# Lowercase key → exact stored display name
_SPEAKER_ALIASES_TO_CANONICAL: dict[str, str] = {
    "trump whitehouse": "Trump administration",
    "trump white house": "Trump administration",
}


def canonical_speaker_name(name: str) -> str:
    """Return the canonical Person.name for *name* if it is a known alias; otherwise stripped input."""
    stripped = name.strip()
    key = stripped.lower()
    return _SPEAKER_ALIASES_TO_CANONICAL.get(key, stripped)
