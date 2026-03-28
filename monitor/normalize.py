"""URL normalization for consistent deduplication across all monitors."""
from __future__ import annotations

import re
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

_STRIP_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "ref", "fbclid", "gclid", "gclsrc", "dclid", "msclkid",
    "mc_cid", "mc_eid", "s_cid", "mkt_tok",
    "_ga", "_gl", "yclid", "twclid",
    "si", "feature", "app",
}

_GOOGLE_NEWS_RE = re.compile(
    r"^https?://news\.google\.com/rss/articles/",
    re.IGNORECASE,
)


def normalize_url(url: str) -> str:
    """Normalize a URL for deduplication.

    - Strips tracking query parameters
    - Removes trailing slashes from path
    - Normalizes http to https
    - Lowercases hostname
    - Strips www. prefix
    """
    url = url.strip()
    if not url:
        return url

    parsed = urlparse(url)

    scheme = "https" if parsed.scheme in ("http", "https") else parsed.scheme

    hostname = (parsed.hostname or "").lower()
    if hostname.startswith("www."):
        hostname = hostname[4:]

    port = parsed.port
    if port in (80, 443, None):
        netloc = hostname
    else:
        netloc = f"{hostname}:{port}"

    path = parsed.path.rstrip("/") or "/"

    if parsed.query:
        params = parse_qs(parsed.query, keep_blank_values=True)
        filtered = {
            k: v for k, v in params.items()
            if k.lower() not in _STRIP_PARAMS
        }
        query = urlencode(filtered, doseq=True) if filtered else ""
    else:
        query = ""

    return urlunparse((scheme, netloc, path, parsed.params, query, ""))


def resolve_google_news_url(url: str) -> str | None:
    """Attempt to resolve a Google News redirect URL to the actual article URL.

    Google News RSS entries use URLs like:
    https://news.google.com/rss/articles/CBMi...

    These redirect to the actual article. We follow the redirect to get the
    real URL. Returns None if resolution fails.
    """
    if not _GOOGLE_NEWS_RE.match(url):
        return None

    try:
        import httpx
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            response = client.head(url)
            final_url = str(response.url)
            if not _GOOGLE_NEWS_RE.match(final_url):
                return normalize_url(final_url)
    except Exception:
        pass

    return None
