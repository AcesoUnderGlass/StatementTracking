"""Tests for the /api/articles endpoints.

Covers article URL submission (extract), duplicate detection on save, and
the creation of article / person / quote records during the save workflow.
"""

import json
from unittest.mock import patch

import pytest

from app.models import Article, Person, Quote
from app.services.fetcher import FetchError
from app.services.extractor import ExtractionError

from helpers import (
    MOCK_ARTICLE_DATA,
    MOCK_EXTRACTION_RESPONSE,
    MOCK_EMPTY_EXTRACTION,
    MOCK_MALFORMED_TEXT,
    make_anthropic_response,
)


# ── Helpers ──────────────────────────────────────────────────────────────


def _save_payload(person_id=None, new_person=None, quotes=None, url=None):
    """Build a minimal SaveRequest body. Supply either person_id or new_person."""
    article = {
        "url": url or "https://example.com/new-article",
        "title": "Test Article",
        "publication": "Test Pub",
        "published_date": "2025-09-15",
    }
    if quotes is not None:
        return {"article": article, "quotes": quotes}

    quote_item = {
        "quote_text": "AI will transform government services.",
        "context": "Remarks at press conference.",
    }
    if person_id:
        quote_item["person_id"] = person_id
    if new_person:
        quote_item["new_person"] = new_person
    return {"article": article, "quotes": [quote_item]}


def _new_person(name="Sen. Jane Doe", type="elected", party="Democrat",
                role="U.S. Senator", chamber="Senate", locales=None):
    return {
        "name": name, "type": type, "party": party,
        "role": role, "chamber": chamber, "locales": locales or ["NY"],
    }


# ── Extract Endpoint ─────────────────────────────────────────────────────


class TestArticlesExtract:

    async def test_happy_path_returns_quotes_and_metadata(
        self, client, mock_fetch, mock_anthropic,
    ):
        resp = await client.post("/api/articles/extract", json={"url": MOCK_ARTICLE_DATA["url"]})
        assert resp.status_code == 200

        data = resp.json()
        assert data["article"]["title"] == MOCK_ARTICLE_DATA["title"]
        assert data["article"]["url"] == MOCK_ARTICLE_DATA["url"]
        assert data["source_type"] == "article"
        assert len(data["quotes"]) == 3

        q0 = data["quotes"][0]
        assert q0["speaker_name"] == "Sen. Margaret Holloway"
        assert q0["quote_text"]
        assert isinstance(q0["jurisdictions"], list)
        assert isinstance(q0["topics"], list)

    async def test_no_quotes_returns_empty_list(
        self, client, mock_fetch, monkeypatch,
    ):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        resp_mock = make_anthropic_response(json.dumps(MOCK_EMPTY_EXTRACTION))

        with patch("app.services.extractor.anthropic.Anthropic") as mock_cls:
            mock_client_inst = mock_cls.return_value
            mock_client_inst.messages.create.return_value = resp_mock

            resp = await client.post("/api/articles/extract", json={"url": MOCK_ARTICLE_DATA["url"]})

        assert resp.status_code == 200
        assert resp.json()["quotes"] == []

    async def test_fetch_error_returns_422(self, client):
        with patch(
            "app.routes.articles.fetch_article",
            side_effect=FetchError("Could not reach URL"),
        ):
            resp = await client.post(
                "/api/articles/extract",
                json={"url": "https://bad.example.com/nope"},
            )
        assert resp.status_code == 422
        assert "Could not reach URL" in resp.json()["detail"]

    async def test_extraction_error_returns_502(self, client, mock_fetch, monkeypatch):
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        resp_mock = make_anthropic_response(MOCK_MALFORMED_TEXT)

        with patch("app.services.extractor.anthropic.Anthropic") as mock_cls:
            mock_client_inst = mock_cls.return_value
            mock_client_inst.messages.create.return_value = resp_mock

            resp = await client.post(
                "/api/articles/extract",
                json={"url": MOCK_ARTICLE_DATA["url"]},
            )

        assert resp.status_code == 502
        assert "Failed to parse" in resp.json()["detail"]

    async def test_partial_quote_fields_use_defaults(
        self, client, mock_fetch, monkeypatch,
    ):
        minimal_response = {
            "quotes": [
                {"quote_text": "AI is important."},
            ],
        }
        monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
        resp_mock = make_anthropic_response(json.dumps(minimal_response))

        with patch("app.services.extractor.anthropic.Anthropic") as mock_cls:
            mock_client_inst = mock_cls.return_value
            mock_client_inst.messages.create.return_value = resp_mock

            resp = await client.post(
                "/api/articles/extract",
                json={"url": MOCK_ARTICLE_DATA["url"]},
            )

        assert resp.status_code == 200
        q = resp.json()["quotes"][0]
        assert q["speaker_name"] == "Unknown"
        assert q["speaker_title"] is None
        assert q["jurisdictions"] == []
        assert q["topics"] == []


