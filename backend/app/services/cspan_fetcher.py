from __future__ import annotations

import logging
import re
from datetime import date
from typing import Optional
from urllib.parse import parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup

from .fetcher import FetchError

logger = logging.getLogger(__name__)

_CSPAN_HOSTS = {
    "c-span.org",
    "www.c-span.org",
}

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0.0.0 Safari/537.36"
)

_HEADERS = {
    "User-Agent": _USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

_PROGID_RE = re.compile(r"""prog(?:ram)?id[='":\s]+(\d+)""", re.IGNORECASE)

_MONTH_NAMES = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}

_CSPAN_DATE_RE = re.compile(
    r"([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})", re.IGNORECASE,
)


def _parse_cspan_date(text: str) -> Optional[date]:
    """Parse dates like 'July 25, 2023' commonly found on C-SPAN pages."""
    m = _CSPAN_DATE_RE.search(text)
    if not m:
        return None
    month_name = m.group(1).lower()
    month = _MONTH_NAMES.get(month_name)
    if month is None:
        return None
    try:
        return date(int(m.group(3)), month, int(m.group(2)))
    except ValueError:
        return None

_VIDEO_QUERY_ID_RE = re.compile(r"^/video/\?(\d+)")

_PROGRAM_PATH_RE = re.compile(r"^/program/[^/]+/[^/]+/(\d+)")
_CLIP_PATH_RE = re.compile(r"^/clip/[^/]+/[^/]+/(\d+)")


def is_cspan_url(url: str) -> bool:
    try:
        hostname = (urlparse(url.strip()).hostname or "").lower()
    except Exception:
        return False
    return hostname in _CSPAN_HOSTS


def _is_transcript_viewer_url(url: str) -> bool:
    """Check if this is already a /video/cc/ transcript viewer URL."""
    try:
        path = urlparse(url.strip()).path or ""
    except Exception:
        return False
    return path.rstrip("/").startswith("/video/cc")


def _extract_progid_from_url(url: str) -> Optional[str]:
    """Try to extract a progid directly from the URL query string."""
    try:
        parsed = urlparse(url.strip())
        qs = parse_qs(parsed.query)
        if "progid" in qs and qs["progid"][0]:
            return qs["progid"][0]
    except Exception:
        pass
    return None


def _extract_video_id_from_url(url: str) -> Optional[str]:
    """Extract the numeric video ID from common C-SPAN URL patterns.

    This is the page-level ID (e.g. ``414225`` from ``/video/?414225-1/...``),
    NOT the progid needed for the transcript viewer.  The progid is embedded
    in the video page HTML.
    """
    try:
        parsed = urlparse(url.strip())
        path = parsed.path or ""
    except Exception:
        return None

    m = _VIDEO_QUERY_ID_RE.match(path + "?" + (parsed.query or ""))
    if not m:
        full = f"{path}?{parsed.query}" if parsed.query else path
        m = _VIDEO_QUERY_ID_RE.search(full)
    if m:
        return m.group(1)

    m = _PROGRAM_PATH_RE.match(path)
    if m:
        return m.group(1)

    m = _CLIP_PATH_RE.match(path)
    if m:
        return m.group(1)

    return None


def _extract_progid_from_html(html: str) -> Optional[str]:
    """Find the progid embedded in C-SPAN video page HTML.

    C-SPAN embeds it as ``data-progid='NNNNN'`` or in a hidden input
    ``<input type="hidden" name="id" value="NNNNN">``, or in JS as
    ``programid=NNNNN``.
    """
    m = re.search(r'data-progid=[\'"](\d+)[\'"]', html)
    if m:
        return m.group(1)

    soup = BeautifulSoup(html, "html.parser")
    hidden = soup.find("input", attrs={"type": "hidden", "name": "id"})
    if hidden and hidden.get("value"):
        val = str(hidden["value"]).strip()
        if val.isdigit():
            return val

    m = _PROGID_RE.search(html[:50_000])
    if m:
        return m.group(1)

    return None


def _fetch_page(url: str) -> str:
    """Fetch a page and return its HTML text."""
    try:
        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            resp = client.get(url, headers=_HEADERS)
            resp.raise_for_status()
            return resp.text
    except httpx.HTTPError as e:
        raise FetchError(f"Failed to fetch C-SPAN page: {e}") from e


