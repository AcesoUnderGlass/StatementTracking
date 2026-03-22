import json
import os
from typing import List

import anthropic
from dotenv import load_dotenv

load_dotenv()

SYSTEM_PROMPT = (
    "You are extracting direct quotes from news articles. Return only exact quoted "
    "speech (text that appears in quotation marks in the original article) from "
    "policymakers, government officials, government institutions, think tanks, or "
    "their staff members, where the quote discusses artificial intelligence in any "
    "context. For each quote return: the full quoted text, the name and title of the "
    "speaker as identified in the article, the speaker_type classification, and one "
    "to two sentences of surrounding context. "
    "speaker_type must be one of: 'elected' (elected officials), 'staff' (government "
    "or organizational staff), 'think_tank' (think tanks or research organizations), "
    "or 'gov_inst' (government agencies or institutions). When the quote is attributed "
    "to an organization rather than a named individual, use the organization name as "
    "speaker_name and its description as speaker_title. "
    "News articles frequently interrupt a single continuous quote with attribution text "
    "(e.g. 'said Senator X' or 'she continued'). When a speaker's quoted text is "
    "interrupted by attribution but resumes in the same paragraph or immediately "
    "following, treat the full statement as one quote. Reassemble the fragments into a "
    "single quote_text field, separated by an ellipsis where the attribution "
    "interruption occurred. Only treat two quotes from the same speaker as separate "
    "entries if they are clearly distinct statements made at different points in the "
    "article. "
    "Return a JSON object only, no other "
    'text. Schema: { "quotes": [{ "speaker_name": string, "speaker_title": string, '
    '"speaker_type": string, "quote_text": string, "context": string }] }'
)


class ExtractionError(Exception):
    pass


def extract_quotes(article_text: str) -> List[dict]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ExtractionError("ANTHROPIC_API_KEY is not set in environment.")

    client = anthropic.Anthropic(api_key=api_key)

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            temperature=0,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Extract all direct AI-related quotes from the following "
                        f"article:\n\n{article_text}"
                    ),
                }
            ],
        )
    except anthropic.APIError as e:
        raise ExtractionError(f"Anthropic API error: {e}")

    raw_text = response.content[0].text.strip()

    if raw_text.startswith("```"):
        lines = raw_text.split("\n")
        lines = [l for l in lines if not l.startswith("```")]
        raw_text = "\n".join(lines)

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        raise ExtractionError(
            f"Failed to parse LLM response as JSON. Raw response: {raw_text[:500]}"
        )

    if "quotes" not in data:
        raise ExtractionError("LLM response missing 'quotes' key.")

    return data["quotes"]
