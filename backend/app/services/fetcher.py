import io
import re
from datetime import date
from typing import Optional
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from pypdf import PdfReader
from pypdf.errors import PdfReadError

PUBLICATION_LOOKUP = {
    "nytimes.com": "The New York Times",
    "washingtonpost.com": "The Washington Post",
    "wsj.com": "The Wall Street Journal",
    "politico.com": "Politico",
    "thehill.com": "The Hill",
    "reuters.com": "Reuters",
    "apnews.com": "Associated Press",
    "cnn.com": "CNN",
    "foxnews.com": "Fox News",
    "nbcnews.com": "NBC News",
    "abcnews.go.com": "ABC News",
    "cbsnews.com": "CBS News",
    "bbc.com": "BBC",
    "bbc.co.uk": "BBC",
    "theguardian.com": "The Guardian",
    "axios.com": "Axios",
    "bloomberg.com": "Bloomberg",
    "techcrunch.com": "TechCrunch",
    "wired.com": "Wired",
    "theverge.com": "The Verge",
    "arstechnica.com": "Ars Technica",
    "npr.org": "NPR",
    "pbs.org": "PBS",
    "usatoday.com": "USA Today",
    "latimes.com": "Los Angeles Times",
    "cnbc.com": "CNBC",
    "ft.com": "Financial Times",
}


def _derive_publication(url: str) -> str:
    hostname = urlparse(url).hostname or ""
    hostname = hostname.removeprefix("www.")
    if hostname in PUBLICATION_LOOKUP:
        return PUBLICATION_LOOKUP[hostname]
    parts = hostname.rsplit(".", 2)
    if len(parts) >= 2:
        return parts[-2].capitalize()
    return hostname


class FetchError(Exception):
    pass


def _is_pdf_url(url: str) -> bool:
    try:
        path = (urlparse(url.strip()).path or "").lower()
    except Exception:
        return False
    if not path:
        return False
    return path.rsplit("/", 1)[-1].endswith(".pdf")


def _pdf_metadata_title(reader: PdfReader) -> Optional[str]:
    meta = reader.metadata
    if not meta:
        return None
    title = getattr(meta, "title", None)
    if title:
        return str(title).strip() or None
    if hasattr(meta, "get"):
        raw = meta.get("/Title")
        if raw:
            return str(raw).strip() or None
    return None


def _fetch_pdf_article(url: str) -> dict:
    headers = {
        "User-Agent": (
            "StatementTracking/1.0 (+https://github.com/) article-extractor"
        ),
        "Accept": "application/pdf,*/*;q=0.8",
    }
    try:
        with httpx.Client(timeout=60.0, follow_redirects=True) as client:
            response = client.get(url, headers=headers)
            response.raise_for_status()
            data = response.content
    except httpx.HTTPError as e:
        raise FetchError(f"Failed to download PDF: {e}") from e

    if len(data) < 5 or not data[:5].startswith(b"%PDF-"):
        raise FetchError(
            "The URL did not return a valid PDF file (missing %PDF header)."
        )

    try:
        reader = PdfReader(io.BytesIO(data))
    except PdfReadError as e:
        raise FetchError(f"Could not read PDF: {e}") from e

    if getattr(reader, "is_encrypted", False):
        raise FetchError(
            "PDF is password-protected or encrypted and cannot be extracted."
        )

    text_parts: list[str] = []
    for page in reader.pages:
        try:
            text_parts.append(page.extract_text() or "")
        except Exception as e:
            raise FetchError(f"Failed to extract text from PDF page: {e}") from e

    text = "\n".join(text_parts).strip()

    if not text or len(text) < 100:
        raise FetchError(
            "Extracted PDF text is too short or empty — the file may be "
            "image-only (scanned) or protected."
        )

    title = _pdf_metadata_title(reader)

    return {
        "title": title,
        "text": text,
        "publication": _derive_publication(url),
        "published_date": None,
        "url": url,
    }


_USER_AGENT = "StatementTracking/1.0 (+https://github.com/) article-extractor"


