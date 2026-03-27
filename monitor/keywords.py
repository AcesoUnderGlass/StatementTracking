"""Canonical AI-relevance keyword list and matching function.

All monitors use this shared filter so keyword sets stay consistent.
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

_WORD_BOUNDARY_AI_RE = re.compile(r"\bAI\b")

_COMPOUND_PATTERNS = [
    re.compile(re.escape(term), re.IGNORECASE) for term in COMPOUND_TERMS
]
_SINGLE_PATTERNS = [
    re.compile(r"\b" + re.escape(term) + r"\b", re.IGNORECASE)
    for term in SINGLE_TERMS
]


def is_relevant(title: str, description: str = "") -> bool:
    """Check if the text contains AI-related keywords.

    Uses word-boundary matching so 'CHAIR' won't match 'AI'.
    Checks title first (faster), falls back to description.
    """
    text = f"{title} {description}"

    for pat in _COMPOUND_PATTERNS:
        if pat.search(text):
            return True

    if _WORD_BOUNDARY_AI_RE.search(text):
        return True

    for pat in _SINGLE_PATTERNS:
        if pat.search(text):
            return True

    return False
