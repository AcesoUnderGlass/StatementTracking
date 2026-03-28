"""Shared test constants and factory functions."""

import json
from unittest.mock import MagicMock

MOCK_EXTRACTION_RESPONSE = {
    "quotes": [
        {
            "speaker_name": "Sen. Margaret Holloway",
            "speaker_title": "U.S. Senator (D-CA)",
            "speaker_type": "elected",
            "quote_text": (
                "We cannot afford to wait another session while this "
                "technology reshapes every sector of our economy."
            ),
            "context": (
                "Speaking at a Senate Commerce Committee hearing on AI regulation."
            ),
            "jurisdictions": ["United States"],
            "topics": ["AI Regulation"],
        },
        {
            "speaker_name": "Sen. Margaret Holloway",
            "speaker_title": "U.S. Senator (D-CA)",
            "speaker_type": "elected",
            "quote_text": (
                "The companies building these systems ... have repeatedly "
                "shown they will not regulate themselves."
            ),
            "context": (
                "Continuing her remarks on the need for legislative action."
            ),
            "jurisdictions": ["United States"],
            "topics": ["AI Regulation", "Industry Accountability"],
        },
        {
            "speaker_name": "David Nakamura",
            "speaker_title": "Chief of Staff to Sen. Holloway",
            "speaker_type": "staff",
            "quote_text": (
                "We've had productive conversations with members on both "
                "sides of the aisle, and we expect to have co-sponsors "
                "announced within two weeks."
            ),
            "context": (
                "Speaking to reporters after the hearing about the draft "
                "AI regulation bill."
            ),
            "jurisdictions": ["United States"],
            "topics": ["AI Regulation"],
        },
    ],
}

MOCK_EMPTY_EXTRACTION = {"quotes": []}

MOCK_MISSING_KEY_EXTRACTION = {"results": [{"text": "something"}]}

MOCK_MALFORMED_TEXT = "This is not valid JSON at all {{{{"

MOCK_CODE_FENCED_RESPONSE = (
    "```json\n" + json.dumps(MOCK_EXTRACTION_RESPONSE) + "\n```"
)

MOCK_ARTICLE_DATA = {
    "title": "Senate Panel Weighs New AI Oversight Rules",
    "text": "Full article text about AI regulation hearing...",
    "publication": "Example News",
    "published_date": "2025-09-15",
    "url": "https://example.com/ai-regulation-hearing",
    "source_type": "article",
}


def make_anthropic_response(text: str) -> MagicMock:
    """Build a MagicMock that mimics a successful Anthropic messages.create() return."""
    resp = MagicMock()
    resp.content = [MagicMock()]
    resp.content[0].text = text
    return resp
