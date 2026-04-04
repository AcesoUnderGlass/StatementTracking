"""Backfill years of historical articles from RSS feeds.

Two strategies:
  - Google News feeds: inject after:/before: date operators and iterate
    in small time windows.
  - Publication feeds: query the Wayback Machine CDX API for archived
    snapshots of the RSS XML, parse each one, and collect article URLs.

Both strategies funnel results into the existing IngestionClient pipeline.

Usage:
    python -m monitor.archive_backfill --start 2023-01-01 --end 2025-12-31
    python -m monitor.archive_backfill --start 2024-06-01 --feed-name "TechCrunch - AI" --dry-run
    python -m monitor.archive_backfill --start 2023-01-01 --end 2025-12-31 --verbose
"""
from __future__ import annotations

import argparse
import logging
import time
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import feedparser
import httpx

from .client import IngestionClient
from .constants import (
    LOG_DATEFMT,
    LOG_FORMAT,
    MSG_BACKFILL_DONE,
    MSG_BACKFILL_DRY_RUN,
    MSG_BACKFILL_GOOGLE_WINDOW,
    MSG_BACKFILL_SKIPPING_FEED,
    MSG_BACKFILL_START,
    MSG_BACKFILL_SUBMITTING,
    MSG_BACKFILL_TOTAL_ENTRIES,
    MSG_BACKFILL_WAYBACK_PARSING,
    MSG_BACKFILL_WAYBACK_SNAPSHOT_ENTRIES,
    MSG_BACKFILL_WAYBACK_SNAPSHOTS,
    SOURCE_TYPE_GOVERNMENT_RSS,
)
from .keywords import is_relevant
from .rss_poller import load_feeds, _resolve_feeds_path

logger = logging.getLogger(__name__)

_GOOGLE_NEWS_HOST = "news.google.com"
_WAYBACK_CDX_URL = "https://web.archive.org/cdx/search/cdx"
_WAYBACK_RAW_PREFIX = "https://web.archive.org/web/{ts}id_/{url}"

_GOOGLE_NEWS_DELAY = 2.0
_WAYBACK_DELAY = 1.0

_MAX_RETRIES = 3
_RETRY_BACKOFF = [5.0, 15.0, 30.0]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _http_get_with_retry(url: str, **kwargs) -> httpx.Response:
    """GET with exponential backoff retries for transient connection errors."""
    last_exc: Exception | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            with httpx.Client(timeout=60.0) as client:
                resp = client.get(url, **kwargs)
                resp.raise_for_status()
                return resp
        except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
            last_exc = exc
            delay = _RETRY_BACKOFF[min(attempt, len(_RETRY_BACKOFF) - 1)]
            logger.warning(
                "Connection error (attempt %d/%d), retrying in %.0fs: %s",
                attempt + 1, _MAX_RETRIES, delay, exc,
            )
            time.sleep(delay)
    raise last_exc  # type: ignore[misc]


def is_google_news_feed(url: str) -> bool:
    hostname = (urlparse(url).hostname or "").lower()
    return hostname == _GOOGLE_NEWS_HOST