# ── Save Endpoint ────────────────────────────────────────────────────────


class TestArticlesSave:

    async def test_save_creates_article_and_quotes(
        self, client, db_session, sample_person,
    ):
        elected, _ = sample_person
        payload = _save_payload(person_id=elected.id)

        resp = await client.post("/api/articles/save", json=payload)
        assert resp.status_code == 200

        body = resp.json()
        assert body["quote_count"] == 1
        assert body["duplicate_count"] == 0

        article = db_session.query(Article).filter(Article.url == payload["article"]["url"]).first()
        assert article is not None
        assert article.title == "Test Article"

    async def test_duplicate_url_reuses_existing_article(
        self, client, db_session, sample_article, sample_person,
    ):
        elected, _ = sample_person
        payload = _save_payload(
            person_id=elected.id,
            url=sample_article.url,
        )

        resp = await client.post("/api/articles/save", json=payload)
        assert resp.status_code == 200
        assert resp.json()["article_id"] == sample_article.id

        article_count = db_session.query(Article).filter(
            Article.url == sample_article.url
        ).count()
        assert article_count == 1

    async def test_new_person_creates_person_record(self, client, db_session):
        payload = _save_payload(new_person=_new_person())

        resp = await client.post("/api/articles/save", json=payload)
        assert resp.status_code == 200
        assert resp.json()["quote_count"] == 1

        # canonical_speaker_name() strips the "Sen." prefix before persisting.
        assert db_session.query(Person).filter(Person.name == "Sen. Jane Doe").first() is None
        person = db_session.query(Person).filter(Person.name == "Jane Doe").first()
        assert person is not None
        assert person.type.value == "elected"
        assert person.locales == ["NY"]

    async def test_same_new_person_deduped_across_quotes(self, client, db_session):
        person_data = _new_person()
        quotes = [
            {"quote_text": "First quote.", "new_person": person_data},
            {"quote_text": "Second quote.", "new_person": person_data},
        ]
        payload = _save_payload(quotes=quotes)

        resp = await client.post("/api/articles/save", json=payload)
        assert resp.status_code == 200
        assert resp.json()["quote_count"] == 2

        # Honorific stripped → stored as "Jane Doe", and only one row created.
        people = db_session.query(Person).filter(Person.name == "Jane Doe").all()
        assert len(people) == 1

    async def test_mark_as_duplicate_sets_flag(
        self, client, db_session, sample_person, sample_quote,
    ):
        elected, _ = sample_person
        quotes = [
            {
                "quote_text": sample_quote.quote_text,
                "person_id": elected.id,
                "mark_as_duplicate": True,
            },
        ]
        payload = _save_payload(quotes=quotes, url="https://example.com/another")

        resp = await client.post("/api/articles/save", json=payload)
        assert resp.status_code == 200

        body = resp.json()
        assert body["duplicate_count"] == 1

        new_quote = (
            db_session.query(Quote)
            .filter(Quote.article_id == body["article_id"], Quote.is_duplicate == True)
            .first()
        )
        assert new_quote is not None
        assert new_quote.duplicate_of_id == sample_quote.id

    async def test_missing_person_id_and_new_person_returns_400(self, client, db_session):
        quotes = [{"quote_text": "Orphan quote with no speaker."}]
        payload = _save_payload(quotes=quotes)

        resp = await client.post("/api/articles/save", json=payload)
        assert resp.status_code == 400
        assert "person_id or new_person" in resp.json()["detail"]

    async def test_jurisdiction_and_topic_tags_persisted(self, client, db_session):
        person_data = _new_person(name="Gov. Smith")
        quotes = [
            {
                "quote_text": "We need federal AI standards.",
                "new_person": person_data,
                "jurisdiction_names": ["United States"],
                "topic_names": ["AI Regulation"],
            },
        ]
        payload = _save_payload(quotes=quotes)

        resp = await client.post("/api/articles/save", json=payload)
        assert resp.status_code == 200

        quote = db_session.query(Quote).filter(
            Quote.quote_text == "We need federal AI standards."
        ).first()
        assert quote is not None

        jurisdiction_names = [j.name for j in quote.jurisdictions]
        topic_names = [t.name for t in quote.topics]
        assert "United States" in jurisdiction_names
        assert "AI Regulation" in topic_names
