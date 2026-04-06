"""Derive and apply speaker metadata (party, chamber, locales, role) from titles and a small registry."""

from __future__ import annotations

import re
from typing import Any, TypedDict

from ..models import Chamber, Party, Person, SpeakerType
from .speaker_aliases import canonical_speaker_name


class _Inferred(TypedDict, total=False):
    party: Party
    chamber: Chamber
    locales: list[str]


# Lowercase canonical name → optional fields applied only when the corresponding
# Person field is empty (except type corrections, which always apply for known aliases).

def _R(**kw: Any) -> dict[str, Any]:
    """Shorthand for registry entries."""
    return kw

_E = SpeakerType.elected
_S = SpeakerType.staff
_TT = SpeakerType.think_tank
_GI = SpeakerType.gov_inst
_D = Party.democrat
_Rep = Party.republican
_I = Party.independent
_O = Party.other
_Sen = Chamber.senate
_Hou = Chamber.house
_Exe = Chamber.executive
_Oth = Chamber.other

_SPEAKER_REGISTRY: dict[str, dict[str, Any]] = {
    # ── Presidents & VP ────────────────────────────────────────────
    "donald trump":       _R(party=_Rep, chamber=_Exe, role="President"),
    "president trump":    _R(party=_Rep, chamber=_Exe, role="President"),
    "the president":      _R(party=_Rep, chamber=_Exe, role="President"),
    "joe biden":          _R(party=_D,   chamber=_Exe, role="President (former)"),
    "president biden":    _R(party=_D,   chamber=_Exe, role="President (former)"),
    "kamala harris":      _R(party=_D,   chamber=_Exe, role="Vice President (former)"),
    "jd vance":           _R(party=_Rep, chamber=_Exe, role="Vice President"),

    # ── Executive entities (gov_inst) ──────────────────────────────
    "trump administration":     _R(type=_GI, role="Executive branch (Trump administration)"),
    "biden administration":     _R(type=_GI, role="Executive branch (Biden administration)"),
    "gavin newsom's office":    _R(type=_GI, role="Office of Governor Gavin Newsom"),
    "democratic senators":      _R(type=_GI, role="Democratic Senate caucus"),
    "democrats":                _R(type=_GI, role="Democratic Party (group reference)"),
    "top republicans":          _R(type=_GI, role="Republican Party (group reference)"),
    "chinese officials":        _R(type=_GI, role="Government of China"),
    "european parliament co-rapporteurs": _R(type=_GI, role="EU Parliament AI Act co-rapporteurs"),
    "frank lucas and colleague": _R(type=_GI, role="House Science Committee leadership"),

    # ── Staff / think-tank reclassifications ───────────────────────
    "garrett auzenne":      _R(type=_S, role="Senior legislative counsel for Rep. Sheila Jackson Lee"),
    "lars erik schönander":  _R(type=_TT, employer="Lincoln Network", role="Policy technologist"),
    "marci harris":          _R(type=_TT, employer="POPVOX Foundation", role="CEO"),
    "daniel schuman":        _R(type=_TT, employer="Demand Progress", role="Policy director"),
    "andrew yang":           _R(type=_TT, role="Former Presidential Candidate and CEO of Noble Mobile"),
    "lina khan":             _R(type=_GI, role="Chair, Federal Trade Commission"),
    "merrick garland":       _R(type=_GI, role="Attorney General"),

    # ── US Governors ───────────────────────────────────────────────
    "gavin newsom":     _R(party=_D,   chamber=_Exe, locales=["CA"], role="Governor of California"),
    "gov. gavin newsom": _R(party=_D,  chamber=_Exe, locales=["CA"], role="Governor of California"),
    "ron desantis":     _R(party=_Rep, chamber=_Exe, locales=["FL"], role="Governor of Florida"),
    "greg abbott":      _R(party=_Rep, chamber=_Exe, locales=["TX"], role="Governor of Texas"),
    "wes moore":        _R(party=_D,   chamber=_Exe, locales=["MD"], role="Governor of Maryland"),
    "bill lee":         _R(party=_Rep, chamber=_Exe, locales=["TN"], role="Governor of Tennessee"),

    # ── US Senators ────────────────────────────────────────────────
    "bernie sanders":      _R(party=_I,   chamber=_Sen, locales=["VT"], role="Senator (I-VT)"),
    "sen. bernie sanders": _R(party=_I,   chamber=_Sen, locales=["VT"], role="Senator (I-VT)"),
    "charles schumer":     _R(party=_D,   chamber=_Sen, locales=["NY"], role="Senate Majority Leader"),
    "chuck schumer":       _R(party=_D,   chamber=_Sen, locales=["NY"], role="Senate Majority Leader"),
    "ted cruz":            _R(party=_Rep, chamber=_Sen, locales=["TX"], role="Senator (R-TX)"),
    "tom cotton":          _R(party=_Rep, chamber=_Sen, locales=["AR"], role="Senator (R-AR)"),
    "sheldon whitehouse":  _R(party=_D,   chamber=_Sen, locales=["RI"], role="Senator (D-RI)"),
    "maria cantwell":      _R(party=_D,   chamber=_Sen, locales=["WA"], role="Senator (D-WA)"),
    "gary peters":         _R(party=_D,   chamber=_Sen, locales=["MI"], role="Senator (D-MI)"),
    "mike rounds":         _R(party=_Rep, chamber=_Sen, locales=["SD"], role="Senator (R-SD)"),
    "sen. josh hawley":    _R(party=_Rep, chamber=_Sen, locales=["MO"], role="Senator (R-MO)"),
    "sen. richard blumenthal": _R(party=_D, chamber=_Sen, locales=["CT"], role="Senator (D-CT)"),
    "sen. warner":         _R(party=_D,   chamber=_Sen, locales=["VA"], role="Senator (D-VA)"),

    # ── US House ───────────────────────────────────────────────────
    "mike johnson":                _R(party=_Rep, chamber=_Hou, locales=["LA"], role="Speaker of the House"),
    "nancy mace":                  _R(party=_Rep, chamber=_Hou, locales=["SC"], role="Representative (R-SC)"),
    "hakeem jeffries":             _R(party=_D,   chamber=_Hou, locales=["NY"], role="House Minority Leader"),
    "steve scalise":               _R(party=_Rep, chamber=_Hou, locales=["LA"], role="House Majority Leader"),
    "ted lieu":                    _R(party=_D,   chamber=_Hou, locales=["CA"], role="Representative (D-CA)"),
    "josh gottheimer":             _R(party=_D,   chamber=_Hou, locales=["NJ"], role="Representative (D-NJ)"),
    "mike gallagher":              _R(party=_Rep, chamber=_Hou, locales=["WI"], role="Representative (R-WI)"),
    "rep. byron donalds":          _R(party=_Rep, chamber=_Hou, locales=["FL"], role="Representative (R-FL)"),
    "rep. david schweikert":       _R(party=_Rep, chamber=_Hou, locales=["AZ"], role="Representative (R-AZ)"),
    "rep. ro khanna":              _R(party=_D,   chamber=_Hou, locales=["CA"], role="Representative (D-CA)"),
    "chairwoman carolyn b. maloney": _R(party=_D, chamber=_Hou, locales=["NY"], role="Chairwoman, House Oversight Committee"),
    "brett guthrie":               _R(party=_Rep, chamber=_Hou, locales=["KY"], role="Representative (R-KY)"),
    "ami bera":                    _R(party=_D,   chamber=_Hou, locales=["CA"], role="Representative (D-CA)"),
    "bill foster":                 _R(party=_D,   chamber=_Hou, locales=["IL"], role="Representative (D-IL)"),
    "brittany pettersen":          _R(party=_D,   chamber=_Hou, locales=["CO"], role="Representative (D-CO)"),
    "don beyer":                   _R(party=_D,   chamber=_Hou, locales=["VA"], role="Representative (D-VA)"),
    "haley stevens":               _R(party=_D,   chamber=_Hou, locales=["MI"], role="Representative (D-MI)"),
    "scott franklin":              _R(party=_Rep, chamber=_Hou, locales=["FL"], role="Representative (R-FL)"),
    "sara jacobs":                 _R(party=_D,   chamber=_Hou, locales=["CA"], role="Representative (D-CA)"),
    "sam liccardo":                _R(party=_D,   chamber=_Hou, locales=["CA"], role="Representative (D-CA)"),
    "zoe lofgren":                 _R(party=_D,   chamber=_Hou, locales=["CA"], role="Representative (D-CA)"),
    "gregory meeks":               _R(party=_D,   chamber=_Hou, locales=["NY"], role="Representative (D-NY)"),
    "jay obernolte":               _R(party=_Rep, chamber=_Hou, locales=["CA"], role="Representative (R-CA)"),
    "brian babin":                 _R(party=_Rep, chamber=_Hou, locales=["TX"], role="Representative (R-TX)"),
    "brian mast":                  _R(party=_Rep, chamber=_Hou, locales=["FL"], role="Representative (R-FL)"),
    "rep. eli crane":              _R(party=_Rep, chamber=_Hou, locales=["AZ"], role="Representative (R-AZ)"),
    "rep. nathaniel moran":        _R(party=_Rep, chamber=_Hou, locales=["TX"], role="Representative (R-TX)"),
    "nathaniel moran":             _R(party=_Rep, chamber=_Hou, locales=["TX"], role="Representative (R-TX)"),
    "ritchie torres":              _R(party=_D,   chamber=_Hou, locales=["NY"], role="Representative (D-NY)"),
    "seth moulton":                _R(party=_D,   chamber=_Hou, locales=["MA"], role="Representative (D-MA)"),
    "eric burlison":               _R(party=_Rep, chamber=_Hou, locales=["MO"], role="Representative (R-MO)"),
    "raja krishnamoorthi":         _R(party=_D,   chamber=_Hou, locales=["IL"], role="Representative (D-IL)"),
    "ted w. lieu":                 _R(party=_D,   chamber=_Hou, locales=["CA"], role="Representative (D-CA)"),
    "jill tokuda":                 _R(party=_D,   chamber=_Hou, locales=["HI"], role="Representative (D-HI)"),
    "rick nun":                    _R(party=_Rep, chamber=_Hou, role="Representative"),
    "martin heinrich and mike rounds": _R(type=_GI, role="Senate AI Caucus co-chairs"),

    # ── CA state legislators ───────────────────────────────────────
    "scott wiener":   _R(party=_D, role="California State Senator"),
    "steve padilla":  _R(party=_D, role="California State Senator"),
    "steve glazer":   _R(party=_D, role="California State Senator"),
    "buffy wicks":    _R(party=_D, role="California State Assemblymember"),

    # ── FL state legislators ───────────────────────────────────────
    "daniel perez":   _R(party=_Rep, role="Speaker, Florida House of Representatives"),
    "tom leek":       _R(party=_Rep, role="Florida State Representative"),

    # ── LA state legislators ───────────────────────────────────────
    "cameron henry":  _R(party=_Rep, role="Louisiana State Senator"),
    "jay luneau":     _R(party=_D,   role="Louisiana State Senator"),

    # ── Other state / local ────────────────────────────────────────
    "jana hughes":    _R(party=_Rep, role="Nebraska State Senator"),
    "charlice byrd":  _R(party=_Rep, role="Georgia State Representative"),

    # ── Foreign officials (party=Other where applicable) ───────────
    "rishi sunak":                      _R(party=_O, role="UK Prime Minister (former)"),
    "michelle donelan":                 _R(party=_O, role="UK Secretary of State for Science"),
    "michelle donlan":                  _R(party=_O, role="UK Secretary of State for Science"),
    "baroness stowell":                 _R(party=_O, role="UK House of Lords"),
    "tina stowell, baroness stowell of beeston": _R(party=_O, role="UK House of Lords"),
    "viscount camrose":                 _R(party=_O, role="UK House of Lords"),
    "dame caroline dinenage mp":        _R(party=_O, role="UK Member of Parliament"),
    "axel voss":                        _R(party=_O, role="European Parliament Member (Germany)"),
    "brando benifei":                   _R(party=_O, role="European Parliament Member (Italy)"),
    "dragos tudorache":                 _R(party=_O, role="European Parliament Member (Romania)"),
    "dragoș tudorache":                 _R(party=_O, role="European Parliament Member (Romania)"),
    "patrick breyer":                   _R(party=_O, role="European Parliament Member (Germany)"),
    "svenja hahn":                      _R(party=_O, role="European Parliament Member (Germany)"),
    "kim van sparrentak":               _R(party=_O, role="European Parliament Member (Netherlands)"),
    "iban garcía del blanco":           _R(party=_O, role="European Parliament Member (Spain)"),
    "thierry breton":                   _R(party=_O, role="European Commissioner for Internal Market"),
    "mario draghi":                     _R(party=_O, role="Former Prime Minister of Italy"),
    "chinese premier li qiang":         _R(party=_O, role="Premier of the State Council, China"),
    "françois-philippe champagne":      _R(party=_O, role="Canadian Minister of Innovation"),
    "ed husic":                         _R(party=_O, role="Australian Minister for Industry and Science"),
    "paula bogantes zamora":            _R(party=_O, role="Costa Rican Minister of Science and Technology"),
    "josephine teo":                    _R(party=_O, role="Singapore Minister for Communications"),
    "dr yaw osei adutwum":              _R(party=_O, role="Ghana Minister of Education"),
    "ursula owusu-ekuful":              _R(party=_O, role="Ghana Minister of Communications"),
    "martin romualdez":                 _R(party=_O, role="Speaker, Philippine House of Representatives"),
    "antonio guterres":                 _R(party=_O, chamber=_Oth, role="Secretary-General of the United Nations"),
}


