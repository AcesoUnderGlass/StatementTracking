"""Canonical AI-relevance keyword list and matching function.

All monitors use this shared filter so keyword sets stay consistent.

The filter uses a two-signal approach: an article must mention BOTH
an AI-related term AND a government/policy-making term to pass.
This filters out corporate AI announcements, product launches, and
industry press that aren't about government policy-making.
"""
from __future__ import annotations

import re

COMPOUND_TERMS = [
    "artificial intelligence",
    "machine learning",
    "deep learning",
    "generative AI",
    "generative artificial intelligence",
    "large language model",
    "foundation model",
    "frontier model",
    "neural network",
    "computer vision",
    "natural language processing",
    "AI regulation",
    "AI safety",
    "AI governance",
    "AI policy",
    "AI executive order",
    "AI bill",
    "AI act",
    "AI framework",
    "AI risk",
    "AI transparency",
    "AI accountability",
    "AI ethics",
    "AI literacy",
    "AI workforce",
    "algorithmic bias",
    "algorithmic accountability",
    "algorithmic transparency",
    "automated decision",
]

SINGLE_TERMS = [
    "LLM",
    "ChatGPT",
    "GPT",
    "Claude",
    "Gemini",
    "deepfake",
    "deepfakes",
    "OpenAI",
    "Anthropic",
    "DeepMind",
]

# Terms that already encode a government-policy signal, so they don't
# need a separate POLICY_SIGNALS hit to qualify.
_SELF_QUALIFYING_COMPOUNDS = {
    "AI regulation",
    "AI safety",
    "AI governance",
    "AI policy",
    "AI executive order",
    "AI bill",
    "AI act",
    "AI framework",
    "AI transparency",
    "AI accountability",
    "AI ethics",
    "AI literacy",
    "AI workforce",
    "algorithmic bias",
    "algorithmic accountability",
    "algorithmic transparency",
    "automated decision",
}

POLICY_COMPOUND_SIGNALS = [
    "executive order",
    "federal register",
    "national security",
    "public comment",
    "public hearing",
    "rulemaking",
    "rule making",
    "notice of proposed",
    "bipartisan",
    "congressional hearing",
    "congressional review",
    "supreme court",
    "circuit court",
    "attorney general",
    "national institute",
    "trade commission",
    "appropriations committee",
    "oversight committee",
    "intelligence committee",
    "armed services committee",
    "commerce committee",
    "european commission",
    "european parliament",
    "member states",
    "data protection",
    "civil liberties",
    "civil rights",
    "government accountability",
]

POLICY_SINGLE_SIGNALS = [
    "legislation",
    "legislative",
    "legislator",
    "legislatures",
    "regulate",
    "regulation",
    "regulatory",
    "regulators",
    "Congress",
    "congressional",
    "Senate",
    "senator",
    "senators",
    "House",
    "representative",
    "representatives",
    "lawmaker",
    "lawmakers",
    "bipartisan",
    "committee",
    "subcommittee",
    "hearing",
    "hearings",
    "testimony",
    "testify",
    "bill",
    "statute",
    "amendment",
    "mandate",
    "moratorium",
    "ban",
    "enforcement",
    "compliance",
    "noncompliance",
    "NIST",
    "FTC",
    "DOJ",
    "SEC",
    "FDA",
    "OSTP",
    "OMB",
    "GAO",
    "CISA",
    "DHS",
    "DOD",
    "NSF",
    "DARPA",
    "NATO",
    "OECD",
    "G7",
    "parliament",
    "parliamentary",
    "commissioner",
    "governor",
    "governors",
    "mayor",
    "Biden",
    "Trump",
    "White House",
    "Schumer",
    "Blumenthal",
    "Hawley",
    "Wicker",
    "EU",
    "GDPR",
    "sovereign",
    "sovereignty",
    "policymaker",
    "policymakers",
    "jurisdiction",
    "ordinance",
    "directive",
    "proclamation",
    "veto",
    "ratify",
    "enact",
    "codify",
]

_WORD_BOUNDARY_AI_RE = re.compile(r"\bAI\b")

_COMPOUND_PATTERNS = [
    re.compile(re.escape(term), re.IGNORECASE) for term in COMPOUND_TERMS
]
_SINGLE_PATTERNS = [
    re.compile(r"\b" + re.escape(term) + r"\b", re.IGNORECASE)
    for term in SINGLE_TERMS
]

_SELF_QUALIFYING_PATTERNS = [
    re.compile(re.escape(term), re.IGNORECASE)
    for term in _SELF_QUALIFYING_COMPOUNDS
]

_POLICY_COMPOUND_PATTERNS = [
    re.compile(re.escape(term), re.IGNORECASE) for term in POLICY_COMPOUND_SIGNALS
]
_POLICY_SINGLE_PATTERNS = [
    re.compile(r"\b" + re.escape(term) + r"\b", re.IGNORECASE)
    for term in POLICY_SINGLE_SIGNALS
]


def _has_ai_keyword(text: str) -> bool:
    """Return True if the text contains any AI-related keyword."""
    for pat in _COMPOUND_PATTERNS:
        if pat.search(text):
            return True
    if _WORD_BOUNDARY_AI_RE.search(text):
        return True
    for pat in _SINGLE_PATTERNS:
        if pat.search(text):
            return True
    return False


def _has_self_qualifying_keyword(text: str) -> bool:
    """Return True if the text contains a compound AI term that already
    implies government policy (e.g. 'AI regulation', 'algorithmic bias')."""
    for pat in _SELF_QUALIFYING_PATTERNS:
        if pat.search(text):
            return True
    return False


def _has_policy_signal(text: str) -> bool:
    """Return True if the text contains a government/policy-making signal."""
    for pat in _POLICY_COMPOUND_PATTERNS:
        if pat.search(text):
            return True
    for pat in _POLICY_SINGLE_PATTERNS:
        if pat.search(text):
            return True
    return False


def is_relevant(title: str, description: str = "") -> bool:
    """Check if the article is about government AI policy-making.

    Requires two signals:
      1. An AI-related keyword, AND
      2. A government/policy-making keyword.

    Compound terms like 'AI regulation' or 'algorithmic accountability'
    satisfy both signals at once since they inherently reference policy.
    """
    text = f"{title} {description}"

    if _has_self_qualifying_keyword(text):
        return True

    if not _has_ai_keyword(text):
        return False

    return _has_policy_signal(text)
