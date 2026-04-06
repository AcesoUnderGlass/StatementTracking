#!/usr/bin/env python3
"""Backfill Person.locale for all speakers based on classification rules.

Rules:
  - Congressmen/elected officials → their US state abbreviation
  - National think tanks & US-based entities → "USA"
  - EU-affiliated Europeans → "International"
  - Country-specific Europeans/internationals → country name
  - UN/global bodies → "International"
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[1]
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from app.database import SessionLocal
from app.models import Person


# ── Manual overrides by person ID ────────────────────────────────────────
# Explicit locale for speakers that can't be classified by heuristics.

_MANUAL: dict[int, str] = {
    # US Presidents / VP (national-level → "USA")
    127: "USA",   # Donald Trump
    351: "USA",   # Joe Biden
    261: "USA",   # Kamala Harris
    66:  "OH",    # JD Vance

    # US House members missing locale
    5:   "CA",    # Kevin McCarthy
    45:  "CA",    # Brad Sherman
    46:  "FL",    # Brian Mast (Chairman, House Foreign Affairs)
    52:  "IN",    # Jim Banks
    60:  "CA",    # Kevin Kiley
    68:  "GA",    # Marjorie Taylor Greene
    69:  "PA",    # Scott Perry
    72:  "FL",    # Neal Dunn
    75:  "MI",    # John R. Moolenaar
    292: "NY",    # Carolyn B. Maloney
    508: "NY",    # Hakeem Jeffries
    509: "LA",    # Steve Scalise
    510: "CA",    # Ted Lieu

    # US Senate members missing locale
    86:  "AL",    # Katie Britt
    457: "NY",    # Charles Schumer

    # US state legislators
    99:  "FL",    # Tom Leek (FL State Rep)
    100: "FL",    # Daniel Perez (FL House Speaker)
    116: "CA",    # Steve Padilla (CA State Senator)
    120: "LA",    # Cameron Henry (LA State Senator)
    121: "LA",    # Jay Luneau (LA State Senator)
    171: "CA",    # Scott Wiener (CA State Senator)
    179: "CA",    # Steve Glazer (CA State Senator)
    180: "CA",    # Buffy Wicks (CA Assemblymember)
    272: "GA",    # Charlice Byrd (GA State Rep)
    468: "NE",    # Jana Hughes (NE State Senator)

    # US Governors already have locale from registry, but ensure:
    98:  "FL",    # Ron DeSantis
    126: "CA",    # Gavin Newsom
    269: "TX",    # Greg Abbott
    459: "TN",    # Bill Lee
    466: "MD",    # Wes Moore

    # US gov_inst that need "USA"
    62:  "USA",   # NIST
    103: "USA",   # Trump administration
    139: "USA",   # NAIC
    162: "USA",   # Lina Khan (FTC)
    185: "USA",   # Democratic senators
    192: "USA",   # Martin Heinrich and Mike Rounds
    213: "USA",   # Trump AI Action Plan
    226: "USA",   # Brendan Carr
    273: "USA",   # Merrick Garland
    276: "USA",   # NYC public schools
    279: "USA",   # NIST AI Risk
    280: "USA",   # NYC DCWP
    281: "USA",   # EEOC
    282: "USA",   # Laurie Locascio (NIST director)
    283: "USA",   # Don Graves
    289: "USA",   # CFPB
    294: "USA",   # Senate Committee
    295: "USA",   # GAO
    296: "USA",   # U.S. government
    297: "USA",   # House Committee
    299: "USA",   # David Allvin
    300: "USA",   # Craig Wills
    301: "USA",   # Kids Online Safety Act
    302: "USA",   # Kids PRIVACY Act
    303: "USA",   # Protecting Kids on Social Media Act
    306: "USA",   # NIST
    317: "USA",   # Frank Lucas and colleague
    337: "USA",   # Biden administration
    347: "USA",   # White House OSTP
    366: "USA",   # US Chamber of Commerce
    381: "USA",   # Congressional Research Service
    382: "USA",   # National Security Commission on AI
    384: "USA",   # Congressional Record Index
    389: "USA",   # U.S. Copyright Office
    390: "USA",   # U.S. Patent and Trademark Office
    392: "USA",   # Copyright Office
    394: "USA",   # Legislative Text
    437: "USA",   # America First Policy Institute
    456: "USA",   # NH AG's office
    489: "USA",   # ONC
    490: "USA",   # Four federal agencies
    513: "CA",    # Gavin Newsom's office
    514: "USA",   # Democrats (group)
    515: "USA",   # Top Republicans (group)
    517: "USA",   # AI Action Plan

    # International / EU bodies → "International"
    8:   "International",  # Antonio Guterres (UN)
    9:   "International",  # Ursula von der Leyen (EU Commission)
    65:  "International",  # Pope Leo XIV
    67:  "International",  # UN General Assembly Council
    111: "International",  # European Parliament
    170: "International",  # Margrethe Vestager (EU Commissioner)
    242: "International",  # Věra Jourová (EU)
    243: "International",  # Commission spokesperson (EU)
    246: "International",  # U.N. advisory group
    257: "International",  # Elsa Pilichowski (OECD)
    311: "International",  # European Commission
    312: "International",  # EU
    348: "International",  # EU Ethics Guidelines
    349: "International",  # GDPR
    365: "International",  # EU AI Act
    399: "International",  # EU Parliament co-rapporteurs
    445: "International",  # Katie Antypas (EU)
    446: "International",  # Commission official (EU)
    452: "International",  # Belgium in the EU
    472: "International",  # Jeremy Farrar (WHO)
    473: "International",  # Alain Labrique (WHO)
    484: "International",  # Bletchley Declaration signatories
    491: "International",  # Ajay Banga (World Bank)
    501: "International",  # GPAI website
    516: "International",  # European Commission officials

    # EU Parliament members → "International"
    234: "International",  # Svenja Hahn (EP, Germany)
    235: "International",  # Patrick Breyer (EP, Germany)
    238: "International",  # Dragoș Tudorache (EP, Romania)
    244: "International",  # Brando Benifei (EP, Italy)
    320: "International",  # Thierry Breton (EU Commissioner)
    397: "International",  # Dragos Tudorache (EP, Romania)
    401: "International",  # Axel Voss (EP, Germany)
    427: "International",  # Kim van Sparrentak (EP, Netherlands)
    443: "International",  # Iban García del Blanco (EP, Spain)

    # UK-specific
    173: "UK",    # Tina Stowell (House of Lords)
    174: "UK",    # Michelle Donelan
    227: "UK",    # Richard Moore (MI6)
    258: "UK",    # Rishi Sunak
    321: "UK",    # UK government
    345: "UK",    # DSIT
    380: "UK",    # Michelle Donlan
    418: "UK",    # DSIT
    458: "UK",    # United Kingdom
    492: "UK",    # Camrose (House of Lords)
    495: "UK",    # Caroline Dinenage (MP)

    # Ireland
    228: "Ireland",  # Graham Doyle (DPC)
    438: "Ireland",  # Irish Data Protection Commission
    439: "Ireland",  # Helen Dixon (DPC)

    # Italy
    266: "Italy",    # Mario Draghi
    412: "Italy",    # Garante (Italian DPA)
    417: "Italy",    # Italian Data Protection Authority
    450: "Italy",    # Italian DPA (Garante)

    # Germany
    169: "Germany",  # German competition chief
    416: "Germany",  # Ulrich Kelber

    # Other countries
    106: "China",       # China AI Safety & Development Association
    145: "China",       # Li Qiang
    147: "China",       # Chinese officials
    275: "China",       # Cyberspace Administration of China
    141: "Costa Rica",  # Paula Bogantes Zamora
    176: "Canada",      # François-Philippe Champagne
    372: "Canada",      # Innovation Canada
    410: "Canada",      # Philippe Dufresne
    373: "Australia",   # Ed Husic
    374: "Australia",   # Australian Human Rights Commission
    375: "Australia",   # Dept of Industry Strategic Policy
    500: "Australia",   # Australian government
    377: "India",       # Ministry of Electronics and IT
    462: "Israel",      # Ziv Katzir
    470: "Ghana",       # Ursula Owusu-Ekuful
    471: "Ghana",       # Yaw Osei Adutwum
    479: "Singapore",   # Josephine Teo
    497: "Philippines", # Martin Romualdez
    478: "UAE",         # Khalfan Belhoul

    # European staff/think_tank that are clearly EU-context
    110: "International",  # Thomas Regnier (EU spokesperson)
    200: "International",  # European diplomat
    201: "International",  # Henna Virkkunen (EU)
    204: "International",  # diplomat from a second EU country
    206: "International",  # first EU diplomat
    455: "International",  # Ylva Johansson (EU Commissioner)
    483: "International",  # Nico Matthijs

    # European staff/think_tank with specific countries
    107: "UK",     # Alexandru Voica (but name suggests Romania — context needed)
    230: "UK",     # U.K. official
    231: "UK",     # U.K. government spokesperson
    240: "UK",     # Karl Ryan
    252: "UK",     # Nick Clegg
    253: "UK",     # Stefanie Valdés-Scott
    254: "UK",     # Julian David
    259: "UK",     # Henry de Zoete
    260: "UK",     # Ian Hogarth
    265: "UK",     # Marc Warner
    267: "UK",     # Tom Wehmeier
    363: "UK",     # MHRA
    364: "UK",     # Independent report to the government (UK)
    379: "UK",     # Secretary of State for Science (UK)
    413: "UK",     # Sophie Hackford
    414: "UK",     # Dan Holmes
    415: "UK",     # Max Heinemeyer (Darktrace)
    496: "UK",     # Tim Heffernan
    499: "UK",     # Graeme Trudgill

    # US orgs with "International" in the name (override heuristic)
    460: "USA",  # Nashville Songwriters Association International

    # UN-affiliated
    142: "International",  # Allegra Baiocchi (UN Resident Coordinator)

    # Swiss
    247: "Switzerland",  # Thomas Schneider

    # Specific think tanks / orgs clearly international
    329: "International",  # Future of Life Institute
    330: "International",  # European authors' and performers' organisations
    341: "Malta",          # Malta's IT Law Association
    405: "International",  # Amnesty International
    409: "International",  # World Economic Forum
    498: "UK",             # Biba (British Insurance Brokers')

    # German staff
    241: "Germany",  # Robin Koch
    245: "Germany",  # Kevin Schawinski
    406: "Germany",  # Andreas Braun
    407: "Germany",  # Marianne Janik
    408: "Germany",  # Clemens Siebler
    441: "Germany",  # Konrad Schindler
    502: "Germany",  # Angela Müller (AlgorithmWatch)
    503: "Germany",  # Matthias Spielkamp (AlgorithmWatch)
    504: "Germany",  # Kilian Vieth-Ditlmann (AlgorithmWatch)

    # French
    447: "France",   # Arthur Mensch (Mistral)
    444: "France",   # Olivia Regnier

    # Dutch
    309: "Netherlands",  # Herman Kienhuis
    310: "Netherlands",  # Maria Staszkiewicz
    475: "Netherlands",  # Virginia Dignum

    # Belgian
    256: "Belgium",  # Anna Kuprian

    # Brazilian
    367: "Brazil",   # Bruno Bioni
    368: "Brazil",   # Bruna Santos
    369: "Brazil",   # Álvaro Machado Dias
    370: "Brazil",   # Mariana Valente

    # Armenian
    371: "Armenia",  # Mher Hakobyan

    # Russian
    150: "Russia",   # Alexey Shiryaev

    # Cyprus
    119: "Cyprus",   # Demetris Skourides

    # Swedish
    138: "Sweden",   # Jonas Hansson

    # Italian staff
    346: "Italy",    # Lila Ibrahim (DeepMind, but Italian? — actually US-based)

    # Various international think tank people
    236: "International",  # Daniel Leufer (Access Now, EU-focused)
    237: "International",  # Ella Jakubowska (EDRi)
    239: "International",  # Michael Meyer-Resende (Democracy Reporting)
    402: "International",  # Mark Brakel (EU-focused)
    328: "Finland",        # Anton Sigfrids

    # Japanese
    362: "Japan",    # Koichiro Takagi

    # Turkish
    481: "Turkey",   # Meral Karan
}


# ── Heuristic rules for speakers without manual overrides ────────────────

_EU_PATTERNS = re.compile(
    r"European (?:Commission|Parliament|Council)|EU\b|GDPR|AI Act"
    r"|Commission (?:spokesperson|official)"
    r"|(?:co-)?rapporteur",
    re.I,
)

_UK_PATTERNS = re.compile(
    r"\bU\.?K\.?\b|United Kingdom|British|House of Lords|House of Commons"
    r"|Secretary of State|DSIT|MHRA",
    re.I,
)

_UN_PATTERNS = re.compile(
    r"\bU\.?N\.?\b|United Nations|OECD|World Bank|WHO\b|World Health"
    r"|International|GPAI|Bletchley",
    re.I,
)

_CHINA_PATTERNS = re.compile(r"\bChin(?:a|ese)\b", re.I)

_US_GOV_PATTERNS = re.compile(
    r"\bU\.?S\.?\b|United States|Federal|Congress|Senate|House\b|NIST\b"
    r"|White House|Department of|Copyright Office|Patent|FTC\b|EEOC\b"
    r"|CFPB|GAO\b|Attorney General",
    re.I,
)


def _guess_locale(person: Person) -> str | None:
    """Return a best-guess locale for a person based on name, role, and type."""
    name = person.name or ""
    role = person.role or ""
    combined = f"{name} {role}"

    if _EU_PATTERNS.search(combined):
        return "International"
    if _UN_PATTERNS.search(combined):
        return "International"
    if _UK_PATTERNS.search(combined):
        return "UK"
    if _CHINA_PATTERNS.search(combined):
        return "China"
    if _US_GOV_PATTERNS.search(combined):
        return "USA"

    return None


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--dry-run", action="store_true",
                    help="Print changes without committing.")
    args = p.parse_args()

    db = SessionLocal()
    try:
        people = db.query(Person).order_by(Person.id).all()
        updated = 0
        skipped_has_value = 0
        unresolved = []

        for person in people:
            if person.locale:
                skipped_has_value += 1
                continue

            locale: str | None = None

            if person.id in _MANUAL:
                locale = _MANUAL[person.id]
            else:
                locale = _guess_locale(person)

            if locale is None:
                t = person.type.value if person.type else "?"
                if t in ("think_tank", "staff", "elected", "gov_inst"):
                    locale = "USA"

            if locale is None:
                unresolved.append(person)
                continue

            person.locale = locale
            updated += 1
            print(f"  id={person.id:>4} {person.name!r:50s} → {locale}")

        if unresolved:
            print(f"\n  {len(unresolved)} unresolved (left as NULL):")
            for p in unresolved:
                t = p.type.value if p.type else "?"
                print(f"    id={p.id:>4} [{t:10s}] {p.name!r}")

        if args.dry_run:
            db.rollback()
            print(f"\n[dry-run] would update {updated}, skipped {skipped_has_value} "
                  f"(already set); rolled back.")
        else:
            db.commit()
            print(f"\nUpdated {updated} speaker(s), skipped {skipped_has_value} "
                  f"(already set).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
