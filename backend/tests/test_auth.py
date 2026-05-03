"""Tests for backend/app/auth.py.

Uses a locally generated RSA keypair to forge Clerk-style JWTs and
monkeypatches the JWKS cache so we never hit the network. Covers
signature verification, claim validation, lazy user provisioning,
superadmin auto-promotion, and the role-check dependencies.
"""
from __future__ import annotations

import time
from datetime import datetime, timedelta
from typing import Optional

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app import auth
from app.models import User


# ── Test keypair / JWKS plumbing ────────────────────────────────────────


TEST_ISSUER = "https://test-frontend.clerk.accounts.dev"
TEST_KID = "test-kid-1"


@pytest.fixture(scope="module")
def keypair():
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_pem = private.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    private_pem = private.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_jwk = jwt.algorithms.RSAAlgorithm.to_jwk(
        private.public_key(), as_dict=True
    )
    public_jwk["kid"] = TEST_KID
    public_jwk["alg"] = "RS256"
    return {
        "private_pem": private_pem,
        "public_pem": public_pem,
        "jwks": {"keys": [public_jwk]},
    }


@pytest.fixture(autouse=True)
def patch_jwks(monkeypatch, keypair):
    monkeypatch.setenv("CLERK_JWKS_URL", f"{TEST_ISSUER}/.well-known/jwks.json")
    monkeypatch.delenv("CLERK_ISSUER", raising=False)
    monkeypatch.setenv("SUPERADMIN_EMAILS", "root@example.com")

    auth._jwks_cache.clear()

    def _stub_get(self, jwks_url: str) -> dict:
        return keypair["jwks"]

    monkeypatch.setattr(auth._JwksCache, "get", _stub_get)
    yield
    auth._jwks_cache.clear()


def _mint_token(
    keypair,
    *,
    sub: str = "user_123",
    email: Optional[str] = "alice@example.com",
    name: Optional[str] = "Alice",
    issuer: str = TEST_ISSUER,
    expires_in_seconds: int = 60,
    kid: str = TEST_KID,
) -> str:
    claims: dict = {
        "sub": sub,
        "iss": issuer,
        "iat": int(time.time()),
        "exp": int(time.time()) + expires_in_seconds,
    }
    if email is not None:
        claims["email"] = email
    if name is not None:
        claims["name"] = name
    return jwt.encode(
        claims,
        keypair["private_pem"],
        algorithm="RS256",
        headers={"kid": kid},
    )


# ── Verification ────────────────────────────────────────────────────────


class TestVerifyClerkJwt:

    def test_valid_token_returns_claims(self, keypair):
        token = _mint_token(keypair)
        claims = auth._verify_clerk_jwt(token)
        assert claims["sub"] == "user_123"
        assert claims["email"] == "alice@example.com"

    def test_expired_token_raises_401(self, keypair):
        token = _mint_token(keypair, expires_in_seconds=-10)
        with pytest.raises(auth.AuthError) as ei:
            auth._verify_clerk_jwt(token)
        assert ei.value.status_code == 401
        assert "expired" in ei.value.detail.lower()

    def test_wrong_issuer_raises_401(self, keypair):
        token = _mint_token(keypair, issuer="https://imposter.example.com")
        with pytest.raises(auth.AuthError) as ei:
            auth._verify_clerk_jwt(token)
        assert ei.value.status_code == 401

    def test_unknown_kid_raises_401(self, keypair):
        token = _mint_token(keypair, kid="not-in-jwks")
        with pytest.raises(auth.AuthError):
            auth._verify_clerk_jwt(token)

    def test_garbage_token_raises_401(self):
        with pytest.raises(auth.AuthError):
            auth._verify_clerk_jwt("this-is-not-a-jwt")


# ── Lazy provisioning ───────────────────────────────────────────────────


