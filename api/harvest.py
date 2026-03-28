"""Vercel serverless function: poll RSS feeds and submit new articles.

Triggered by Vercel Cron (every 30 minutes) or manual GET request.
Requires CRON_SECRET env var for authorization when set.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from monitor.client import IngestionClient
from monitor.config import MonitorConfig
from monitor.constants import (
    AUTH_BEARER_PREFIX,
    DEFAULT_LOCAL_API_BASE_URL,
    ENV_CRON_SECRET,
    ENV_MONITOR_API_BASE_URL,
    ENV_VERCEL_URL,
    HARVEST_STATE_DB_PATH,
    HTTP_HEADER_AUTHORIZATION,
    HTTP_HEADER_CONTENT_TYPE,
    MEDIA_TYPE_JSON,
    JSON_KEY_ERROR,
    JSON_KEY_STATUS,
    JSON_VALUE_ERROR,
    JSON_VALUE_OK,
    LOG_DATEFMT,
    LOG_FORMAT,
    MSG_FOUND_CANDIDATES_TOTAL,
    MSG_HTTP_UNAUTHORIZED,
    MSG_LOADED_FEEDS,
    MSG_NO_RELEVANT_ARTICLES,
    MSG_SKIP_CUTOFF_ON_ERROR,
    MSG_SUBMIT_RESULT,
    MSG_SUBMITTING,
    SUMMARY_KEY_CANDIDATES,
    SUMMARY_KEY_ERRORS,
    SUMMARY_KEY_FEEDS_POLLED,
    SUMMARY_KEY_SAVED,
    SUMMARY_KEY_SUBMITTED,
    SUMMARY_KEY_TIMESTAMP,
)
from monitor.rss_poller import collect_candidates, load_feeds, _resolve_feeds_path
from monitor.state import StateTracker

logger = logging.getLogger(__name__)


def _verify_cron_secret(auth_header: str | None) -> bool:
    secret = os.environ.get(ENV_CRON_SECRET)
    if not secret:
        return True
    if not auth_header:
        return False
    return auth_header == f"{AUTH_BEARER_PREFIX}{secret}"


def _build_api_base_url() -> str:
    explicit = os.environ.get(ENV_MONITOR_API_BASE_URL)
    if explicit:
        return explicit
    vercel_url = os.environ.get(ENV_VERCEL_URL)
    if vercel_url:
        return f"https://{vercel_url}"
    return DEFAULT_LOCAL_API_BASE_URL


def run_harvest() -> dict:
    logging.basicConfig(
        level=logging.INFO,
        format=LOG_FORMAT,
        datefmt=LOG_DATEFMT,
    )

    feeds_path = _resolve_feeds_path()
    feeds = load_feeds(feeds_path)
    logger.info(MSG_LOADED_FEEDS, len(feeds), feeds_path)

    now = datetime.now(timezone.utc)

    # Ephemeral SQLite in /tmp — fine because API-side dedup prevents reprocessing
    state_db = HARVEST_STATE_DB_PATH

    with StateTracker(db_path=state_db) as state:
        candidates, polled_feed_urls = collect_candidates(feeds, state, now)

    if not candidates:
        logger.info(MSG_NO_RELEVANT_ARTICLES)
        return {
            JSON_KEY_STATUS: JSON_VALUE_OK,
            SUMMARY_KEY_FEEDS_POLLED: len(feeds),
            SUMMARY_KEY_CANDIDATES: 0,
            SUMMARY_KEY_SUBMITTED: 0,
            SUMMARY_KEY_SAVED: 0,
            SUMMARY_KEY_TIMESTAMP: now.isoformat(),
        }

    logger.info(MSG_FOUND_CANDIDATES_TOTAL, len(candidates))

    config = MonitorConfig(
        api_base_url=_build_api_base_url(),
        state_db_path=state_db,
    )

    total_submitted = 0
    total_saved = 0
    errors: list[dict] = []

    name_to_url = {feed.get("name", feed["url"]): feed["url"] for feed in feeds}

    with IngestionClient(config=config) as client, StateTracker(db_path=state_db) as state:
        failed_feed_urls: set[str] = set()

        for c in candidates:
            logger.info(MSG_SUBMITTING, c.title[:80], c.feed_name)
            result = client.submit_url(c.url, c.source_type, c.feed_name)
            total_submitted += 1
            total_saved += result.saved_count

            state.mark_seen(c.url, c.source_type)
            state.mark_submitted(c.url, result.status)

            if result.error:
                errors.append({"url": c.url, "error": result.error})
                failed_feed_urls.add(name_to_url.get(c.feed_name, c.feed_name))

            logger.info(
                MSG_SUBMIT_RESULT,
                result.status,
                result.extracted_count,
                result.saved_count,
                f", error={result.error}" if result.error else "",
            )

            if total_submitted < len(candidates):
                time.sleep(config.submission_delay_seconds)

        for feed_url in polled_feed_urls:
            if feed_url not in failed_feed_urls:
                state.set_last_poll(feed_url, now)
            else:
                logger.warning(MSG_SKIP_CUTOFF_ON_ERROR, feed_url)

    summary = {
        JSON_KEY_STATUS: JSON_VALUE_OK,
        SUMMARY_KEY_FEEDS_POLLED: len(feeds),
        SUMMARY_KEY_CANDIDATES: len(candidates),
        SUMMARY_KEY_SUBMITTED: total_submitted,
        SUMMARY_KEY_SAVED: total_saved,
        SUMMARY_KEY_TIMESTAMP: now.isoformat(),
    }
    if errors:
        summary[SUMMARY_KEY_ERRORS] = errors

    return summary


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        auth = self.headers.get(HTTP_HEADER_AUTHORIZATION)
        if not _verify_cron_secret(auth):
            self.send_response(401)
            self.send_header(HTTP_HEADER_CONTENT_TYPE, MEDIA_TYPE_JSON)
            self.end_headers()
            self.wfile.write(
                json.dumps({JSON_KEY_ERROR: MSG_HTTP_UNAUTHORIZED}).encode()
            )
            return

        try:
            result = run_harvest()
            status = 200 if result.get(JSON_KEY_STATUS) == JSON_VALUE_OK else 500
            self.send_response(status)
            self.send_header(HTTP_HEADER_CONTENT_TYPE, MEDIA_TYPE_JSON)
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
        except Exception as e:
            logger.exception("Harvest failed")
            self.send_response(500)
            self.send_header(HTTP_HEADER_CONTENT_TYPE, MEDIA_TYPE_JSON)
            self.end_headers()
            self.wfile.write(
                json.dumps({
                    JSON_KEY_STATUS: JSON_VALUE_ERROR,
                    JSON_KEY_ERROR: str(e),
                }).encode()
            )

    def log_message(self, format, *args):
        logger.info(format, *args)
