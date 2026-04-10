"""Scan Google News for AI capabilities statements from tech executives.

Searches for recent statements from executives at Anthropic, OpenAI,
xAI, Meta/Facebook, Microsoft, and Google/DeepMind. Iterates over
date windows to cover the full range (default 2020-01-01 to today),
then submits discovered articles through the auto-ingest pipeline.

Usage:
    python -m monitor.scan_exec_capabilities --dry-run
    python -m monitor.scan_exec_capabilities --start 2024-01-01
    python -m monitor.scan_exec_capabilities --start 2020-01-01 --end 2025-12-31
    python -m monitor.scan_exec_capabilities --max-submissions 50
"""
from __future__ import annotations

import argparse
import logging
import time
from datetime import date, timedelta
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import feedparser

from .client import IngestionClient
from .constants import LOG_DATEFMT, LOG_FORMAT
from .normalize import resolve_google_news_url

logger = logging.getLogger(__name__)

_GOOGLE_NEWS_RSS_BASE = (
    "https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en"
)

EXEC_FEEDS: list[dict[str, str]] = [
    {
        "name": "Anthropic",
        "query": '"Dario Amodei" OR "Daniela Amodei" OR "Anthropic" AI',
    },
    {
        "name": "OpenAI",
        "query": '"Sam Altman" OR "OpenAI" AI',
    },
    {
        "name": "xAI / Grok",
        "query": '"Elon Musk" OR "xAI" OR "Grok AI"',
    },
    {
        "name": "Meta / Facebook",
        "query": '"Mark Zuckerberg" OR "Yann LeCun" OR "Meta AI" OR "Facebook AI" AI',
    },
    {
        "name": "Microsoft",
        "query": '"Satya Nadella" OR "Microsoft AI" OR "Copilot AI"',
    },
    {
        "name": "Google / DeepMind",
        "query": (
            '"Sundar Pichai" OR "DeepMind" OR "Demis Hassabis" '
            'OR "Google AI" OR "Gemini AI"'
        ),
    },
]

_WINDOW_DAYS = 7
_WINDOW_DELAY = 2.0
_DEFAULT_START = date(2020, 1, 1)
_DEFAULT_MAX_SUBMISSIONS = 200


def _build_feed_url(query: str) -> str:
    return f"{_GOOGLE_NEWS_RSS_BASE}&q={_url_encode_query(query)}"


def _url_encode_query(query: str) -> str:
    from urllib.parse import quote
    return quote(query, safe="")