class TestProvisionUser:

    def test_first_sight_creates_row(self, db_session):
        claims = {
            "sub": "user_new",
            "email": "newperson@example.com",
            "name": "New Person",
        }
        user = auth._provision_user(db_session, claims)
        assert user.id is not None
        assert user.clerk_user_id == "user_new"
        assert user.email == "newperson@example.com"
        assert user.is_editor is False
        assert user.is_admin is False
        assert user.is_superadmin is False

    def test_superadmin_email_auto_promoted(self, db_session):
        # SUPERADMIN_EMAILS is set to root@example.com in the autouse fixture
        claims = {"sub": "user_root", "email": "root@example.com", "name": "Root"}
        user = auth._provision_user(db_session, claims)
        assert user.is_superadmin is True
        assert user.is_admin is True  # implication
        assert user.is_editor is True

    def test_email_match_is_case_insensitive(self, db_session):
        claims = {"sub": "user_root2", "email": "ROOT@Example.Com", "name": "Root"}
        user = auth._provision_user(db_session, claims)
        assert user.is_superadmin is True

    def test_returning_user_is_not_duplicated(self, db_session):
        claims = {"sub": "user_x", "email": "x@example.com", "name": "X"}
        u1 = auth._provision_user(db_session, claims)
        u2 = auth._provision_user(db_session, claims)
        assert u1.id == u2.id

    def test_returning_superadmin_email_promotes_existing_row(
        self, db_session
    ):
        # First sight: not a superadmin yet (different email).
        claims_initial = {"sub": "user_y", "email": "y@example.com"}
        user = auth._provision_user(db_session, claims_initial)
        assert user.is_superadmin is False

        # Email later changes to one in SUPERADMIN_EMAILS — promote.
        claims_promoted = {"sub": "user_y", "email": "root@example.com"}
        user = auth._provision_user(db_session, claims_promoted)
        assert user.is_superadmin is True
        assert user.is_admin is True
        assert user.is_editor is True


# ── current_user dependency ────────────────────────────────────────────


class FakeRequest:
    def __init__(self, headers: dict[str, str]) -> None:
        self.headers = headers


class TestCurrentUser:

    def test_missing_header_raises_401(self, db_session):
        req = FakeRequest({})
        with pytest.raises(auth.AuthError):
            auth.current_user(req, db_session)

    def test_malformed_header_raises_401(self, db_session):
        req = FakeRequest({"Authorization": "NotBearer foo"})
        with pytest.raises(auth.AuthError):
            auth.current_user(req, db_session)

    def test_valid_token_returns_user(self, db_session, keypair):
        token = _mint_token(keypair, sub="user_z", email="z@example.com")
        req = FakeRequest({"Authorization": f"Bearer {token}"})
        user = auth.current_user(req, db_session)
        assert isinstance(user, User)
        assert user.email == "z@example.com"


class TestOptionalUser:

    def test_no_header_returns_none(self, db_session):
        req = FakeRequest({})
        assert auth.optional_user(req, db_session) is None

    def test_invalid_token_returns_none(self, db_session):
        req = FakeRequest({"Authorization": "Bearer garbage"})
        assert auth.optional_user(req, db_session) is None

    def test_valid_token_returns_user(self, db_session, keypair):
        token = _mint_token(keypair, sub="user_opt", email="opt@example.com")
        req = FakeRequest({"Authorization": f"Bearer {token}"})
        user = auth.optional_user(req, db_session)
        assert user is not None
        assert user.email == "opt@example.com"


# ── Role checks ─────────────────────────────────────────────────────────


class TestRoleChecks:

    def test_require_editor_accepts_editor(self):
        u = User(clerk_user_id="x", email="e@x.com", is_editor=True)
        assert auth.require_editor(u) is u

    def test_require_editor_accepts_admin(self):
        u = User(clerk_user_id="x", email="a@x.com", is_admin=True, is_editor=True)
        assert auth.require_editor(u) is u

    def test_require_editor_rejects_member(self):
        u = User(clerk_user_id="x", email="m@x.com")
        with pytest.raises(Exception) as ei:
            auth.require_editor(u)
        assert getattr(ei.value, "status_code", None) == 403

    def test_require_admin_rejects_editor(self):
        u = User(clerk_user_id="x", email="e@x.com", is_editor=True)
        with pytest.raises(Exception) as ei:
            auth.require_admin(u)
        assert getattr(ei.value, "status_code", None) == 403

    def test_require_admin_accepts_superadmin(self):
        u = User(
            clerk_user_id="x",
            email="s@x.com",
            is_editor=True,
            is_admin=True,
            is_superadmin=True,
        )
        assert auth.require_admin(u) is u

    def test_require_superadmin_rejects_admin(self):
        u = User(clerk_user_id="x", email="a@x.com", is_admin=True, is_editor=True)
        with pytest.raises(Exception) as ei:
            auth.require_superadmin(u)
        assert getattr(ei.value, "status_code", None) == 403
