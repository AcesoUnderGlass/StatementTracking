"""Tests for speaker title inference and registry."""

from app.models import Chamber, Party, Person, SpeakerType
from app.services.speaker_metadata import (
    enforce_org_person_constraints,
    enrich_person_from_existing_role,
    infer_from_title,
)


def test_infer_senator_paren_party_locale():
    r = infer_from_title("U.S. Senator (D-CA)")
    assert r["party"] == Party.democrat
    assert r["locale"] == "CA"
    assert r["chamber"] == Chamber.senate


def test_infer_representative_r_texas():
    r = infer_from_title("U.S. Representative (R-TX)")
    assert r["party"] == Party.republican
    assert r["locale"] == "TX"
    assert r["chamber"] == Chamber.house


def test_infer_independent():
    r = infer_from_title("Sen. Jane Doe (I-ME)")
    assert r["party"] == Party.independent
    assert r["locale"] == "ME"


def test_chief_of_staff_no_executive_chamber():
    r = infer_from_title("Chief of Staff to the President")
    assert "chamber" not in r


def test_org_type_clears_legislator_fields():
    p = Person(
        name="Test Org",
        type=SpeakerType.think_tank,
        party=Party.democrat,
        chamber=Chamber.senate,
        locale="CA",
    )
    assert enforce_org_person_constraints(p) is True
    assert p.party is None and p.chamber is None and p.locale is None


def test_enrich_from_role_only():
    p = Person(
        name="Margaret Holloway",
        type=SpeakerType.elected,
        role="U.S. Senator (D-CA)",
    )
    assert enrich_person_from_existing_role(p) is True
    assert p.party == Party.democrat
    assert p.locale == "CA"
    assert p.chamber == Chamber.senate


def test_infer_ap_style_party():
    r = infer_from_title("Rep., D-Ill.")
    assert r["party"] == Party.democrat
    assert r.get("chamber") == Chamber.house


def test_infer_house_chairman():
    r = infer_from_title("Chairman, House Science, Space, and Technology Committee")
    assert r["chamber"] == Chamber.house


def test_infer_senate_majority_leader():
    r = infer_from_title("Senate Majority Leader")
    assert r["chamber"] == Chamber.senate


def test_infer_ranking_member_house():
    r = infer_from_title("Ranking Member, House Committee on Foreign Affairs")
    assert r["chamber"] == Chamber.house


def test_registry_reclassifies_staff():
    p = Person(name="Garrett Auzenne", type=SpeakerType.elected)
    assert enrich_person_from_existing_role(p) is True
    assert p.type == SpeakerType.staff


def test_registry_fills_governor():
    p = Person(name="Ron DeSantis", type=SpeakerType.elected)
    assert enrich_person_from_existing_role(p) is True
    assert p.party == Party.republican
    assert p.chamber == Chamber.executive
    assert p.locale == "FL"