def _party_from_paren_letter(letter: str) -> Party | None:
    u = letter.upper()
    if u == "D":
        return Party.democrat
    if u == "R":
        return Party.republican
    if u == "I":
        return Party.independent
    return None


def infer_from_title(title: str | None) -> _Inferred:
    """Best-effort party, chamber, and locales from a title string (e.g. U.S. Senator (D-CA))."""
    if not title or not str(title).strip():
        return {}
    t = str(title).strip()
    out: _Inferred = {}

    # "(D-CA)" or "(R-TX)" style
    m = re.search(r"\(([DRI])-([A-Z]{2})\)", t, re.I)
    if m:
        p = _party_from_paren_letter(m.group(1))
        if p is not None:
            out["party"] = p
        out["locales"] = [m.group(2).upper()]

    # "Rep., D-Ill." / "D-Texas" / "R-Ohio" (AP abbreviation style)
    if "party" not in out:
        m2 = re.search(r"\b([DRI])-[A-Z][a-z]", t)
        if m2:
            p = _party_from_paren_letter(m2.group(1))
            if p is not None:
                out["party"] = p

    # ── Chamber inference ──────────────────────────────────────────
    _senate_pat = (
        r"\b(?:U\.?S\.?\s+)?Senator\b"
        r"|\bSen\."
        r"|\bSenate\s+(?:Majority|Minority)\s+Leader\b"
        r"|\bSenate\b.*\bChair"
    )
    _house_pat = (
        r"\b(?:U\.?S\.?\s+)?Representative\b"
        r"|\bRep\."
        r"|\bCongress(?:man|woman|person)\b"
        r"|\bSpeaker(?:\s+of\s+the|\,)\s+.*House\b"
        r"|\bHouse\s+(?:Majority|Minority)\s+Leader\b"
        r"|\bRanking\s+Member,?\s+House\b"
        r"|\bChair(?:man|woman|person)?,?\s+House\b"
    )
    _exec_pat = (
        r"\b(?:Vice\s+President|Governor|Mayor)\b"
        r"|\bU\.?S\.?\s+President\b"
        r"|^President\b"
    )

    if re.search(_senate_pat, t, re.I):
        out["chamber"] = Chamber.senate
    elif re.search(_house_pat, t, re.I):
        out["chamber"] = Chamber.house
    elif re.search(_exec_pat, t, re.I):
        out["chamber"] = Chamber.executive

    return out


