"""Normalize known duplicate speaker labels to a single canonical Person name."""

from __future__ import annotations

import re

# Lowercase key → exact stored display name
_SPEAKER_ALIASES_TO_CANONICAL: dict[str, str] = {
    "trump whitehouse": "Trump administration",
    "trump white house": "Trump administration",
    "the white house": "Trump administration",
    "white house": "Trump administration",
    "president trump": "Donald Trump",
    "president biden": "Joe Biden",
    "the president": "Donald Trump",
    "sen. warner": "Mark Warner",
    "sen. bernie sanders": "Bernie Sanders",
    "sen. josh hawley": "Josh Hawley",
    "sen. richard blumenthal": "Richard Blumenthal",
    "sen. steve padilla office": "Steve Padilla",
    "gov. gavin newsom": "Gavin Newsom",
    "baroness stowell": "Tina Stowell",
    "tina stowell, baroness stowell of beeston": "Tina Stowell",
    "chinese premier li qiang": "Li Qiang",
}

# Title prefixes stripped from names (order matters: longer first).
_TITLE_PREFIXES = re.compile(
    r"^(?:Senator|Sen\.|Representative|Rep\.|Governor|Gov\.|"
    r"Chairwoman|Chairman|Vice President|Dame|Dr\.?)\s+",
    re.I,
)

# Trailing honorific suffixes to strip.
_TITLE_SUFFIXES = re.compile(r"\s+MP$", re.I)


def canonical_speaker_name(name: str) -> str:
    """Return the canonical Person.name for *name* if it is a known alias;
    otherwise strip title prefixes/suffixes and return the cleaned name."""
    stripped = name.strip()
    key = stripped.lower()

    if key in _SPEAKER_ALIASES_TO_CANONICAL:
        return _SPEAKER_ALIASES_TO_CANONICAL[key]

    cleaned = _TITLE_PREFIXES.sub("", stripped)
    cleaned = _TITLE_SUFFIXES.sub("", cleaned).strip()

    return cleaned if cleaned else stripped