def _build_window_url(base_url: str, start: date, end: date) -> str:
    parsed = urlparse(base_url)
    params = parse_qs(parsed.query, keep_blank_values=True)

    q_parts = params.get("q", [""])[0]
    tokens = q_parts.split()
    tokens = [t for t in tokens if not t.startswith(("after:", "before:"))]
    tokens.append(f"after:{start.isoformat()}")
    tokens.append(f"before:{end.isoformat()}")
    params["q"] = [" ".join(tokens)]

    new_query = urlencode(params, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


def _scan_feed(
    feed_name: str,
    query: str,
    start: date,
    end: date,
) -> list[tuple[str, str]]:
    """Iterate over date windows newest-first and collect (url, title) pairs.

    Walking backwards from *end* ensures the most recent articles appear
    first in the result list, so the submission cap prioritises fresh content.
    """
    base_url = _build_feed_url(query)
    seen: set[str] = set()
    results: list[tuple[str, str]] = []
    cursor = end

    while cursor > start:
        window_start = max(cursor - timedelta(days=_WINDOW_DAYS), start)
        windowed_url = _build_window_url(base_url, window_start, cursor)

        parsed = feedparser.parse(windowed_url)
        count = 0

        for entry in parsed.entries:
            link = entry.get("link", "")
            if not link or link in seen:
                continue
            seen.add(link)
            title = entry.get("title", "")
            results.append((link, title))
            count += 1

        if count > 0:
            logger.info(
                "[%s] %s to %s: %d new articles",
                feed_name,
                window_start.isoformat(),
                cursor.isoformat(),
                count,
            )

        cursor = window_start
        time.sleep(_WINDOW_DELAY)

    return results


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scan for AI capabilities statements from tech executives",
    )
    parser.add_argument(
        "--start",
        type=date.fromisoformat,
        default=_DEFAULT_START,
        help="Start date (YYYY-MM-DD, default: 2020-01-01)",
    )
    parser.add_argument(
        "--end",
        type=date.fromisoformat,
        default=date.today(),
        help="End date (YYYY-MM-DD, default: today)",
    )
    parser.add_argument(
        "--max-submissions",
        type=int,
        default=_DEFAULT_MAX_SUBMISSIONS,
        help=f"Max articles to submit for ingestion (default: {_DEFAULT_MAX_SUBMISSIONS})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Discover articles without submitting to the API",
    )
    parser.add_argument(
        "--company",
        type=str,
        default=None,
        help="Only scan a single company (e.g. 'Anthropic', 'OpenAI')",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable debug logging",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format=LOG_FORMAT,
        datefmt=LOG_DATEFMT,
    )

    feeds = EXEC_FEEDS
    if args.company:
        feeds = [
            f for f in feeds
            if args.company.lower() in f["name"].lower()
        ]
        if not feeds:
            logger.error("No feed matching company '%s'", args.company)
            raise SystemExit(1)

    logger.info(
        "Scanning %d companies from %s to %s",
        len(feeds),
        args.start.isoformat(),
        args.end.isoformat(),
    )

    all_articles: list[tuple[str, str, str]] = []  # (url, title, feed_name)

    for feed in feeds:
        feed_name = feed["name"]
        logger.info("--- Scanning: %s ---", feed_name)
        articles = _scan_feed(feed_name, feed["query"], args.start, args.end)
        logger.info("[%s] Total discovered: %d articles", feed_name, len(articles))
        for url, title in articles:
            all_articles.append((url, title, feed_name))

    logger.info("=== Total across all companies: %d articles ===", len(all_articles))

    if not all_articles:
        logger.info("No articles found.")
        return

    if args.dry_run:
        for url, title, feed_name in all_articles:
            logger.info(
                "  [%s] %s\n         %s",
                feed_name,
                title[:100] if title else "(no title)",
                url,
            )
        logger.info("Dry run complete. %d articles found.", len(all_articles))
        return

    cap = args.max_submissions

    if len(all_articles) > cap:
        logger.info(
            "Capping to %d candidates (found %d articles)", cap, len(all_articles),
        )
        all_articles = all_articles[:cap]

    # Resolve Google News wrapper URLs to real article URLs (after capping)
    logger.info("Resolving %d Google News URLs...", len(all_articles))
    resolved: list[tuple[str, str, str]] = []
    for url, title, feed_name in all_articles:
        real = resolve_google_news_url(url)
        if real:
            logger.debug("Resolved: %s", real)
        resolved.append((real or url, title, feed_name))
    all_articles = resolved
    logger.info("URL resolution complete.")

    with IngestionClient() as client:
        all_urls = [url for url, _, _ in all_articles]
        existing: set[str] = set()
        for i in range(0, len(all_urls), 100):
            chunk = all_urls[i : i + 100]
            existing.update(client.check_urls(chunk))

        new_articles = [(u, t, f) for u, t, f in all_articles if u not in existing]
        logger.info(
            "%d already in DB, %d new to submit",
            len(all_articles) - len(new_articles),
            len(new_articles),
        )

        if not new_articles:
            logger.info("Nothing new to submit.")
            return

        total_submitted = 0
        total_saved = 0
        total_errors = 0

        for i, (url, title, feed_name) in enumerate(new_articles):
            detail = f"exec-scan: {feed_name}"
            logger.info(
                "[%d/%d] Submitting: %s",
                i + 1,
                len(new_articles),
                title[:80] if title else url,
            )
            result = client.submit_url(url, "rss_feed", detail)
            total_submitted += 1

            if result.status == "error":
                total_errors += 1
                logger.warning("  -> ERROR: %s", result.error)
            else:
                total_saved += result.saved_count
                logger.info(
                    "  -> %s (extracted=%d, saved=%d)",
                    result.status,
                    result.extracted_count,
                    result.saved_count,
                )

            if i < len(new_articles) - 1:
                time.sleep(client.config.submission_delay_seconds)

    logger.info(
        "=== Done: %d submitted, %d quotes saved, %d errors ===",
        total_submitted,
        total_saved,
        total_errors,
    )


if __name__ == "__main__":
    main()
