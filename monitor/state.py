"""Local SQLite state tracker for seen URLs and feed poll times.

Prevents re-processing URLs across cron runs, avoiding wasted
LLM extraction calls on already-queued articles. Also tracks
per-feed last-poll timestamps for RSS polling.
"""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from .config import load_config


def _get_db_path() -> str:
    cfg = load_config()
    return cfg.state_db_path


def _ensure_db(db_path: str) -> sqlite3.Connection:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS seen_urls (
            url            TEXT PRIMARY KEY,
            source         TEXT NOT NULL,
            first_seen_at  TEXT NOT NULL,
            submitted      INTEGER NOT NULL DEFAULT 0,
            submit_result  TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS feed_polls (
            feed_url       TEXT PRIMARY KEY,
            last_polled_at TEXT NOT NULL
        )
    """)
    conn.commit()
    return conn


class StateTracker:
    """Track which URLs have been seen and submitted."""

    def __init__(self, db_path: str | None = None):
        self._db_path = db_path or _get_db_path()
        self._conn = _ensure_db(self._db_path)

    def is_seen(self, url: str) -> bool:
        row = self._conn.execute(
            "SELECT 1 FROM seen_urls WHERE url = ?", (url,)
        ).fetchone()
        return row is not None

    def mark_seen(self, url: str, source: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        self._conn.execute(
            """INSERT OR IGNORE INTO seen_urls (url, source, first_seen_at)
               VALUES (?, ?, ?)""",
            (url, source, now),
        )
        self._conn.commit()

    def mark_submitted(self, url: str, result: str) -> None:
        self._conn.execute(
            "UPDATE seen_urls SET submitted = 1, submit_result = ? WHERE url = ?",
            (result, url),
        )
        self._conn.commit()

    def get_unseen(self, urls: list[str]) -> list[str]:
        """Filter a list of URLs to only those not yet seen."""
        if not urls:
            return []
        placeholders = ",".join("?" for _ in urls)
        rows = self._conn.execute(
            f"SELECT url FROM seen_urls WHERE url IN ({placeholders})",
            urls,
        ).fetchall()
        seen = {r[0] for r in rows}
        return [u for u in urls if u not in seen]

    def get_last_poll(self, feed_url: str) -> datetime | None:
        """Return the last poll timestamp for a feed, or None if never polled."""
        row = self._conn.execute(
            "SELECT last_polled_at FROM feed_polls WHERE feed_url = ?",
            (feed_url,),
        ).fetchone()
        if row is None:
            return None
        return datetime.fromisoformat(row[0])

    def set_last_poll(self, feed_url: str, poll_time: datetime) -> None:
        """Record when a feed was last polled."""
        self._conn.execute(
            """INSERT INTO feed_polls (feed_url, last_polled_at)
               VALUES (?, ?)
               ON CONFLICT(feed_url) DO UPDATE SET last_polled_at = excluded.last_polled_at""",
            (feed_url, poll_time.isoformat()),
        )
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