def _build_google_news_window_url(
    base_url: str,
    window_start: date,
    window_end: date,
) -> str:
    """Inject after:/before: date operators into a Google News RSS search URL."""
    parsed = urlparse(base_url)
    params = parse_qs(parsed.query, keep_blank_values=True)

    q_parts = params.get("q", [""])[0]
    # Strip any existing after:/before: operators
    tokens = q_parts.split()
    tokens = [t for t in tokens if not t.startswith(("after:", "before:"))]
    tokens.append(f"after:{window_start.isoformat()}")
    tokens.append(f"before:{window_end.isoformat()}")
    params["q"] = [" ".join(tokens)]

    new_query = urlencode(params, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


# ---------------------------------------------------------------------------
# Strategy 1: Google News date-window iteration
# ---------------------------------------------------------------------------

def backfill_google_news_feed(
    feed_url: str,
    start: date,
    end: date,
    window_days: int = 7,
) -> list[tuple[str, str, str]]:
    """Iterate over date windows and collect all entries from a Google News RSS feed.

    Returns list of (url, title, description) with duplicates removed.
    """
    seen_urls: set[str] = set()
    results: list[tuple[str, str, str]] = []
    cursor = start

    while cursor < end:
        window_end = min(cursor + timedelta(days=window_days), end)
        windowed_url = _build_google_news_window_url(feed_url, cursor, window_end)

        parsed = feedparser.parse(windowed_url)
        count = 0

        for entry in parsed.entries:
            link = entry.get("link", "")
            if not link or link in seen_urls:
                continue
            seen_urls.add(link)
            title = entry.get("title", "")
            desc = entry.get("summary", "") or entry.get("description", "")
            results.append((link, title, desc))
            count += 1

        logger.info(
            MSG_BACKFILL_GOOGLE_WINDOW,
            cursor.isoformat(),
            window_end.isoformat(),
            count,
        )

        cursor = window_end
        time.sleep(_GOOGLE_NEWS_DELAY)

    return results


# ---------------------------------------------------------------------------
# Strategy 2: Wayback Machine CDX API
# ---------------------------------------------------------------------------

def _fetch_wayback_snapshots(
    feed_url: str,
    start: date,
    end: date,
) -> list[str]:
    """Query the Wayback CDX API and return a list of snapshot timestamps."""
    params = {
        "url": feed_url,
        "output": "json",
        "fl": "timestamp,statuscode",
        "filter": "statuscode:200",
        "from": start.strftime("%Y%m%d"),
        "to": end.strftime("%Y%m%d"),
    }
    resp = _http_get_with_retry(_WAYBACK_CDX_URL, params=params)
    rows = resp.json()

    if not rows or len(rows) < 2:
        return []

    # First row is the header: ["timestamp", "statuscode"]
    return [row[0] for row in rows[1:]]


def _sample_timestamps(
    timestamps: list[str],
    interval_days: int,
) -> list[str]:
    """Down-sample snapshots to at most one per interval_days period."""
    if not timestamps or interval_days <= 0:
        return timestamps

    sampled: list[str] = []
    last_date: date | None = None

    for ts in sorted(timestamps):
        try:
            snap_date = date(int(ts[:4]), int(ts[4:6]), int(ts[6:8]))
        except (ValueError, IndexError):
            continue
        if last_date is None or (snap_date - last_date).days >= interval_days:
            sampled.append(ts)
            last_date = snap_date

    return sampled


def backfill_wayback_feed(
    feed_url: str,
    start: date,
    end: date,
    sample_interval_days: int = 3,
) -> list[tuple[str, str, str]]:
    """Fetch archived RSS snapshots from the Wayback Machine and collect entries.

    Returns list of (url, title, description) with duplicates removed.
    """
    all_timestamps = _fetch_wayback_snapshots(feed_url, start, end)
    logger.info(MSG_BACKFILL_WAYBACK_SNAPSHOTS, len(all_timestamps), feed_url)

    timestamps = _sample_timestamps(all_timestamps, sample_interval_days)

    seen_urls: set[str] = set()
    results: list[tuple[str, str, str]] = []

    for i, ts in enumerate(timestamps):
        logger.info(MSG_BACKFILL_WAYBACK_PARSING, i + 1, len(timestamps), ts)

        archive_url = _WAYBACK_RAW_PREFIX.format(ts=ts, url=feed_url)
        parsed = feedparser.parse(archive_url)
        count = 0

        for entry in parsed.entries:
            link = entry.get("link", "")
            if not link or link in seen_urls:
                continue
            seen_urls.add(link)
            title = entry.get("title", "")
            desc = entry.get("summary", "") or entry.get("description", "")
            results.append((link, title, desc))
            count += 1

        logger.info(MSG_BACKFILL_WAYBACK_SNAPSHOT_ENTRIES, count)
        time.sleep(_WAYBACK_DELAY)

    return results


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill historical articles from RSS feed archives",
    )
    parser.add_argument(
        "--start",
        type=date.fromisoformat,
        required=True,
        help="Start date (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--end",
        type=date.fromisoformat,
        default=date.today(),
        help="End date (YYYY-MM-DD, default: today)",
    )
    parser.add_argument(
        "--feeds",
        type=Path,
        default=None,
        help="Path to feeds YAML config (default: monitor/feeds.yaml)",
    )
    parser.add_argument(
        "--feed-name",
        type=str,
        default=None,
        help="Only backfill a single feed matching this name",
    )
    parser.add_argument(
        "--window-days",
        type=int,
        default=7,
        help="Google News window size in days (default: 7)",
    )
    parser.add_argument(
        "--wayback-sample-interval",
        type=int,
        default=3,
        help="Minimum days between Wayback snapshots to parse (default: 3)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Discover URLs without submitting to the API",
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

    feeds_path = args.feeds or _resolve_feeds_path()
    feeds = load_feeds(feeds_path)

    total_discovered = 0
    total_submitted = 0
    feeds_processed = 0

    for feed in feeds:
        feed_url = feed["url"]
        feed_name = feed.get("name", feed_url)
        source_type = feed.get("source_type", "rss_feed")

        if args.feed_name and feed_name != args.feed_name:
            logger.debug(MSG_BACKFILL_SKIPPING_FEED, feed_name)
            continue

        logger.info(MSG_BACKFILL_START, feed_name, args.start, args.end)

        try:
            if is_google_news_feed(feed_url):
                entries = backfill_google_news_feed(
                    feed_url, args.start, args.end, args.window_days,
                )
            else:
                entries = backfill_wayback_feed(
                    feed_url, args.start, args.end, args.wayback_sample_interval,
                )
        except Exception:
            logger.exception("Failed to backfill %s, skipping", feed_name)
            continue

        # Apply keyword filter for non-government feeds
        if source_type != SOURCE_TYPE_GOVERNMENT_RSS:
            entries = [
                (url, title, desc)
                for url, title, desc in entries
                if is_relevant(title, desc)
            ]

        logger.info(MSG_BACKFILL_TOTAL_ENTRIES, len(entries), feed_name)
        total_discovered += len(entries)
        feeds_processed += 1

        if not entries:
            continue

        urls = [url for url, _, _ in entries]

        if args.dry_run:
            logger.info(MSG_BACKFILL_DRY_RUN, len(urls), feed_name)
            for url, title, _ in entries:
                logger.info("  %s — %s", title[:80] if title else "(no title)", url)
            continue

        logger.info(MSG_BACKFILL_SUBMITTING, len(urls), feed_name)
        with IngestionClient() as client:
            results = client.ingest_batch(urls, source_type, feed_name)
            total_submitted += sum(1 for r in results if r.status != "error")

    logger.info(MSG_BACKFILL_DONE, total_discovered, feeds_processed, total_submitted)


if __name__ == "__main__":
    main()
