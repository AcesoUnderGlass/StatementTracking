from __future__ import annotations

import io
import logging
import os
import re
from datetime import date
from typing import Optional
from urllib.parse import quote, urlparse

import httpx
from bs4 import BeautifulSoup
from pypdf import PdfReader
from pypdf.errors import PdfReadError

logger = logging.getLogger(__name__)

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
    "c-span.org": "C-SPAN",
    "usatoday.com": "USA Today",
    "latimes.com": "Los Angeles Times",
    "cnbc.com": "CNBC",
    "ft.com": "Financial Times",
    # Chinese news outlets (articles, not institutional)
    "xinhuanet.com": "Xinhua News Agency",
    "chinadaily.com.cn": "China Daily",
    "globaltimes.cn": "Global Times",
    "scmp.com": "South China Morning Post",
    # Chinese / institutional domains (treated as press_statement sources)
    "cnaisi.cn": "China AI Safety & Development Association",
    "cac.gov.cn": "Cyberspace Administration of China",
    "miit.gov.cn": "Ministry of Industry and Information Technology",
    "most.gov.cn": "Ministry of Science and Technology",
    "samr.gov.cn": "State Administration for Market Regulation",
    "caict.ac.cn": "China Academy of Information and Communications Technology",
    "cesi.cn": "China Electronics Standardization Institute",
    "baai.ac.cn": "Beijing Academy of Artificial Intelligence",
    "aiia.org.cn": "China Artificial Intelligence Industry Alliance",
}

