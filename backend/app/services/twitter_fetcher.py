import re
from datetime import date, datetime
from typing import Optional
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from .fetcher import FetchError

_TWITTER_HOSTS = {
    "twitter.com",
    "www.twitter.com",
    "mobile.twitter.com",
    "x.com",
    "www.x.com",
}

_STATUS_PATH_RE = re.compile(r"^/[^/]+/status/(\d+)")


def is_twitter_url(url: str) -> bool:
    try:
        parsed = urlparse(url.strip())
        hostname = (parsed.hostname or "").lower()
    except Exception:
        return False
    if hostname not in _TWITTER_HOSTS:
        return False
    return bool(_STATUS_PATH_RE.match(parsed.path or ""))


def _extract_tweet_id(url: str) -> str:
    parsed = urlparse(url.strip())
    match = _STATUS_PATH_RE.match(parsed.path or "")
    if not match:
        raise FetchError(f"Could not extract a tweet ID from the URL: {url}")
    return match.group(1)


def _normalize_url(url: str) -> str:
    """Rewrite to x.com canonical form for the oEmbed call."""
    parsed = urlparse(url.strip())
    path = parsed.path.split("?")[0].rstrip("/")
    return f"https://x.com{path}"


def _parse_oembed_date(html: str) -> Optional[date]:
    """Try to pull the tweet date from the blockquote HTML.

    The oEmbed HTML typically ends with an <a> whose text is a date like
    "March 25, 2026".
    """
    soup = BeautifulSoup(html, "html.parser")
    links = soup.find_all("a")
    for link in reversed(links):
        text = link.get_text(strip=True)
        for fmt in ("%B %d, %Y", "%b %d, %Y"):
            try:
                return datetime.strptime(text, fmt).date()
            except ValueError:
                continue
    return None


def _extract_text_from_html(html: str) -> str:
    """Pull the tweet body from the oEmbed blockquote HTML.

    The structure is a <blockquote> containing one or more <p> tags with the
    tweet text, followed by attribution/date links we want to exclude.
    """
    soup = BeautifulSoup(html, "html.parser")
    bq = soup.find("blockquote")
    if not bq:
        bq = soup

    paragraphs = bq.find_all("p")
    if not paragraphs:
        return bq.get_text(separator="\n", strip=True)

    parts = []
    for p in paragraphs:
        text = p.get_text(separator=" ", strip=True)
        if text:
            parts.append(text)
    return "\n\n".join(parts)


def fetch_tweet(url: str) -> dict:
    canonical = _normalize_url(url)
    _extract_tweet_id(url)

    oembed_url = "https://publish.twitter.com/oembed"
    params = {
        "url": canonical,
        "omit_script": "true",
        "hide_thread": "true",
    }

    try:
        with httpx.Client(timeout=20.0, follow_redirects=True) as client:
            resp = client.get(oembed_url, params=params)
            resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise FetchError(
                "Tweet not found — it may have been deleted or the account "
                "may be private."
            ) from e
        raise FetchError(f"Failed to fetch tweet via oEmbed: {e}") from e
    except httpx.HTTPError as e:
        raise FetchError(f"Failed to fetch tweet via oEmbed: {e}") from e

    data = resp.json()
    html = data.get("html", "")
    author_name = data.get("author_name", "Unknown")
    author_url = data.get("author_url", "")

    tweet_text = _extract_text_from_html(html)
    if not tweet_text:
        raise FetchError("Could not extract text from the tweet.")

    published_date = _parse_oembed_date(html)

    handle = ""
    if author_url:
        handle = author_url.rstrip("/").rsplit("/", 1)[-1]

    title_parts = []
    if author_name:
        title_parts.append(author_name)
    if handle:
        title_parts.append(f"(@{handle})")
    title = " ".join(title_parts) if title_parts else None

    text = f"TWEET by {author_name}"
    if handle:
        text += f" (@{handle})"
    text += f":\n{tweet_text}"

    publication = f"{author_name} (X/Twitter)"

    return {
        "title": title,
        "text": text,
        "publication": publication,
        "published_date": published_date,
        "url": canonical,
        "source_type": "tweet",
    }
