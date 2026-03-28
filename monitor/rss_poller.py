"""Poll RSS feeds for AI-policy articles and submit them for quote extraction.

Usage:
    python -m monitor.rss_poller
    python -m monitor.rss_poller --dry-run --verbose
    python -m monitor.rss_poller --feeds /path/to/feeds.yaml
"""
from __future__ import annotations

import argparse
import logging
import os
import time
from calendar import timegm
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import NamedTuple

import feedparser
import yaml

from .client import IngestionClient
from .constants import (
    ENV_MONITOR_FEEDS_FILE,
    LOG_DATEFMT,
    LOG_FORMAT,
    MSG_DONE_SUBMITTED,
    MSG_DRY_RUN_WOULD_SUBMIT,
    MSG_FEED_ERROR,
    MSG_FOUND_CANDIDATES_TOTAL,
    MSG_LOADED_FEEDS,
    MSG_NEW_ENTRIES_FROM_FEED,
    MSG_NO_FEEDS_IN_FILE,
    MSG_NO_RELEVANT_ARTICLES,
    MSG_PASSED_KEYWORD_FILTER,
    MSG_POLLING_FEED,
    MSG_SKIP_CUTOFF_ON_ERROR,
    MSG_SUBMIT_RESULT,
    MSG_SUBMITTING,
    SOURCE_TYPE_GOVERNMENT_RSS,
    SOURCE_TYPE_RSS_FEED,
)
from .keywords import is_relevant
from .state import StateTracker

logger = logging.getLogger(__name__)

_DEFAULT_FEEDS_FILE = Path(__file__).parent / "feeds.yaml"
_FIRST_RUN_LOOKBACK = timedelta(hours=24)


class Candidate(NamedTuple):
    url: str
    title: str
    source_type: str
    feed_name: str


def _resolve_feeds_path() -> Path:
    env = os.environ.get(ENV_MONITOR_FEEDS_FILE)
    if env:
        return Path(env)
    return _DEFAULT_FEEDS_FILE


def load_feeds(path: Path) -> list[dict]:
    with open(path) as f:
        data = yaml.safe_load(f) or {}
    feeds = data.get("feeds", [])
    if not feeds:
        raise SystemExit(MSG_NO_FEEDS_IN_FILE.format(path=path))
    return feeds


def _entry_published(entry) -> datetime | None:
    """Extract a UTC datetime from a feedparser entry."""
    for attr in ("published_parsed", "updated_parsed"):
        tp = getattr(entry, attr, None)
        if tp is not None:
            return datetime.fromtimestamp(timegm(tp), tz=timezone.utc)
    return None


def poll_feed(
    feed_url: str,
    cutoff: datetime,
) -> list[tuple[str, str, str]]:
    """Parse a feed and return entries newer than cutoff.

    Returns list of (url, title, description).
    """
    parsed = feedparser.parse(feed_url)

    if parsed.bozo and not parsed.entries:
        logger.warning(MSG_FEED_ERROR, feed_url, parsed.bozo_exception)
        return []

    results: list[tuple[str, str, str]] = []
    for entry in parsed.entries:
        pub = _entry_published(entry)
        if pub is not None and pub <= cutoff:
            continue

        link = entry.get("link", "")
        if not link:
            continue

        title = entry.get("title", "")
        desc = entry.get("summary", "") or entry.get("description", "")
        results.append((link, title, desc))

    return results


def collect_candidates(
    feeds: list[dict],
    state: StateTracker,
    now: datetime,
) -> tuple[list[Candidate], list[str]]:
    """Poll all feeds and return keyword-relevant candidates.

    Returns (candidates, polled_feed_urls). The caller is responsible
    for updating last-poll timestamps via state.set_last_poll() --
    this keeps dry-run mode from advancing the watermark.
    """
    candidates: list[Candidate] = []
    polled_feed_urls: list[str] = []

    for feed in feeds:
        feed_url = feed["url"]
        feed_name = feed.get("name", feed_url)
        source_type = feed.get("source_type", SOURCE_TYPE_RSS_FEED)

        last_poll = state.get_last_poll(feed_url)
        cutoff = last_poll if last_poll else (now - _FIRST_RUN_LOOKBACK)

        logger.info(
            MSG_POLLING_FEED,
            feed_name,
            cutoff.strftime("%Y-%m-%d %H:%M UTC"),
        )

        entries = poll_feed(feed_url, cutoff)
        logger.info(MSG_NEW_ENTRIES_FROM_FEED, len(entries))

        relevant = 0
        for url, title, desc in entries:
            if source_type == SOURCE_TYPE_GOVERNMENT_RSS or is_relevant(title, desc):
                candidates.append(Candidate(url, title, source_type, feed_name))
                relevant += 1

        logger.info(MSG_PASSED_KEYWORD_FILTER, relevant)
        polled_feed_urls.append(feed_url)

    return candidates, polled_feed_urls


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Poll RSS feeds for AI-policy articles",
    )
    parser.add_argument(
        "--feeds",
        type=Path,
        default=None,
        help="Path to feeds YAML config (default: monitor/feeds.yaml)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Log candidates without submitting to the API",
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
    logger.info(MSG_LOADED_FEEDS, len(feeds), feeds_path)

    now = datetime.now(timezone.utc)

    with StateTracker() as state:
        candidates, polled_feed_urls = collect_candidates(feeds, state, now)

    if not candidates:
        logger.info(MSG_NO_RELEVANT_ARTICLES)
        return

    logger.info(MSG_FOUND_CANDIDATES_TOTAL, len(candidates))

    if args.dry_run:
        for c in candidates:
            logger.info(MSG_DRY_RUN_WOULD_SUBMIT, c.title, c.url, c.feed_name)
        return

    name_to_url = {feed.get("name", feed["url"]): feed["url"] for feed in feeds}

    with IngestionClient() as client, StateTracker() as state:
        by_source: dict[str, list[Candidate]] = {}
        for c in candidates:
            by_source.setdefault(c.source_type, []).append(c)

        total_submitted = 0
        total_saved = 0
        failed_feed_urls: set[str] = set()

        for source_type, group in by_source.items():
            detail_map = {c.url: c.feed_name for c in group}

            for c in group:
                logger.info(MSG_SUBMITTING, c.title[:80], c.feed_name)
                result = client.submit_url(c.url, source_type, detail_map[c.url])
                total_submitted += 1
                total_saved += result.saved_count

                state.mark_seen(c.url, source_type)
                state.mark_submitted(c.url, result.status)

                if result.error:
                    failed_feed_urls.add(name_to_url.get(c.feed_name, c.feed_name))

                logger.info(
                    MSG_SUBMIT_RESULT,
                    result.status,
                    result.extracted_count,
                    result.saved_count,
                    f", error={result.error}" if result.error else "",
                )

                if total_submitted < len(candidates):
                    time.sleep(client.config.submission_delay_seconds)

        for feed_url in polled_feed_urls:
            if feed_url not in failed_feed_urls:
                state.set_last_poll(feed_url, now)
            else:
                logger.warning(MSG_SKIP_CUTOFF_ON_ERROR, feed_url)

    logger.info(MSG_DONE_SUBMITTED, total_submitted, total_saved)


if __name__ == "__main__":
    main()
