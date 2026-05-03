"""Clerk JWT authentication and role-based authorization.

Stateless: every request carrying ``Authorization: Bearer <jwt>`` is
verified against Clerk's JWKS, which is fetched once per process and
cached for ~1 hour. Users are lazily provisioned on first valid token,
auto-promoted to superadmin when their email matches
``SUPERADMIN_EMAILS``.

Public routes don't reference these dependencies at all and stay open
to anonymous traffic. Future signed-in features should use
``current_user``; gated mutations should use ``require_editor``,
``require_admin``, or ``require_superadmin``.
"""
from __future__ import annotations

import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import User, apply_role_implication

logger = logging.getLogger(__name__)

JWKS_CACHE_TTL_SECONDS = 3600
USER_LAST_SEEN_THROTTLE_SECONDS = 60


# ── JWKS fetching and caching ───────────────────────────────────────────


class _JwksCache:
    """Thread-safe TTL cache for Clerk's JWKS document."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._jwks: Optional[dict] = None
        self._expires_at: float = 0.0

    def get(self, jwks_url: str) -> dict:
        now = time.monotonic()
        with self._lock:
            if self._jwks is not None and now < self._expires_at:
                return self._jwks
        # Fetch outside the lock to avoid blocking concurrent readers
        # during a slow network call.
        resp = httpx.get(jwks_url, timeout=5.0)
        resp.raise_for_status()
        jwks = resp.json()
        with self._lock:
            self._jwks = jwks
            self._expires_at = time.monotonic() + JWKS_CACHE_TTL_SECONDS
        return jwks

    def clear(self) -> None:
        with self._lock:
            self._jwks = None
            self._expires_at = 0.0


_jwks_cache = _JwksCache()


_MISSING_JWKS_MESSAGE = (
    "Server auth is not configured: CLERK_JWKS_URL is empty. Set it in "
    "backend/.env to "
    "https://<your-frontend-api>.clerk.accounts.dev/.well-known/jwks.json"
)


def _clerk_jwks_url() -> str:
    url = os.getenv("CLERK_JWKS_URL")
    if not url:
        # Surface as a 401 (handled by callers) instead of a 500. The
        # frontend treats 401 as "not signed in" and falls back to a
        # public view, while a 500 leaves the UI in a half-broken state
        # where role-gated nav silently disappears.
        raise AuthError(_MISSING_JWKS_MESSAGE)
    return url


def _clerk_issuer() -> str:
    """Return the Clerk issuer, deriving from the JWKS URL when not set."""
    explicit = os.getenv("CLERK_ISSUER")
    if explicit:
        return explicit.rstrip("/")
    jwks_url = _clerk_jwks_url()
    suffix = "/.well-known/jwks.json"
    if jwks_url.endswith(suffix):
        return jwks_url[: -len(suffix)]
    return jwks_url.rstrip("/")


# ── Token verification ──────────────────────────────────────────────────


class AuthError(HTTPException):
    def __init__(self, detail: str) -> None:
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def _verify_clerk_jwt(token: str) -> dict:
    """Verify a Clerk session JWT and return its claims.

    Raises ``AuthError`` (401) on any verification failure.
    """
    try:
        unverified_header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as e:
        raise AuthError(f"Malformed token header: {e}") from e

    kid = unverified_header.get("kid")
    if not kid:
        raise AuthError("Token header missing 'kid'.")

    jwks = _jwks_cache.get(_clerk_jwks_url())
    matching_key = next(
        (k for k in jwks.get("keys", []) if k.get("kid") == kid), None
    )
    if matching_key is None:
        # Key rotation: bust the cache and try once more.
        _jwks_cache.clear()
        jwks = _jwks_cache.get(_clerk_jwks_url())
        matching_key = next(
            (k for k in jwks.get("keys", []) if k.get("kid") == kid), None
        )
    if matching_key is None:
        raise AuthError("No matching signing key for token 'kid'.")

    try:
        public_key = jwt.algorithms.RSAAlgorithm.from_jwk(matching_key)
    except Exception as e:
        raise AuthError(f"Invalid JWKS entry: {e}") from e

    try:
        claims = jwt.decode(
            token,
            public_key,
            algorithms=[matching_key.get("alg", "RS256")],
            issuer=_clerk_issuer(),
            options={"require": ["exp", "iss", "sub"]},
        )
    except jwt.ExpiredSignatureError as e:
        raise AuthError("Token expired.") from e
    except jwt.InvalidIssuerError as e:
        raise AuthError("Invalid token issuer.") from e
    except jwt.PyJWTError as e:
        raise AuthError(f"Token verification failed: {e}") from e

    return claims


# ── User provisioning ───────────────────────────────────────────────────


def _superadmin_emails() -> set[str]:
    raw = os.getenv("SUPERADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def _extract_email(claims: dict) -> str:
    """Pull the user's email from a Clerk JWT, tolerating template differences.

    Clerk's default session token has no email at all. Common template
    shapes use ``email``, ``email_address``, or ``primary_email_address``;
    some surface a list under ``email_addresses``. We try them in order
    and fall back to an empty string when nothing matches (the user is
    still provisioned, just without auto-promotion).
    """
    for key in ("email", "email_address", "primary_email_address"):
        val = claims.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    addrs = claims.get("email_addresses")
    if isinstance(addrs, list) and addrs:
        first = addrs[0]
        if isinstance(first, str) and first.strip():
            return first.strip()
        if isinstance(first, dict):
            val = first.get("email_address") or first.get("email")
            if isinstance(val, str) and val.strip():
                return val.strip()
    return ""


def _provision_user(db: Session, claims: dict) -> User:
    """Find or create a User row for the given Clerk claims.

    On first sight, auto-promote to superadmin (and admin/editor by
    implication) when the email matches ``SUPERADMIN_EMAILS``. On
    subsequent calls, refresh ``last_seen_at`` at most once per minute
    to avoid hot-row contention under load.
    """
    clerk_user_id = claims["sub"]
    email = _extract_email(claims)
    name = claims.get("name") or claims.get("full_name")

    user = (
        db.query(User).filter(User.clerk_user_id == clerk_user_id).first()
    )

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if user is None:
        is_superadmin = bool(email) and email.lower() in _superadmin_emails()
        user = User(
            clerk_user_id=clerk_user_id,
            email=email or f"unknown+{clerk_user_id}@clerk.local",
            name=name,
            is_superadmin=is_superadmin,
            is_admin=is_superadmin,
            is_editor=is_superadmin,
            last_seen_at=now,
        )
        apply_role_implication(user)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    dirty = False
    if email and user.email != email:
        user.email = email
        dirty = True
    if name and user.name != name:
        user.name = name
        dirty = True
    # Promote on subsequent sign-ins too, in case the env was added later.
    if email and email.lower() in _superadmin_emails() and not user.is_superadmin:
        user.is_superadmin = True
        user.is_admin = True
        user.is_editor = True
        dirty = True
    if (
        user.last_seen_at is None
        or (now - user.last_seen_at).total_seconds()
        > USER_LAST_SEEN_THROTTLE_SECONDS
    ):
        user.last_seen_at = now
        dirty = True
    if dirty:
        db.commit()
        db.refresh(user)
    return user


# ── FastAPI dependencies ────────────────────────────────────────────────


def _bearer_token(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization") or request.headers.get(
        "authorization"
    )
    if not auth:
        return None
    parts = auth.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None


def current_user(
    request: Request, db: Session = Depends(get_db)
) -> User:
    """Require a valid Clerk JWT; return the matching User row.

    Raises 401 on missing or invalid token.
    """
    token = _bearer_token(request)
    if not token:
        raise AuthError("Authentication required.")
    claims = _verify_clerk_jwt(token)
    return _provision_user(db, claims)


def optional_user(
    request: Request, db: Session = Depends(get_db)
) -> Optional[User]:
    """Return the current User when a valid token is present, else None.

    Use on routes that adapt behavior for signed-in users without
    requiring auth.
    """
    token = _bearer_token(request)
    if not token:
        return None
    try:
        claims = _verify_clerk_jwt(token)
    except HTTPException:
        return None
    return _provision_user(db, claims)


def _forbidden(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def require_editor(user: User = Depends(current_user)) -> User:
    if not (user.is_editor or user.is_admin or user.is_superadmin):
        raise _forbidden("Editor role required.")
    return user


def require_admin(user: User = Depends(current_user)) -> User:
    if not (user.is_admin or user.is_superadmin):
        raise _forbidden("Admin role required.")
    return user


def require_superadmin(user: User = Depends(current_user)) -> User:
    if not user.is_superadmin:
        raise _forbidden("Superadmin role required.")
    return user
