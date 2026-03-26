import os
import re
from datetime import date, datetime
from typing import Optional
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from dotenv import load_dotenv

from .fetcher import FetchError

load_dotenv()

_FACEBOOK_HOSTS = {
    "facebook.com",
    "www.facebook.com",
    "m.facebook.com",
    "web.facebook.com",
    "fb.com",
    "www.fb.com",
}

_POST_PATH_PATTERNS = [
    re.compile(r"^/[^/]+/posts/"),
    re.compile(r"^/[^/]+/activity/"),
    re.compile(r"^/permalink\.php"),
    re.compile(r"^/photo"),
    re.compile(r"^/watch/?\?"),
    re.compile(r"^/reel/"),
    re.compile(r"^/share/"),
    re.compile(r"^/[^/]+/videos/"),
    re.compile(r"^/story\.php"),
    re.compile(r"^/\d+/posts/"),
]


def is_facebook_url(url: str) -> bool:
    try:
        parsed = urlparse(url.strip())
        hostname = (parsed.hostname or "").lower()
    except Exception:
        return False
    if hostname not in _FACEBOOK_HOSTS:
        return False
    path = parsed.path or ""
    full_path = path + ("?" + parsed.query if parsed.query else "")
    return any(p.match(full_path) for p in _POST_PATH_PATTERNS)


def _try_oembed(url: str) -> Optional[dict]:
    """Try Facebook's Graph API oEmbed endpoint (requires access token)."""
    token = os.getenv("FACEBOOK_ACCESS_TOKEN")
    if not token:
        return None

    oembed_url = "https://graph.facebook.com/v21.0/oembed_post"
    params = {"url": url, "access_token": token, "omitscript": "true"}

    try:
        with httpx.Client(timeout=20.0, follow_redirects=True) as client:
            resp = client.get(oembed_url, params=params)
            resp.raise_for_status()
    except httpx.HTTPError:
        return None

    data = resp.json()
    html = data.get("html", "")
    if not html:
        return None

    author_name = data.get("author_name", "")
    author_url = data.get("author_url", "")

    soup = BeautifulSoup(html, "html.parser")
    bq = soup.find("blockquote") or soup
    paragraphs = bq.find_all("p")
    if paragraphs:
        post_text = "\n\n".join(
            p.get_text(separator=" ", strip=True)
            for p in paragraphs
            if p.get_text(strip=True)
        )
    else:
        post_text = bq.get_text(separator="\n", strip=True)

    published_date: Optional[date] = None
    for link in reversed(soup.find_all("a")):
        text = link.get_text(strip=True)
        for fmt in ("%B %d, %Y", "%b %d, %Y"):
            try:
                published_date = datetime.strptime(text, fmt).date()
                break
            except ValueError:
                continue
        if published_date:
            break

    return {
        "author_name": author_name,
        "author_url": author_url,
        "post_text": post_text,
        "published_date": published_date,
    }


def _scrape_public_post(url: str) -> dict:
    """Fall back to scraping the public HTML of a Facebook post."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        with httpx.Client(timeout=25.0, follow_redirects=True) as client:
            resp = client.get(url, headers=headers)
            resp.raise_for_status()
    except httpx.HTTPError as e:
        raise FetchError(f"Failed to fetch Facebook post: {e}") from e

    soup = BeautifulSoup(resp.text, "html.parser")

    og_desc = soup.find("meta", property="og:description")
    post_text = og_desc["content"] if og_desc and og_desc.get("content") else ""

    og_title = soup.find("meta", property="og:title")
    author_name = ""
    if og_title and og_title.get("content"):
        author_name = og_title["content"]
        for suffix in (" - Facebook", " | Facebook", " on Facebook"):
            if author_name.endswith(suffix):
                author_name = author_name[: -len(suffix)].strip()

    published_date: Optional[date] = None
    for attr in ("article:published_time", "datePublished", "date"):
        tag = soup.find("meta", property=attr) or soup.find(
            "meta", attrs={"name": attr}
        )
        if tag and tag.get("content"):
            try:
                published_date = date.fromisoformat(tag["content"][:10])
                break
            except ValueError:
                continue

    if not post_text:
        raise FetchError(
            "Could not extract text from the Facebook post. The post may be "
            "private, or the page requires JavaScript. Try setting "
            "FACEBOOK_ACCESS_TOKEN for better results."
        )

    return {
        "author_name": author_name,
        "author_url": "",
        "post_text": post_text,
        "published_date": published_date,
    }


def fetch_facebook_post(url: str) -> dict:
    result = _try_oembed(url)
    if result is None or not result.get("post_text"):
        result = _scrape_public_post(url)

    author_name = result["author_name"] or "Unknown"
    post_text = result["post_text"]
    published_date = result.get("published_date")

    title = f"{author_name} (Facebook)"

    text = f"FACEBOOK POST by {author_name}:\n{post_text}"

    publication = f"{author_name} (Facebook)"

    return {
        "title": title,
        "text": text,
        "publication": publication,
        "published_date": published_date,
        "url": url,
        "source_type": "facebook_post",
    }
