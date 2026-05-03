"""Tests for the per-user quote-favorites endpoints.

Covers:

- Anonymous traffic gets 401 on every favorites endpoint.
- POST/DELETE are idempotent and isolated per user.
- ``GET /api/users/me/favorites/ids`` reflects the caller's stars.
- ``GET /api/quotes?favorited_only=true`` filters to the caller's
  favorites; the same flag for an anonymous caller returns an empty
  page rather than a 401.
"""
from __future__ import annotations

from datetime import date

import pytest

from app.models import Article, Person, Quote, QuoteFavorite, SpeakerType


@pytest.fixture
def two_quotes(db_session, sample_article):
    """Two distinct quotes attached to the same article and a fresh person."""
    person = Person(name="Rep. Lila Vance", type=SpeakerType.elected)
    db_session.add(person)
    db_session.commit()
    db_session.refresh(person)

    q1 = Quote(
        person_id=person.id,
        article_id=sample_article.id,
        quote_text="The first statement about AI policy.",
        date_said=date(2025, 9, 16),
    )
    q2 = Quote(
        person_id=person.id,
        article_id=sample_article.id,
        quote_text="A second statement, distinct from the first.",
        date_said=date(2025, 9, 17),
    )
    db_session.add_all([q1, q2])
    db_session.commit()
    db_session.refresh(q1)
    db_session.refresh(q2)
    return q1, q2


# ── POST /api/quotes/{id}/favorite ─────────────────────────────────────


class TestFavoriteQuote:

    async def test_anonymous_gets_401(self, client, sample_quote):
        resp = await client.post(f"/api/quotes/{sample_quote.id}/favorite")
        assert resp.status_code == 401

    async def test_signed_in_creates_row(
        self, editor_client, db_session, sample_quote, editor_user
    ):
        resp = await editor_client.post(
            f"/api/quotes/{sample_quote.id}/favorite"
        )
        assert resp.status_code == 200
        assert resp.json() == {
            "favorited": True,
            "quote_id": sample_quote.id,
        }

        rows = (
            db_session.query(QuoteFavorite)
            .filter(QuoteFavorite.user_id == editor_user.id)
            .all()
        )
        assert [r.quote_id for r in rows] == [sample_quote.id]

    async def test_idempotent(
        self, editor_client, db_session, sample_quote, editor_user
    ):
        for _ in range(3):
            resp = await editor_client.post(
                f"/api/quotes/{sample_quote.id}/favorite"
            )
            assert resp.status_code == 200
            assert resp.json()["favorited"] is True

        count = (
            db_session.query(QuoteFavorite)
            .filter(
                QuoteFavorite.user_id == editor_user.id,
                QuoteFavorite.quote_id == sample_quote.id,
            )
            .count()
        )
        assert count == 1

    async def test_unknown_quote_returns_404(self, editor_client):
        resp = await editor_client.post("/api/quotes/99999/favorite")
        assert resp.status_code == 404


# ── DELETE /api/quotes/{id}/favorite ───────────────────────────────────


class TestUnfavoriteQuote:

    async def test_anonymous_gets_401(self, client, sample_quote):
        resp = await client.delete(f"/api/quotes/{sample_quote.id}/favorite")
        assert resp.status_code == 401

    async def test_removes_existing_favorite(
        self, editor_client, db_session, sample_quote, editor_user
    ):
        db_session.add(
            QuoteFavorite(user_id=editor_user.id, quote_id=sample_quote.id)
        )
        db_session.commit()

        resp = await editor_client.delete(
            f"/api/quotes/{sample_quote.id}/favorite"
        )
        assert resp.status_code == 200
        assert resp.json() == {
            "favorited": False,
            "quote_id": sample_quote.id,
        }

        remaining = (
            db_session.query(QuoteFavorite)
            .filter(QuoteFavorite.user_id == editor_user.id)
            .count()
        )
        assert remaining == 0

    async def test_idempotent_when_not_favorited(
        self, editor_client, sample_quote
    ):
        resp = await editor_client.delete(
            f"/api/quotes/{sample_quote.id}/favorite"
        )
        assert resp.status_code == 200
        assert resp.json()["favorited"] is False


# ── GET /api/users/me/favorites/ids ────────────────────────────────────


class TestListFavoriteIds:

    async def test_anonymous_gets_401(self, client):
        resp = await client.get("/api/users/me/favorites/ids")
        assert resp.status_code == 401

    async def test_returns_caller_favorites_newest_first(
        self,
        editor_client,
        db_session,
        editor_user,
        two_quotes,
    ):
        q1, q2 = two_quotes
        # Star q1 first, then q2 — the response should be newest first.
        await editor_client.post(f"/api/quotes/{q1.id}/favorite")
        await editor_client.post(f"/api/quotes/{q2.id}/favorite")

        resp = await editor_client.get("/api/users/me/favorites/ids")
        assert resp.status_code == 200
        ids = resp.json()["quote_ids"]
        # Both present.
        assert set(ids) == {q1.id, q2.id}
        # q2 (created later) appears before q1.
        assert ids.index(q2.id) < ids.index(q1.id)

    async def test_isolated_per_user(
        self,
        editor_client,
        db_session,
        editor_user,
        admin_user,
        two_quotes,
    ):
        q1, q2 = two_quotes
        # Pre-seed the admin's favorite for q1; the editor should not see it.
        db_session.add(
            QuoteFavorite(user_id=admin_user.id, quote_id=q1.id)
        )
        db_session.commit()

        await editor_client.post(f"/api/quotes/{q2.id}/favorite")

        resp = await editor_client.get("/api/users/me/favorites/ids")
        assert resp.json()["quote_ids"] == [q2.id]


# ── GET /api/quotes?favorited_only=true ────────────────────────────────


class TestFavoritedOnlyFilter:

    async def test_anonymous_returns_empty_page(self, client, sample_quote):
        resp = await client.get("/api/quotes?favorited_only=true")
        assert resp.status_code == 200
        body = resp.json()
        assert body == {
            "quotes": [],
            "total": 0,
            "page": 1,
            "page_size": 50,
        }

    async def test_signed_in_returns_only_favorites(
        self,
        editor_client,
        db_session,
        editor_user,
        two_quotes,
    ):
        q1, q2 = two_quotes
        # Favorite q1 only.
        await editor_client.post(f"/api/quotes/{q1.id}/favorite")

        resp = await editor_client.get("/api/quotes?favorited_only=true")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        ids = [q["id"] for q in body["quotes"]]
        assert ids == [q1.id]

    async def test_signed_in_without_flag_unaffected(
        self,
        editor_client,
        db_session,
        editor_user,
        two_quotes,
    ):
        q1, q2 = two_quotes
        await editor_client.post(f"/api/quotes/{q1.id}/favorite")

        resp = await editor_client.get("/api/quotes")
        assert resp.status_code == 200
        ids = {q["id"] for q in resp.json()["quotes"]}
        assert {q1.id, q2.id} <= ids

    async def test_other_users_favorites_excluded(
        self,
        editor_client,
        db_session,
        admin_user,
        two_quotes,
    ):
        q1, q2 = two_quotes
        # Admin favorites q1; the editor's filtered view should not see it.
        db_session.add(
            QuoteFavorite(user_id=admin_user.id, quote_id=q1.id)
        )
        db_session.commit()

        resp = await editor_client.get("/api/quotes?favorited_only=true")
        assert resp.status_code == 200
        assert resp.json()["total"] == 0
