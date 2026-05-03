"""Tests for /api/users endpoints.

Anonymous and non-superadmin access is rejected; superadmins can list
users and PATCH editor/admin flags. ``is_superadmin`` is read-only via
the API and only granted via SUPERADMIN_EMAILS at provisioning time.
"""
from __future__ import annotations

import pytest

from app.models import User


# ── /api/users/me ──────────────────────────────────────────────────────


class TestMe:

    async def test_anonymous_gets_401(self, client):
        resp = await client.get("/api/users/me")
        assert resp.status_code == 401

    async def test_signed_in_returns_self(self, editor_client, editor_user):
        resp = await editor_client.get("/api/users/me")
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == editor_user.id
        assert body["email"] == editor_user.email
        assert body["is_editor"] is True
        assert body["is_admin"] is False
        assert body["is_superadmin"] is False

    async def test_admin_sees_admin_flag(self, admin_client, admin_user):
        resp = await admin_client.get("/api/users/me")
        assert resp.status_code == 200
        body = resp.json()
        assert body["is_admin"] is True
        assert body["is_editor"] is True  # implication

    async def test_superadmin_sees_superadmin_flag(
        self, superadmin_client, superadmin_user
    ):
        resp = await superadmin_client.get("/api/users/me")
        assert resp.status_code == 200
        body = resp.json()
        assert body["is_superadmin"] is True
        assert body["is_admin"] is True
        assert body["is_editor"] is True


# ── GET /api/users ─────────────────────────────────────────────────────


class TestListUsers:

    async def test_anonymous_gets_401(self, client):
        resp = await client.get("/api/users")
        assert resp.status_code == 401

    async def test_editor_gets_403(self, editor_client):
        resp = await editor_client.get("/api/users")
        assert resp.status_code == 403

    async def test_admin_gets_403(self, admin_client):
        resp = await admin_client.get("/api/users")
        assert resp.status_code == 403

    async def test_superadmin_lists_all(
        self,
        superadmin_client,
        superadmin_user,
        admin_user,
        editor_user,
    ):
        resp = await superadmin_client.get("/api/users")
        assert resp.status_code == 200
        emails = {u["email"] for u in resp.json()}
        assert {
            superadmin_user.email,
            admin_user.email,
            editor_user.email,
        } <= emails


# ── PATCH /api/users/{id}/role ─────────────────────────────────────────


class TestUpdateRole:

    async def test_anonymous_gets_401(self, client, editor_user):
        resp = await client.patch(
            f"/api/users/{editor_user.id}/role",
            json={"is_admin": True},
        )
        assert resp.status_code == 401

    async def test_admin_gets_403(self, admin_client, editor_user):
        resp = await admin_client.patch(
            f"/api/users/{editor_user.id}/role",
            json={"is_admin": True},
        )
        assert resp.status_code == 403

    async def test_promote_editor_to_admin(
        self, superadmin_client, db_session, editor_user
    ):
        resp = await superadmin_client.patch(
            f"/api/users/{editor_user.id}/role",
            json={"is_admin": True},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["is_admin"] is True
        # implication: admin always implies editor
        assert body["is_editor"] is True

        db_session.refresh(editor_user)
        assert editor_user.is_admin is True
        assert editor_user.is_editor is True

    async def test_revoke_editor(
        self, superadmin_client, db_session, editor_user
    ):
        resp = await superadmin_client.patch(
            f"/api/users/{editor_user.id}/role",
            json={"is_editor": False},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["is_editor"] is False
        assert body["is_admin"] is False

    async def test_cannot_revoke_editor_while_admin(
        self, superadmin_client, admin_user
    ):
        resp = await superadmin_client.patch(
            f"/api/users/{admin_user.id}/role",
            json={"is_editor": False},
        )
        assert resp.status_code == 400

    async def test_cannot_modify_superadmin(
        self, superadmin_client, superadmin_user
    ):
        resp = await superadmin_client.patch(
            f"/api/users/{superadmin_user.id}/role",
            json={"is_admin": False},
        )
        assert resp.status_code == 400

    async def test_unknown_user_returns_404(self, superadmin_client):
        resp = await superadmin_client.patch(
            "/api/users/99999/role",
            json={"is_editor": True},
        )
        assert resp.status_code == 404

    async def test_cannot_grant_superadmin_via_api(
        self, superadmin_client, db_session, editor_user
    ):
        # The Pydantic schema doesn't have is_superadmin; sending it
        # should be silently ignored, not honored.
        resp = await superadmin_client.patch(
            f"/api/users/{editor_user.id}/role",
            json={"is_superadmin": True, "is_editor": True},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["is_superadmin"] is False
        db_session.refresh(editor_user)
        assert editor_user.is_superadmin is False