def _registry_row(name: str) -> dict[str, Any] | None:
    key = canonical_speaker_name(name).strip().lower()
    return _SPEAKER_REGISTRY.get(key)


def enforce_org_person_constraints(person: Person) -> bool:
    """Clear legislator-only fields for non-elected types. Returns True if anything changed."""
    if person.type not in (SpeakerType.think_tank, SpeakerType.gov_inst, SpeakerType.staff):
        return False
    changed = False
    if person.party is not None:
        person.party = None
        changed = True
    if person.chamber is not None:
        person.chamber = None
        changed = True
    if person.locales:
        person.locales = []
        changed = True
    return changed


def apply_registry(person: Person, *, created: bool = False) -> bool:
    """Merge registry fields into *person* when fields are empty; fix type for known aliases."""
    row = _registry_row(person.name)
    if not row:
        return False
    changed = False
    if "type" in row and person.type != row["type"]:
        person.type = row["type"]
        changed = True
    for key in ("party", "chamber", "locales", "role", "employer", "notes"):
        if key not in row:
            continue
        cur = getattr(person, key)
        if not cur and row[key]:
            setattr(person, key, row[key])
            changed = True
    return changed


def enrich_person_from_extracted(person: Person, eq: Any, *, created: bool = False) -> bool:
    """
    Fill Person fields from extraction + title inference + registry.
    *eq* should have speaker_title, speaker_type; typically an ExtractedQuote.
    Returns True if any column was modified.
    """
    changed = False
    title = getattr(eq, "speaker_title", None)

    if title and not person.role:
        person.role = str(title).strip()
        changed = True

    if apply_registry(person, created=created):
        changed = True

    if person.type in (SpeakerType.think_tank, SpeakerType.gov_inst, SpeakerType.staff):
        if enforce_org_person_constraints(person):
            changed = True
        return changed

    inferred = infer_from_title(person.role)
    if person.party is None and "party" in inferred:
        person.party = inferred["party"]
        changed = True
    if person.chamber is None and "chamber" in inferred:
        person.chamber = inferred["chamber"]
        changed = True
    if not person.locales and "locales" in inferred:
        person.locales = inferred["locales"]
        changed = True

    return changed


def enrich_person_from_existing_role(person: Person) -> bool:
    """Backfill: infer from *person.role* and registry only (no ExtractedQuote)."""
    changed = False
    if apply_registry(person, created=False):
        changed = True
    if person.type in (SpeakerType.think_tank, SpeakerType.gov_inst, SpeakerType.staff):
        if enforce_org_person_constraints(person):
            changed = True
        return changed
    inferred = infer_from_title(person.role)
    if person.party is None and "party" in inferred:
        person.party = inferred["party"]
        changed = True
    if person.chamber is None and "chamber" in inferred:
        person.chamber = inferred["chamber"]
        changed = True
    if not person.locales and "locales" in inferred:
        person.locales = inferred["locales"]
        changed = True
    return changed