_INSTITUTIONAL_DOMAINS = {
    "cnaisi.cn",
    "cac.gov.cn",
    "miit.gov.cn",
    "most.gov.cn",
    "samr.gov.cn",
    "caict.ac.cn",
    "cesi.cn",
    "baai.ac.cn",
    "aiia.org.cn",
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


_GOOGLE_NEWS_RE = re.compile(
    r"^https?://news\.google\.com/(?:rss/)?articles/",
    re.IGNORECASE,
)


def _resolve_google_news_url(url: str) -> str | None:
    """Decode a Google News wrapper URL to the actual article URL.

    Google News RSS entries use URLs like
    ``https://news.google.com/rss/articles/CBMi...`` which don't
    redirect via HTTP — they require JS execution.  The
    ``googlenewsdecoder`` library fetches decoding params from Google
    and returns the real destination.
    """
    if not _GOOGLE_NEWS_RE.match(url):
        return None
    try:
        from googlenewsdecoder import gnewsdecoder

        result = gnewsdecoder(url, interval=None)
        if result.get("status"):
            return result["decoded_url"]
    except Exception as exc:
        logger.debug("Google News URL decode failed for %s: %s", url, exc)
    return None


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


_PRESS_STATEMENT_URL_KEYWORDS = re.compile(
    r"press[-_ ]?release|press[-_ ]?statement|official[-_ ]?statement"
    r"|executive[-_ ]?order|memorand(?:um|a)\b|proclamation"
    r"|fact[-_ ]?sheet|readout|communiqu[eé]"
    r"|white[-_ ]?paper|whitepaper"
    r"|open[-_ ]?letter|letter[-_ ]?to[-_ ]"
    r"|/(?:statements?|press[-_ ]?releases?"
    r"|announcements?|presidential[-_ ]?actions?"
    r"|insights?/alerts?|alerts?/\d"
    r"|advisori(?:es|y)|client[-_ ]?(?:alerts?|updates?)"
    r"|publications?/[^?#]"
    r")(?:/|$)",
    re.IGNORECASE,
)

_GOV_DOMAIN_RE = re.compile(
    r"\.gov(?:\.[a-z]{2})?$|\.mil$|\.gov\.cn$", re.IGNORECASE,
)

_CN_INSTITUTIONAL_DOMAIN_RE = re.compile(
    r"\.(?:gov\.cn|org\.cn|ac\.cn|edu\.cn)$", re.IGNORECASE,
)

_CJK_RE = re.compile(
    r"[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef"
    r"\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]"
)


def _detect_language(text: str) -> str:
    """Lightweight language detection based on CJK character density.

    Returns an ISO 639-1 code: ``"zh"`` for Chinese-dominant text,
    ``"en"`` otherwise.  Only distinguishes CJK vs non-CJK; future
    languages can extend this function.
    """
    if not text:
        return "en"
    sample = text[:2000]
    cjk_count = len(_CJK_RE.findall(sample))
    total_non_space = len(sample.replace(" ", "").replace("\n", ""))
    if total_non_space == 0:
        return "en"
    if cjk_count / total_non_space > 0.15:
        return "zh"
    return "en"


def _detect_press_statement(text: str, title: Optional[str], url: str) -> bool:
    """Heuristic: return True when the page is a single-voice official document
    (press release, executive order, fact sheet, open letter, etc.) whose full
    text is attributable to one author or issuing authority."""
    url_and_title = f"{url} {title or ''}"
    if _PRESS_STATEMENT_URL_KEYWORDS.search(url_and_title):
        return True

    hostname = urlparse(url).hostname or ""
    hostname = hostname.removeprefix("www.")

    if hostname in _INSTITUTIONAL_DOMAINS:
        return True

    # Known news outlets publish articles, not press statements.
    if hostname in PUBLICATION_LOOKUP:
        return False

    if _GOV_DOMAIN_RE.search(hostname) and len(text) > 500:
        quote_chars = text.count('"') + text.count('\u201c') + text.count('\u201d')
        if quote_chars < max(4, len(text) // 500):
            return True

    if _CN_INSTITUTIONAL_DOMAIN_RE.search(hostname) and len(text) > 200:
        return True

    return False


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


def _fetch_via_jina(url: str) -> dict:
    """Fetch article content via the Jina Reader API (r.jina.ai).

    Used as a fallback when the direct httpx fetch fails — Jina renders
    JavaScript and bypasses many anti-bot protections.
    """
    jina_url = f"https://r.jina.ai/{url}"
    headers: dict[str, str] = {
        "Accept": "application/json",
        "User-Agent": _USER_AGENT,
    }
    api_key = os.environ.get("JINA_API_KEY")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        with httpx.Client(timeout=60.0, follow_redirects=True) as client:
            response = client.get(jina_url, headers=headers)
            response.raise_for_status()
    except httpx.HTTPError as e:
        raise FetchError(f"Jina Reader fallback failed: {e}") from e

    try:
        body = response.json()
    except Exception as e:
        raise FetchError(f"Jina Reader returned non-JSON response: {e}") from e

    data = body.get("data") or {}
    text = (data.get("content") or "").strip()

    if not text or len(text) < 100:
        raise FetchError(
            "Jina Reader returned too little content — the page may be "
            "login-gated or otherwise inaccessible."
        )

    title = data.get("title") or None

    published_date: date | None = None
    raw_date = data.get("publishedTime") or ""
    if raw_date:
        try:
            published_date = date.fromisoformat(raw_date[:10])
        except ValueError:
            pass

    language = _detect_language(text)

    result: dict = {
        "title": title,
        "text": text,
        "publication": _derive_publication(url),
        "published_date": published_date,
        "url": url,
        "language": language,
    }

    if _detect_transcript(text, title, url):
        result["source_type"] = "page_transcript"
    elif _detect_press_statement(text, title, url):
        result["source_type"] = "press_statement"

    return result


def _detect_charset_from_html(html: str) -> str | None:
    """Extract charset from HTML meta tags without a full parse."""
    m = re.search(
        r'<meta[^>]+charset=["\']?\s*([A-Za-z0-9_-]+)',
        html[:4096],
        re.IGNORECASE,
    )
    if m:
        charset = m.group(1).strip().lower()
        if charset in ("gb2312", "gbk", "gb18030", "big5", "shift_jis", "euc-jp", "euc-kr"):
            return charset
    return None


def _extract_article_from_html(
    html: str, url: str, *, raw_bytes: bytes | None = None,
) -> dict:
    """Parse raw HTML into an article dict (title, text, date, etc.).

    Shared by every fetch tier that returns full HTML.  Raises
    ``FetchError`` when the extracted text is too short.

    If *raw_bytes* is provided and the HTML declares a non-UTF-8
    charset (e.g. GB2312, GBK), the bytes are re-decoded with
    that charset before parsing.
    """
    declared_charset = _detect_charset_from_html(html)
    if declared_charset and raw_bytes:
        try:
            html = raw_bytes.decode(declared_charset, errors="replace")
        except (LookupError, UnicodeDecodeError):
            pass

    soup = BeautifulSoup(html, "html.parser")

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

    language = _detect_language(text)

    result: dict = {
        "title": title,
        "text": text,
        "publication": _derive_publication(url),
        "published_date": published_date,
        "url": url,
        "language": language,
    }

    if _detect_transcript(text, title, url):
        result["source_type"] = "page_transcript"
    elif _detect_press_statement(text, title, url):
        result["source_type"] = "press_statement"

    return result


# ---------------------------------------------------------------------------
# Tier 1: Direct httpx fetch
# ---------------------------------------------------------------------------

def _fetch_html_article_direct(url: str) -> dict:
    headers = {
        "User-Agent": _USER_AGENT,
        "Accept": "text/html,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
    }
    try:
        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            response = client.get(url, headers=headers)
            response.raise_for_status()
    except httpx.HTTPError as e:
        raise FetchError(f"Failed to fetch article: {e}") from e

    return _extract_article_from_html(response.text, url, raw_bytes=response.content)


# ---------------------------------------------------------------------------
# Tier 2: curl_cffi with browser TLS fingerprint
# ---------------------------------------------------------------------------

_BROWSER_HEADERS = {
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;"
        "q=0.9,image/webp,*/*;q=0.8"
    ),
    "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}


def _fetch_with_browser_tls(url: str) -> dict:
    """Fetch using curl_cffi which sends a browser-identical TLS fingerprint.

    Many WAFs (Cloudflare, Akamai) inspect the TLS ClientHello to
    distinguish bots from real browsers.  ``curl_cffi`` impersonates
    Chrome's fingerprint so the request looks identical at the TLS layer.
    """
    try:
        from curl_cffi.requests import Session
    except ImportError:
        raise FetchError(
            "curl_cffi not installed — browser TLS fallback unavailable"
        )

    try:
        with Session(impersonate="chrome") as session:
            response = session.get(
                url,
                headers=_BROWSER_HEADERS,
                timeout=30,
                allow_redirects=True,
            )
            response.raise_for_status()
    except Exception as e:
        raise FetchError(f"Browser TLS fetch failed: {e}") from e

    return _extract_article_from_html(response.text, url, raw_bytes=response.content)


# ---------------------------------------------------------------------------
# Tier 3: Google web cache
# ---------------------------------------------------------------------------

def _fetch_via_google_cache(url: str) -> dict:
    """Fetch article from Google's web cache.

    Useful when the origin server blocks direct access but Google has a
    recent cached copy of the page.
    """
    cache_url = (
        "https://webcache.googleusercontent.com/search"
        f"?q=cache:{quote(url, safe='')}"
    )
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    try:
        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            response = client.get(cache_url, headers=headers)
            response.raise_for_status()
    except httpx.HTTPError as e:
        raise FetchError(f"Google Cache fetch failed: {e}") from e

    html = response.text

    raw_bytes = response.content

    # Google Cache wraps content in its own chrome — strip the header div
    # so our article extractor finds the real <article>/<main> tags.
    soup = BeautifulSoup(html, "html.parser")
    for div in soup.find_all("div", id="google-cache-hdr"):
        div.decompose()
    html = str(soup)

    return _extract_article_from_html(html, url, raw_bytes=raw_bytes)


# ---------------------------------------------------------------------------
# Tier 5: Playwright headless browser (opt-in)
# ---------------------------------------------------------------------------

def _fetch_via_playwright(url: str) -> dict:
    """Fetch article using a real headless browser via Playwright.

    Solves JS challenges (Cloudflare Managed Challenge, etc.) by running
    a full Chromium instance.  Only enabled when the environment variable
    ``FETCHER_ENABLE_PLAYWRIGHT=1`` is set — it is too heavy for
    serverless environments like Vercel.
    """
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
                context = browser.new_context(
                    user_agent=(
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/124.0.0.0 Safari/537.36"
                    ),
                )
                page = context.new_page()
                page.goto(url, wait_until="domcontentloaded", timeout=45_000)
                # Give Cloudflare challenge time to resolve
                page.wait_for_load_state("networkidle", timeout=30_000)
                html = page.content()
            finally:
                browser.close()
    except FetchError:
        raise
    except Exception as e:
        raise FetchError(f"Playwright browser fetch failed: {e}") from e

    return _extract_article_from_html(html, url)


# ---------------------------------------------------------------------------
# Orchestrator: progressive multi-tier fetch
# ---------------------------------------------------------------------------

def _fetch_html_article(url: str) -> dict:
    """Progressive multi-tier HTML article fetch.

    Each tier is tried in order; the first one to return content wins.
    If every tier fails, the error from tier 1 is raised so callers see
    the most relevant diagnostic.

    Tiers:
      1. httpx direct — fast, works for most sites
      2. curl_cffi browser TLS — bypasses TLS-fingerprint-based bot detection
      3. Google Cache — fetches Google's cached copy of the page
      4. Jina Reader — JS-rendering proxy, bypasses many protections
      5. Playwright headless — real browser, solves JS challenges (opt-in)
    """
    tiers: list[tuple[str, callable]] = [
        ("direct (httpx)", _fetch_html_article_direct),
        ("browser TLS (curl_cffi)", _fetch_with_browser_tls),
        ("Google Cache", _fetch_via_google_cache),
        ("Jina Reader", _fetch_via_jina),
        ("Playwright", _fetch_via_playwright),
    ]

    first_error: FetchError | None = None

    for label, fetcher in tiers:
        try:
            return fetcher(url)
        except FetchError as e:
            if first_error is None:
                first_error = e
            logger.info("Tier [%s] failed for %s: %s", label, url, e)

    raise first_error  # type: ignore[misc]


def _is_youtube_url(url: str) -> bool:
    try:
        hostname = (urlparse(url.strip()).hostname or "").lower()
    except Exception:
        return False
    return hostname in {
        "youtube.com", "www.youtube.com", "m.youtube.com",
        "youtu.be", "www.youtu.be",
    }


def _is_twitter_url(url: str) -> bool:
    try:
        parsed = urlparse(url.strip())
        hostname = (parsed.hostname or "").lower()
    except Exception:
        return False
    if hostname not in {
        "twitter.com", "www.twitter.com", "mobile.twitter.com",
        "x.com", "www.x.com",
    }:
        return False
    return bool(re.match(r"^/[^/]+/status/\d+", parsed.path or ""))


def _is_bluesky_url(url: str) -> bool:
    from .bluesky_fetcher import is_bluesky_url
    return is_bluesky_url(url)


def _is_facebook_url(url: str) -> bool:
    from .facebook_fetcher import is_facebook_url
    return is_facebook_url(url)


def _is_cspan_url(url: str) -> bool:
    from .cspan_fetcher import is_cspan_url
    return is_cspan_url(url)


def fetch_article(url: str) -> dict:
    resolved = _resolve_google_news_url(url)
    if resolved:
        url = resolved

    if _is_youtube_url(url):
        from .youtube_fetcher import fetch_youtube_transcript
        return fetch_youtube_transcript(url)
    if _is_twitter_url(url):
        from .twitter_fetcher import fetch_tweet
        return fetch_tweet(url)
    if _is_bluesky_url(url):
        from .bluesky_fetcher import fetch_bluesky_post
        return fetch_bluesky_post(url)
    if _is_facebook_url(url):
        from .facebook_fetcher import fetch_facebook_post
        return fetch_facebook_post(url)
    if _is_cspan_url(url):
        from .cspan_fetcher import fetch_cspan_transcript
        return fetch_cspan_transcript(url)
    if _is_pdf_url(url):
        return _fetch_pdf_article(url)
    return _fetch_html_article(url)