def _fetch_video_metadata(html: str) -> dict:
    """Extract title, date, and description from C-SPAN video page HTML."""
    import json as _json

    soup = BeautifulSoup(html, "html.parser")

    title: Optional[str] = None
    og = soup.find("meta", property="og:title")
    if og and og.get("content"):
        title = og["content"]
    elif soup.title:
        raw_title = soup.title.get_text(strip=True)
        for suffix in (" | Video | C-SPAN.org", " | C-SPAN.org"):
            if raw_title.endswith(suffix):
                raw_title = raw_title[: -len(suffix)]
        title = raw_title

    published_date: Optional[date] = None
    for attr in ("datePublished", "uploadDate", "date"):
        tag = soup.find("meta", itemprop=attr) or soup.find(
            "meta", attrs={"name": attr}
        )
        if tag and tag.get("content"):
            try:
                published_date = date.fromisoformat(tag["content"][:10])
                break
            except ValueError:
                continue
    if published_date is None:
        tag = soup.find("meta", property="article:published_time")
        if tag and tag.get("content"):
            try:
                published_date = date.fromisoformat(tag["content"][:10])
            except ValueError:
                pass

    if published_date is None:
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                ld = _json.loads(script.get_text())
                video = ld.get("video", ld) if isinstance(ld, dict) else {}
                for key in ("uploadDate", "datePublished"):
                    val = video.get(key, "")
                    if val and not val.startswith(":::"):
                        published_date = date.fromisoformat(val[:10])
                        break
            except (ValueError, TypeError, _json.JSONDecodeError):
                continue
            if published_date:
                break

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
        "published_date": published_date,
        "description": description,
    }


_SPEAKER_LABEL_PREFIX_RE = re.compile(
    r"^(?!>>)"
    r"("
    r"(?:(?:PRES|SEN|REP|MR|MRS|MS|DR|GEN|ADM|GOV|MAJ|SGT|LT|COL|CMDR|CAPT)"
    r"\.?\s+)?"
    r"[A-Z][a-zA-Z]{2,}(?:['\-][A-Za-z]+)*"
    r"(?:\s+[A-Z][a-zA-Z]{1,}(?:['\-][A-Za-z]+)*){0,4}"
    r"|Unidentified Speaker"
    r"|ANNOUNCER"
    r"|MODERATOR"
    r"|NARRATOR"
    r")\s*:\s*",
)


def _parse_transcript_html(html: str) -> list[tuple[str, str]]:
    """Parse C-SPAN transcript HTML into (speaker, text) tuples.

    Handles two HTML layouts:

    1. **CC viewer** (``/video/cc/?progid=X``): ``<ul>`` with ``<li>``
       elements where speaker attribution appears at the start of each
       ``<li>`` (e.g. ``BIDEN:``, ``>> text``).
    2. **Playwright-rendered program page**: ``<table>`` with ``<tr>``
       rows containing ``<p class="transcript-text">`` elements.  This
       is auto-generated closed captioning loaded via JavaScript.
    """
    soup = BeautifulSoup(html, "html.parser")

    entries: list[tuple[str, str]] = []

    # --- Strategy 1: table-based format (Playwright-rendered pages) ---
    table = soup.find("table", id="video-transcript-table")
    if table:
        for p_tag in table.find_all("p", class_="transcript-text"):
            raw = p_tag.get_text(separator=" ", strip=True)
            if not raw:
                continue
            raw = re.sub(r"\s+", " ", raw).strip()
            for segment in re.split(r"(?=>>)", raw):
                segment = segment.strip()
                if not segment:
                    continue
                m = _SPEAKER_LABEL_PREFIX_RE.match(segment)
                if m:
                    entries.append((m.group(1).strip(), segment[m.end():].strip()))
                else:
                    entries.append(("", segment.lstrip("> ").strip()))
        if entries:
            return entries

    # --- Strategy 2: <li>-based format (CC viewer responses) ---
    lis = soup.find_all("li")
    if not lis:
        return []

    for li in lis:
        raw = li.get_text(separator=" ", strip=True)
        if not raw:
            continue

        raw = re.sub(r"\s+", " ", raw).strip()

        m = _SPEAKER_LABEL_PREFIX_RE.match(raw)
        if m:
            speaker = m.group(1).strip()
            text = raw[m.end():].strip()
        else:
            speaker = ""
            text = raw.lstrip("> ").strip()

        if text:
            entries.append((speaker, text))

    return entries


def _format_transcript(
    entries: list[tuple[str, str]],
    description: Optional[str] = None,
) -> str:
    """Format parsed transcript entries into speaker-labeled text.

    Consecutive segments from the same speaker are merged.
    """
    parts: list[str] = []
    if description:
        parts.append(f"EVENT DESCRIPTION:\n{description}")

    parts.append("TRANSCRIPT:")

    prev_speaker: Optional[str] = None
    current_block: list[str] = []

    def flush():
        if current_block:
            label = f"{prev_speaker}: " if prev_speaker else ""
            parts.append(f"{label}{' '.join(current_block)}")

    for speaker, text in entries:
        if speaker != prev_speaker:
            flush()
            current_block = [text]
            prev_speaker = speaker
        else:
            current_block.append(text)

    flush()

    return "\n\n".join(parts)


