"""Infer jurisdiction tags for an existing quote using Claude."""

import json
import os
from typing import List, Optional

from dotenv import load_dotenv

load_dotenv()

SYSTEM_PROMPT = (
    "You assign jurisdiction tags to a policy quote about artificial intelligence. "
    "Tags describe the subject matter of the statement (NOT the speaker's location or identity). "
    "Choose exclusively from the canonical list in the user message. "
    "When a specific US state is relevant, tag both the state name and 'US-state'. "
    "When a specific US city or county is relevant, tag both the locality name and 'US-local'. "
    "IMPORTANT: 'US-local' is ONLY for US cities and counties. For non-US countries (e.g. China, "
    "Japan, India, EU member states), use the country's canonical tag — never 'US-local'. "
    "Only create a new tag if absolutely nothing in the canonical list fits; never create synonyms of "
    "existing tags. "
    "If the quote discusses AI, AI risk, AI governance, or technology policy in any way, assign at least "
    "one tag from the list (use the best geographic or institutional scope implied by the subject). "
    "Return a JSON object only, no other text. Schema: { \"jurisdictions\": string[] }"
)


class JurisdictionTagError(Exception):
    pass


def _strip_code_fence(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        lines = [l for l in text.split("\n") if not l.startswith("```")]
        text = "\n".join(lines)
    return text.strip()


def infer_jurisdiction_tags(
    *,
    canonical_jurisdiction_block: str,
    quote_text: str,
    context: Optional[str],
    speaker_name: str,
    article_title: Optional[str],
    article_url: Optional[str],
) -> List[str]:
    """Call Claude to get jurisdiction tag names for one quote."""
    import anthropic

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise JurisdictionTagError("ANTHROPIC_API_KEY is not set in environment.")

    parts = [
        "Canonical jurisdiction tag names (choose only from this list unless no entry fits; "
        "use the exact name string, not synonyms):\n\n",
        canonical_jurisdiction_block,
        "\n\n---\nQuote text:\n",
        quote_text,
    ]
    if context:
        parts.extend(["\n\nContext:\n", context])
    parts.extend(["\n\nSpeaker: ", speaker_name])
    if article_title:
        parts.extend(["\nArticle title: ", article_title])
    if article_url:
        parts.extend(["\nArticle URL: ", article_url])

    user_message = "".join(parts)

    client = anthropic.Anthropic(api_key=api_key)
    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            temperature=0,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
    except anthropic.APIError as e:
        raise JurisdictionTagError(f"Anthropic API error: {e}") from e

    raw_text = _strip_code_fence(response.content[0].text)

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as e:
        raise JurisdictionTagError(
            f"Failed to parse LLM response as JSON. Raw response: {raw_text[:500]}"
        ) from e

    if "jurisdictions" not in data:
        raise JurisdictionTagError("LLM response missing 'jurisdictions' key.")

    raw_list = data["jurisdictions"]
    if not isinstance(raw_list, list):
        raise JurisdictionTagError("'jurisdictions' must be an array.")

    out: List[str] = []
    for x in raw_list:
        if x is None:
            continue
        s = str(x).strip()
        if s:
            out.append(s)
    return out
