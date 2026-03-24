import re
from datetime import date
from typing import Optional
from urllib.parse import parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup
from youtube_transcript_api import YouTubeTranscriptApi

from .fetcher import FetchError

_YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "www.youtu.be",
}


def is_youtube_url(url: str) -> bool:
    try:
        hostname = (urlparse(url.strip()).hostname or "").lower()
    except Exception:
        return False
    return hostname in _YOUTUBE_HOSTS


def _extract_video_id(url: str) -> str:
    parsed = urlparse(url.strip())
    hostname = (parsed.hostname or "").lower()

    if hostname == "youtu.be" or hostname == "www.youtu.be":
        vid = parsed.path.lstrip("/").split("/")[0]
        if vid:
            return vid

    # /watch?v=ID
    qs = parse_qs(parsed.query)
    if "v" in qs and qs["v"][0]:
        return qs["v"][0]

    # /live/ID, /shorts/ID, /embed/ID
    match = re.match(r"^/(?:live|shorts|embed)/([A-Za-z0-9_-]+)", parsed.path)
    if match:
        return match.group(1)

    raise FetchError(
        f"Could not extract a YouTube video ID from the URL: {url}"
    )


def _fetch_video_metadata(url: str) -> dict:
    """Scrape the YouTube watch page for title, channel, date, description."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    }
    try:
        with httpx.Client(timeout=20.0, follow_redirects=True) as client:
            resp = client.get(url, headers=headers)
            resp.raise_for_status()
    except httpx.HTTPError as e:
        return {"title": None, "channel": None, "published_date": None, "description": None}

    soup = BeautifulSoup(resp.text, "html.parser")

    title: Optional[str] = None
    og = soup.find("meta", property="og:title")
    if og and og.get("content"):
        title = og["content"]
    elif soup.title:
        title = soup.title.get_text(strip=True)

    channel: Optional[str] = None
    link_tag = soup.find("link", itemprop="name")
    if link_tag and link_tag.get("content"):
        channel = link_tag["content"]
    else:
        meta_author = soup.find("meta", attrs={"name": "author"})
        if meta_author and meta_author.get("content"):
            channel = meta_author["content"]

    published_date: Optional[date] = None
    for attr in ("datePublished", "uploadDate"):
        tag = soup.find("meta", itemprop=attr)
        if tag and tag.get("content"):
            try:
                published_date = date.fromisoformat(tag["content"][:10])
                break
            except ValueError:
                continue

    description: Optional[str] = None
    og_desc = soup.find("meta", property="og:description")
    if og_desc and og_desc.get("content"):
        description = og_desc["content"]
    else:
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            description = meta_desc["content"]

    return {
        "title": title,
        "channel": channel,
        "published_date": published_date,
        "description": description,
    }


def fetch_youtube_transcript(url: str) -> dict:
    video_id = _extract_video_id(url)
    metadata = _fetch_video_metadata(url)

    ytt = YouTubeTranscriptApi()
    try:
        transcript = ytt.fetch(video_id, languages=["en", "en-US", "en-GB", "en-AU", "en-CA"])
    except Exception:
        try:
            first = next(iter(ytt.list(video_id)))
            transcript = first.fetch()
        except Exception as e:
            raise FetchError(
                f"Could not fetch YouTube transcript: {e}. "
                "The video may not have captions available."
            ) from e

    segments = [snippet.text for snippet in transcript.snippets]
    if not segments:
        raise FetchError("YouTube transcript is empty — no caption segments found.")

    transcript_text = " ".join(segments)

    parts = []
    if metadata.get("description"):
        parts.append(f"VIDEO DESCRIPTION:\n{metadata['description']}")
    parts.append(f"TRANSCRIPT:\n{transcript_text}")
    combined_text = "\n\n".join(parts)

    channel = metadata.get("channel") or "YouTube"
    publication = f"{channel} (YouTube)"

    return {
        "title": metadata.get("title"),
        "text": combined_text,
        "publication": publication,
        "published_date": metadata.get("published_date"),
        "url": url,
        "source_type": "youtube_transcript",
    }
