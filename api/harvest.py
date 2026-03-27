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
from monitor.rss_poller import collect_candidates, load_feeds, _resolve_feeds_path
from monitor.state import StateTracker

logger = logging.getLogger(__name__)


def _verify_cron_secret(auth_header: str | None) -> bool:
    secret = os.environ.get("CRON_SECRET")
    if not secret:
        return True
    if not auth_header:
        return False
    return auth_header == f"Bearer {secret}"


def _build_api_base_url() -> str:
    explicit = os.environ.get("MONITOR_API_BASE_URL")
    if explicit:
        return explicit
    vercel_url = os.environ.get("VERCEL_URL")
    if vercel_url:
        return f"https://{vercel_url}"
    return "http://localhost:8000"


def run_harvest() -> dict:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    feeds_path = _resolve_feeds_path()
    feeds = load_feeds(feeds_path)
    logger.info("Loaded %d feeds from %s", len(feeds), feeds_path)

    now = datetime.now(timezone.utc)

    # Ephemeral SQLite in /tmp — fine because API-side dedup prevents reprocessing
    state_db = "/tmp/monitor-state.db"

    with StateTracker(db_path=state_db) as state:
        candidates, polled_feed_urls = collect_candidates(feeds, state, now)

    if not candidates:
        logger.info("No relevant articles found across all feeds")
        return {
            "status": "ok",
            "feeds_polled": len(feeds),
            "candidates": 0,
            "submitted": 0,
            "saved": 0,
            "timestamp": now.isoformat(),
        }

    logger.info("Found %d candidate articles total", len(candidates))

    config = MonitorConfig(
        api_base_url=_build_api_base_url(),
        state_db_path=state_db,
    )

    total_submitted = 0
    total_saved = 0
    errors: list[dict] = []

    with IngestionClient(config=config) as client, StateTracker(db_path=state_db) as state:
        for feed_url in polled_feed_urls:
            state.set_last_poll(feed_url, now)

        for c in candidates:
            logger.info("Submitting: %s [%s]", c.title[:80], c.feed_name)
            result = client.submit_url(c.url, c.source_type, c.feed_name)
            total_submitted += 1
            total_saved += result.saved_count

            state.mark_seen(c.url, c.source_type)
            state.mark_submitted(c.url, result.status)

            if result.error:
                errors.append({"url": c.url, "error": result.error})

            logger.info(
                "  -> %s (extracted=%d, saved=%d%s)",
                result.status,
                result.extracted_count,
                result.saved_count,
                f", error={result.error}" if result.error else "",
            )

            if total_submitted < len(candidates):
                time.sleep(config.submission_delay_seconds)

    summary = {
        "status": "ok",
        "feeds_polled": len(feeds),
        "candidates": len(candidates),
        "submitted": total_submitted,
        "saved": total_saved,
        "timestamp": now.isoformat(),
    }
    if errors:
        summary["errors"] = errors

    return summary


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        auth = self.headers.get("Authorization")
        if not _verify_cron_secret(auth):
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Unauthorized"}).encode())
            return

        try:
            result = run_harvest()
            status = 200 if result.get("status") == "ok" else 500
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
        except Exception as e:
            logger.exception("Harvest failed")
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "error",
                "error": str(e),
            }).encode())

    def log_message(self, format, *args):
        logger.info(format, *args)
