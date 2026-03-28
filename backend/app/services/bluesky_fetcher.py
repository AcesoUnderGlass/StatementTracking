import re
from datetime import date, datetime
from typing import Optional
from urllib.parse import urlparse

import httpx

from .fetcher import FetchError

_BLUESKY_HOSTS = {"bsky.app", "www.bsky.app"}

_POST_PATH_RE = re.compile(r"^/profile/([^/]+)/post/([a-z0-9]+)$")

_BSKY_PUBLIC_API = "https://public.api.bsky.app/xrpc"


def is_bluesky_url(url: str) -> bool:
    try:
        parsed = urlparse(url.strip())
        hostname = (parsed.hostname or "").lower()
    except Exception:
        return False
    if hostname not in _BLUESKY_HOSTS:
        return False
    return bool(_POST_PATH_RE.match(parsed.path or ""))


def _parse_post_url(url: str) -> tuple[str, str]:
    """Return (handle, rkey) from a bsky.app post URL."""
    parsed = urlparse(url.strip())
    match = _POST_PATH_RE.match(parsed.path or "")
    if not match:
        raise FetchError(f"Could not parse Bluesky post URL: {url}")
    return match.group(1), match.group(2)


def _resolve_handle(handle: str) -> str:
    """Resolve a Bluesky handle to a DID via the public API."""
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(
                f"{_BSKY_PUBLIC_API}/com.atproto.identity.resolveHandle",
                params={"handle": handle},
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 400:
            raise FetchError(
                f"Could not resolve Bluesky handle @{handle} — the account "
                "may not exist."
            ) from e
        raise FetchError(f"Failed to resolve Bluesky handle: {e}") from e
    except httpx.HTTPError as e:
        raise FetchError(f"Failed to resolve Bluesky handle: {e}") from e

    return resp.json()["did"]


def _parse_bluesky_date(created_at: str) -> Optional[date]:
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return datetime.strptime(created_at, fmt).date()
        except ValueError:
            continue
    try:
        return date.fromisoformat(created_at[:10])
    except ValueError:
        return None


def fetch_bluesky_post(url: str) -> dict:
    handle, rkey = _parse_post_url(url)

    did = _resolve_handle(handle)
    at_uri = f"at://{did}/app.bsky.feed.post/{rkey}"

    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.get(
                f"{_BSKY_PUBLIC_API}/app.bsky.feed.getPostThread",
                params={"uri": at_uri, "depth": 0, "parentHeight": 0},
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 400:
            raise FetchError(
                "Bluesky post not found — it may have been deleted."
            ) from e
        raise FetchError(f"Failed to fetch Bluesky post: {e}") from e
    except httpx.HTTPError as e:
        raise FetchError(f"Failed to fetch Bluesky post: {e}") from e

    data = resp.json()
    thread = data.get("thread", {})
    post = thread.get("post", {})
    record = post.get("record", {})
    author = post.get("author", {})

    post_text = record.get("text", "")
    if not post_text:
        raise FetchError("Could not extract text from the Bluesky post.")

    display_name = author.get("displayName", "")
    author_handle = author.get("handle", handle)
    published_date = _parse_bluesky_date(record.get("createdAt", ""))

    canonical_url = f"https://bsky.app/profile/{author_handle}/post/{rkey}"

    title_parts = []
    if display_name:
        title_parts.append(display_name)
    title_parts.append(f"(@{author_handle})")
    title = " ".join(title_parts)

    author_label = display_name or author_handle
    text = f"BLUESKY POST by {author_label} (@{author_handle}):\n{post_text}"

    publication = f"{author_label} (Bluesky)"

    return {
        "title": title,
        "text": text,
        "publication": publication,
        "published_date": published_date,
        "url": canonical_url,
        "source_type": "bluesky_post",
    }
