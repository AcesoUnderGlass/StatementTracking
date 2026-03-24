import json
import os
from typing import List

import anthropic
from dotenv import load_dotenv

load_dotenv()

ARTICLE_SYSTEM_PROMPT = (
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
    "For each quote, also assign jurisdiction tags describing the subject matter of "
    "the statement (NOT the speaker's location or identity). Choose exclusively from "
    "the canonical list provided in the user message below. When a specific US state is "
    "relevant, tag both the state name and 'US-state'. When a specific US city or "
    "county is relevant, tag both the locality name and 'US-local'. Only create a new "
    "tag if absolutely nothing in the canonical list fits; never create synonyms of "
    "existing tags. Return jurisdictions as an array of tag name strings. "
    "For each quote, also assign topic tags describing what the quote is about. "
    "Strongly prefer tags from the canonical topic list provided in the user message. "
    "A quote may have more than one topic. Only create a new topic tag if absolutely "
    "nothing in the canonical list fits; never create synonyms of existing tags. "
    "Return topics as an array of tag name strings. "
    "Return a JSON object only, no other "
    'text. Schema: { "quotes": [{ "speaker_name": string, "speaker_title": string, '
    '"speaker_type": string, "quote_text": string, "context": string, '
    '"jurisdictions": string[], "topics": string[] }] }'
)

TRANSCRIPT_SYSTEM_PROMPT = (
    "You are extracting notable, substantive statements about artificial intelligence "
    "from a YouTube video transcript. The transcript is spoken word — there are no "
    "quotation marks. Your job is to identify the most meaningful AI-related statements "
    "made by speakers in the video. "
    "Use the VIDEO DESCRIPTION and video title (provided in the user message) to "
    "identify who is speaking. If the video is an interview or panel, use contextual "
    "clues (introductions, name mentions, 'you said', etc.) to attribute statements to "
    "specific speakers. If the speaker cannot be determined, use the channel name or "
    "'Unknown Speaker'. "
    "Focus on statements from policymakers, government officials, government "
    "institutions, think tanks, industry leaders, or their staff members. "
    "For each extracted statement return: the substantive text (cleaned up for "
    "readability — remove filler words and false starts, but preserve the speaker's "
    "meaning and wording), the speaker's name and title as best you can determine, "
    "the speaker_type classification, and one to two sentences of context about what "
    "was being discussed. "
    "speaker_type must be one of: 'elected' (elected officials), 'staff' (government "
    "or organizational staff), 'think_tank' (think tanks or research organizations), "
    "or 'gov_inst' (government agencies or institutions). If the speaker does not fit "
    "these categories (e.g. a tech CEO or journalist), still extract the quote but use "
    "the closest matching type. "
    "Merge consecutive sentences from the same speaker on the same point into a single "
    "quote. Only create separate entries for clearly distinct statements or topics. "
    "For each quote, also assign jurisdiction tags describing the subject matter of "
    "the statement (NOT the speaker's location or identity). Choose exclusively from "
    "the canonical list provided in the user message below. When a specific US state is "
    "relevant, tag both the state name and 'US-state'. When a specific US city or "
    "county is relevant, tag both the locality name and 'US-local'. Only create a new "
    "tag if absolutely nothing in the canonical list fits; never create synonyms of "
    "existing tags. Return jurisdictions as an array of tag name strings. "
    "For each quote, also assign topic tags describing what the quote is about. "
    "Strongly prefer tags from the canonical topic list provided in the user message. "
    "A quote may have more than one topic. Only create a new topic tag if absolutely "
    "nothing in the canonical list fits; never create synonyms of existing tags. "
    "Return topics as an array of tag name strings. "
    "Return a JSON object only, no other "
    'text. Schema: { "quotes": [{ "speaker_name": string, "speaker_title": string, '
    '"speaker_type": string, "quote_text": string, "context": string, '
    '"jurisdictions": string[], "topics": string[] }] }'
)

SYSTEM_PROMPT = ARTICLE_SYSTEM_PROMPT


class ExtractionError(Exception):
    pass


def extract_quotes(
    article_text: str,
    canonical_jurisdiction_list: str,
    canonical_topic_list: str = "",
    source_type: str = "article",
) -> List[dict]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ExtractionError("ANTHROPIC_API_KEY is not set in environment.")

    client = anthropic.Anthropic(api_key=api_key)

    if source_type == "youtube_transcript":
        system_prompt = TRANSCRIPT_SYSTEM_PROMPT
        extract_instruction = (
            "Extract all notable AI-related statements from the following "
            "YouTube video transcript:"
        )
    else:
        system_prompt = ARTICLE_SYSTEM_PROMPT
        extract_instruction = (
            "Extract all direct AI-related quotes from the following article:"
        )

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            temperature=0,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Canonical jurisdiction tag names (choose only from this list "
                        "unless no entry fits; use the exact name string, not synonyms):\n\n"
                        f"{canonical_jurisdiction_list}\n\n"
                        "Canonical topic tag names (strongly prefer tags from this list; "
                        "only create a new tag if nothing fits):\n\n"
                        f"{canonical_topic_list}\n\n"
                        f"{extract_instruction}\n\n"
                        f"{article_text}"
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
