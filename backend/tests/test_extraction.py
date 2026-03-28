"""Tests for the AI quote extraction service.

Validates that app.services.extractor.extract_quotes correctly parses LLM
responses, reassembles fragmented quotes, filters speaker types, and handles
malformed output gracefully.
"""

import json
from unittest.mock import MagicMock, patch

import anthropic
import pytest

from app.services.extractor import ExtractionError, extract_quotes

from helpers import (
    MOCK_EXTRACTION_RESPONSE,
    MOCK_EMPTY_EXTRACTION,
    MOCK_MISSING_KEY_EXTRACTION,
    MOCK_MALFORMED_TEXT,
    MOCK_CODE_FENCED_RESPONSE,
    make_anthropic_response,
)

JURISDICTION_BLOCK = "- United States\n- European Union"
TOPIC_BLOCK = "- AI Regulation\n- Industry Accountability"


class TestExtractQuotesHappyPath:

    def test_returns_correct_quote_count(self, mock_anthropic, sample_article_text):
        quotes = extract_quotes(sample_article_text, JURISDICTION_BLOCK, TOPIC_BLOCK)
        assert len(quotes) == 3

    def test_each_quote_has_required_fields(self, mock_anthropic, sample_article_text):
        quotes = extract_quotes(sample_article_text, JURISDICTION_BLOCK, TOPIC_BLOCK)
        for q in quotes:
            assert "speaker_name" in q
            assert "quote_text" in q
            assert "context" in q

    def test_speaker_metadata_preserved(self, mock_anthropic, sample_article_text):
        quotes = extract_quotes(sample_article_text, JURISDICTION_BLOCK, TOPIC_BLOCK)
        senator_quotes = [q for q in quotes if q["speaker_name"] == "Sen. Margaret Holloway"]
        assert len(senator_quotes) == 2
        assert senator_quotes[0]["speaker_type"] == "elected"

    def test_jurisdictions_and_topics_included(self, mock_anthropic, sample_article_text):
        quotes = extract_quotes(sample_article_text, JURISDICTION_BLOCK, TOPIC_BLOCK)
        for q in quotes:
            assert "jurisdictions" in q
            assert "United States" in q["jurisdictions"]
            assert "topics" in q
            assert "AI Regulation" in q["topics"]


class TestExtractQuotesEmptyResponse:

    def test_returns_empty_list(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        resp = make_anthropic_response(json.dumps(MOCK_EMPTY_EXTRACTION))

        with patch("app.services.extractor.anthropic.Anthropic") as mock_cls:
            mock_client = MagicMock()
            mock_client.messages.create.return_value = resp
            mock_cls.return_value = mock_client

            quotes = extract_quotes("Some article text.", JURISDICTION_BLOCK)
            assert quotes == []


class TestExtractQuotesMalformedResponse:

    def test_invalid_json_raises_extraction_error(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        resp = make_anthropic_response(MOCK_MALFORMED_TEXT)

        with patch("app.services.extractor.anthropic.Anthropic") as mock_cls:
            mock_client = MagicMock()
            mock_client.messages.create.return_value = resp
            mock_cls.return_value = mock_client

            with pytest.raises(ExtractionError, match="Failed to parse LLM response"):
                extract_quotes("Some text.", JURISDICTION_BLOCK)

    def test_missing_quotes_key_raises_extraction_error(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        resp = make_anthropic_response(json.dumps(MOCK_MISSING_KEY_EXTRACTION))

        with patch("app.services.extractor.anthropic.Anthropic") as mock_cls:
            mock_client = MagicMock()
            mock_client.messages.create.return_value = resp
            mock_cls.return_value = mock_client

            with pytest.raises(ExtractionError, match="missing 'quotes' key"):
                extract_quotes("Some text.", JURISDICTION_BLOCK)


class TestExtractQuotesCodeFence:

    def test_strips_markdown_fences_and_parses(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        resp = make_anthropic_response(MOCK_CODE_FENCED_RESPONSE)

        with patch("app.services.extractor.anthropic.Anthropic") as mock_cls:
            mock_client = MagicMock()
            mock_client.messages.create.return_value = resp
            mock_cls.return_value = mock_client

            quotes = extract_quotes("Some text.", JURISDICTION_BLOCK)
            assert len(quotes) == 3


class TestExtractQuotesAPIErrors:

    def test_missing_api_key_raises(self, monkeypatch):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

        with pytest.raises(ExtractionError, match="ANTHROPIC_API_KEY"):
            extract_quotes("Some text.", JURISDICTION_BLOCK)

    def test_anthropic_api_error_wrapped(self, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")

        with patch("app.services.extractor.anthropic.Anthropic") as mock_cls:
            mock_client = MagicMock()
            mock_client.messages.create.side_effect = anthropic.APIError(
                message="rate limit exceeded",
                request=MagicMock(),
                body=None,
            )
            mock_cls.return_value = mock_client

            with pytest.raises(ExtractionError, match="Anthropic API error"):
                extract_quotes("Some text.", JURISDICTION_BLOCK)


class TestExtractQuotesSourceTypes:

    def test_youtube_source_type_accepted(self, mock_anthropic, sample_article_text):
        quotes = extract_quotes(
            sample_article_text, JURISDICTION_BLOCK, TOPIC_BLOCK,
            source_type="youtube_transcript",
        )
        assert len(quotes) == 3

    def test_tweet_source_type_accepted(self, mock_anthropic, sample_article_text):
        quotes = extract_quotes(
            sample_article_text, JURISDICTION_BLOCK, TOPIC_BLOCK,
            source_type="tweet",
        )
        assert len(quotes) == 3
