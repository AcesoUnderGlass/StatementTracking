"""URL normalization for consistent deduplication across all monitors."""
from __future__ import annotations

import logging
import re
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

logger = logging.getLogger(__name__)

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
    """Decode a Google News wrapper URL to the actual article URL.

    Google News RSS entries use URLs like
    ``https://news.google.com/rss/articles/CBMi...`` which don't
    redirect via HTTP — they require JS execution.  Uses
    ``googlenewsdecoder`` to extract the real destination.

    Returns the normalized article URL, or None if decoding fails.
    """
    if not _GOOGLE_NEWS_RE.match(url):
        return None

    try:
        from googlenewsdecoder import gnewsdecoder

        result = gnewsdecoder(url, interval=None)
        if result.get("status"):
            return normalize_url(result["decoded_url"])
    except Exception as exc:
        logger.debug("Google News URL decode failed for %s: %s", url, exc)

    return None
