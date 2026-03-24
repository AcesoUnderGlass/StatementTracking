"""Infer topic tags for an existing quote using Claude."""

import json
import os
from typing import List, Optional

import anthropic
from dotenv import load_dotenv

load_dotenv()

SYSTEM_PROMPT = (
    "You assign topic tags to a policy quote about artificial intelligence. "
    "Tags describe what the quote is about (e.g. regulation, jobs, existential risk). "
    "Strongly prefer tags from the canonical list in the user message. "
    "A quote may have more than one topic. "
    "Only create a new tag if absolutely nothing in the canonical list fits; "
    "never create synonyms of existing tags. "
    'Return a JSON object only, no other text. Schema: { "topics": string[] }'
)


class TopicTagError(Exception):
    pass


def _strip_code_fence(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        lines = [l for l in text.split("\n") if not l.startswith("```")]
        text = "\n".join(lines)
    return text.strip()


def infer_topic_tags(
    *,
    canonical_topic_block: str,
    quote_text: str,
    context: Optional[str],
    speaker_name: str,
    article_title: Optional[str],
    article_url: Optional[str],
) -> List[str]:
    """Call Claude to get topic tag names for one quote."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise TopicTagError("ANTHROPIC_API_KEY is not set in environment.")

    parts = [
        "Canonical topic tag names (strongly prefer tags from this list; "
        "only create a new tag if nothing fits):\n\n",
        canonical_topic_block,
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
        raise TopicTagError(f"Anthropic API error: {e}") from e

    raw_text = _strip_code_fence(response.content[0].text)

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as e:
        raise TopicTagError(
            f"Failed to parse LLM response as JSON. Raw response: {raw_text[:500]}"
        ) from e

    if "topics" not in data:
        raise TopicTagError("LLM response missing 'topics' key.")

    raw_list = data["topics"]
    if not isinstance(raw_list, list):
        raise TopicTagError("'topics' must be an array.")

    out: List[str] = []
    for x in raw_list:
        if x is None:
            continue
        s = str(x).strip()
        if s:
            out.append(s)
    return out