def _parse_publish_date(soup: BeautifulSoup) -> Optional[date]:
    for attr in ("article:published_time", "datePublished", "date"):
        tag = soup.find("meta", property=attr) or soup.find("meta", attrs={"name": attr})
        if tag and tag.get("content"):
            raw = tag["content"][:10]
            try:
                return date.fromisoformat(raw)
            except ValueError:
                continue
    return None


_TRANSCRIPT_URL_KEYWORDS = re.compile(
    r"transcript|hearing|testimony|remarks|briefing|press[-_ ]?conference"
    r"|opening[-_ ]?statement|keynote",
    re.IGNORECASE,
)

_SPEAKER_LABEL_RE = re.compile(
    r"^(?:"
    r"(?:(?:Mr|Mrs|Ms|Dr|Sen|Rep|Chairman|Chairwoman|Chairperson"
    r"|Senator|Representative|Secretary|Director|Commissioner"
    r"|Governor|Mayor|President|Vice\s+President"
    r"|General|Admiral|Ambassador|Judge|Justice"
    r"|The\s+(?:Chairman|Chairwoman|President))"
    r"\.?\s+[A-Z][A-Za-z\-']+)"
    r"|(?:[A-Z][A-Z\-']+(?:\s+[A-Z][A-Z\-']+){0,3})"
    r"|Q|A"
    r")\s*[:.]",
    re.MULTILINE,
)


def _detect_transcript(text: str, title: Optional[str], url: str) -> bool:
    """Heuristic: return True when the page appears to be a transcript
    (hearing, interview, press conference, speech) rather than a
    conventional news article."""
    url_and_title = f"{url} {title or ''}"
    if _TRANSCRIPT_URL_KEYWORDS.search(url_and_title):
        return True

    lines = text.split("\n")
    if not lines:
        return False

    label_lines = sum(1 for ln in lines if _SPEAKER_LABEL_RE.match(ln.strip()))
    distinct_labels = len({
        m.group()
        for ln in lines
        if (m := _SPEAKER_LABEL_RE.match(ln.strip()))
    })

    if distinct_labels >= 2 and label_lines >= 6:
        return True
    if len(lines) > 20 and label_lines / len(lines) > 0.08:
        return True

    return False


def _fetch_html_article(url: str) -> dict:
    headers = {"User-Agent": _USER_AGENT, "Accept": "text/html,*/*;q=0.8"}
    try:
        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            response = client.get(url, headers=headers)
            response.raise_for_status()
    except httpx.HTTPError as e:
        raise FetchError(f"Failed to fetch article: {e}") from e

    soup = BeautifulSoup(response.text, "html.parser")

    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else None

    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        title = og_title["content"]

    published_date = _parse_publish_date(soup)

    for tag in soup(["script", "style", "nav", "header", "footer", "aside",
                      "form", "iframe", "noscript", "svg"]):
        tag.decompose()

    main = soup.find("article") or soup.find("main") or soup.find(role="main")
    source = main if main else soup.body or soup

    text = source.get_text(separator="\n", strip=True)

    if not text or len(text) < 100:
        raise FetchError(
            "Article text is too short or empty — the page may be behind a paywall "
            "or require JavaScript rendering."
        )

    result: dict = {
        "title": title,
        "text": text,
        "publication": _derive_publication(url),
        "published_date": published_date,
        "url": url,
    }

    if _detect_transcript(text, title, url):
        result["source_type"] = "page_transcript"

    return result


def _is_youtube_url(url: str) -> bool:
    try:
        hostname = (urlparse(url.strip()).hostname or "").lower()
    except Exception:
        return False
    return hostname in {
        "youtube.com", "www.youtube.com", "m.youtube.com",
        "youtu.be", "www.youtu.be",
    }


def fetch_article(url: str) -> dict:
    if _is_youtube_url(url):
        from .youtube_fetcher import fetch_youtube_transcript
        return fetch_youtube_transcript(url)
    if _is_pdf_url(url):
        return _fetch_pdf_article(url)
    return _fetch_html_article(url)