def _build_result_from_cc(
    transcript_html: str,
    metadata: dict,
    url: str,
) -> Optional[dict]:
    """Try to parse a CC viewer response into a result dict.

    Returns ``None`` when the response is empty or has no transcript
    entries (e.g. "Invalid program ID").
    """
    if not transcript_html or len(transcript_html) < 50:
        return None

    entries = _parse_transcript_html(transcript_html)
    if not entries:
        return None

    if not metadata.get("title") or not metadata.get("published_date"):
        tc_soup = BeautifulSoup(transcript_html, "html.parser")
        if not metadata.get("title"):
            h1 = tc_soup.find("h1")
            if h1:
                metadata["title"] = h1.get_text(strip=True)
            else:
                og = tc_soup.find("meta", property="og:title")
                if og and og.get("content"):
                    metadata["title"] = og["content"]
        if not metadata.get("published_date"):
            h2 = tc_soup.find("h2")
            if h2:
                metadata["published_date"] = _parse_cspan_date(
                    h2.get_text(strip=True)
                )

    combined = _format_transcript(entries, metadata.get("description"))

    return {
        "title": metadata.get("title"),
        "text": combined,
        "publication": "C-SPAN",
        "published_date": metadata.get("published_date"),
        "url": url,
        "source_type": "page_transcript",
    }


def _fetch_via_playwright(url: str) -> dict:
    """Render a C-SPAN page with Playwright and extract the transcript.

    C-SPAN video/program pages are JS-rendered SPAs — the transcript
    text only appears after JavaScript executes.  We wait for the
    ``.transcript`` container (or the ``#video-transcript-table``)
    rather than ``networkidle``, which never fires on C-SPAN due to
    persistent streaming/analytics connections.
    """
    import os

    if not os.environ.get("FETCHER_ENABLE_PLAYWRIGHT"):
        raise FetchError(
            "Playwright fallback disabled (set FETCHER_ENABLE_PLAYWRIGHT=1)"
        )

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise FetchError(
            "playwright not installed — browser fallback unavailable"
        )

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                context = browser.new_context(user_agent=_USER_AGENT)
                page = context.new_page()
                page.goto(url, wait_until="domcontentloaded", timeout=45_000)
                try:
                    page.wait_for_selector(
                        "#video-transcript-table, .transcript p.transcript-text",
                        timeout=20_000,
                    )
                except Exception:
                    logger.debug(
                        "Transcript selector not found within 20s, "
                        "grabbing current page content"
                    )
                html = page.content()
            finally:
                browser.close()
    except FetchError:
        raise
    except Exception as e:
        raise FetchError(f"Playwright browser fetch failed: {e}") from e

    metadata = _fetch_video_metadata(html)
    result = _build_result_from_cc(html, metadata, url)
    if result:
        return result

    from .fetcher import _extract_article_from_html

    return _extract_article_from_html(html, url)


def fetch_cspan_transcript(url: str) -> dict:
    """Fetch a C-SPAN video transcript and return a normalized article dict.

    Strategy (tried in order):
    1. Transcript viewer URL (``/video/cc/?progid=X``) — fetch directly.
    2. Video/program/clip page — scrape the page HTML for a progid, then
       fetch the CC viewer.
    3. Playwright — render the page in a headless browser to get the
       JS-populated transcript (requires ``FETCHER_ENABLE_PLAYWRIGHT=1``).
    4. If nothing works, raise a C-SPAN-specific error with guidance.
    """
    metadata: dict = {"title": None, "published_date": None, "description": None}

    # --- Direct transcript viewer URL ---
    if _is_transcript_viewer_url(url):
        progid = _extract_progid_from_url(url)
        if progid is None:
            raise FetchError(
                "Could not extract progid from C-SPAN transcript URL."
            )
        transcript_html = _fetch_page(
            f"https://www.c-span.org/video/cc/?progid={progid}"
        )
        result = _build_result_from_cc(transcript_html, metadata, url)
        if result:
            return result
        raise FetchError(
            f"C-SPAN transcript viewer returned no content for progid {progid}."
        )

    # --- Video / program / clip page ---
    progid: Optional[str] = None
    try:
        page_html = _fetch_page(url)
        metadata = _fetch_video_metadata(page_html)
        progid = _extract_progid_from_html(page_html)
    except FetchError:
        logger.debug("Direct page fetch failed for %s", url)

    if progid:
        try:
            transcript_html = _fetch_page(
                f"https://www.c-span.org/video/cc/?progid={progid}"
            )
            result = _build_result_from_cc(transcript_html, metadata, url)
            if result:
                return result
        except FetchError:
            logger.debug("CC viewer fetch failed for progid %s", progid)

    # --- Playwright (JS rendering) ---
    logger.info(
        "No progid found for %s — trying Playwright rendering", url,
    )
    try:
        result = _fetch_via_playwright(url)
        result["publication"] = "C-SPAN"
        if "source_type" not in result:
            result["source_type"] = "page_transcript"
        return result
    except FetchError as e:
        logger.info("Playwright fallback failed for %s: %s", url, e)

    # --- All strategies exhausted ---
    raise FetchError(
        "Could not extract transcript from this C-SPAN page. "
        "C-SPAN video pages require JavaScript rendering. "
        "To fix this, either:\n"
        "  1. Set FETCHER_ENABLE_PLAYWRIGHT=1 and install playwright "
        "(pip install playwright && playwright install chromium), or\n"
        "  2. Use the transcript viewer URL directly: go to the C-SPAN "
        "video page in your browser, click the Transcript tab, and copy "
        "the URL (format: c-span.org/video/cc/?progid=XXXXX)."
    )
