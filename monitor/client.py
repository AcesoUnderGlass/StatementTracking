"""Shared ingestion client for all monitor scripts.

Wraps the StatementTracking API endpoints that monitors need:
check-urls, auto-ingest. Handles deduplication, rate limiting,
and error handling so individual monitors stay thin.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import httpx

from .config import MonitorConfig, load_config
from .normalize import normalize_url, resolve_google_news_url
from .state import StateTracker

logger = logging.getLogger(__name__)


@dataclass
class IngestResult:
    url: str
    status: str  # "pending", "skipped", "error"
    saved_count: int = 0
    extracted_count: int = 0
    error: str | None = None


class IngestionClient:
    """API client for submitting URLs to the StatementTracking app."""

    def __init__(self, config: MonitorConfig | None = None):
        self.config = config or load_config()
        self._client = httpx.Client(
            base_url=self.config.api_base_url,
            timeout=120.0,
        )

    def check_urls(self, urls: list[str]) -> list[str]:
        """Return the subset of URLs that already exist in the DB."""
        if not urls:
            return []
        resp = self._client.post(
            "/api/articles/check-urls",
            json={"urls": urls},
        )
        resp.raise_for_status()
        return resp.json().get("existing_urls", [])

    def submit_url(
        self,
        url: str,
        source: str,
        detail: str | None = None,
    ) -> IngestResult:
        """Submit a single URL to the auto-ingest endpoint."""
        try:
            resp = self._client.post(
                "/api/articles/auto-ingest",
                json={
                    "url": url,
                    "ingestion_source": source,
                    "ingestion_source_detail": detail,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return IngestResult(
                url=url,
                status=data.get("status", "error"),
                saved_count=data.get("saved_count", 0),
                extracted_count=data.get("extracted_count", 0),
                error=data.get("error"),
            )
        except httpx.HTTPStatusError as e:
            logger.error("HTTP error submitting %s: %s", url, e)
            return IngestResult(url=url, status="error", error=str(e))
        except httpx.HTTPError as e:
            logger.error("Network error submitting %s: %s", url, e)
            return IngestResult(url=url, status="error", error=str(e))

    def ingest_batch(
        self,
        urls: list[str],
        source: str,
        detail: str | None = None,
        state: StateTracker | None = None,
    ) -> list[IngestResult]:
        """Process a batch of candidate URLs through the full pipeline.

        Steps:
        1. Normalize URLs
        2. Deduplicate via local state (if state tracker provided)
        3. Deduplicate via API (check-urls)
        4. Submit each new URL with rate limiting
        """
        if not urls:
            return []

        normalized: list[tuple[str, str]] = []
        for raw_url in urls:
            resolved = resolve_google_news_url(raw_url)
            norm = normalize_url(resolved or raw_url)
            normalized.append((norm, raw_url))

        unique_urls = list(dict(normalized).keys())

        if state:
            unique_urls = state.get_unseen(unique_urls)
            if not unique_urls:
                logger.info("All %d URLs already seen locally", len(urls))
                return []

        existing = set(self.check_urls(unique_urls))
        new_urls = [u for u in unique_urls if u not in existing]

        if state:
            for u in existing:
                state.mark_seen(u, source)
                state.mark_submitted(u, "already_exists")

        if not new_urls:
            logger.info("All URLs already exist in the database")
            return []

        cap = self.config.max_submissions_per_run
        if len(new_urls) > cap:
            logger.info("Capping submissions at %d (found %d new URLs)", cap, len(new_urls))
            new_urls = new_urls[:cap]

        results: list[IngestResult] = []
        delay = self.config.submission_delay_seconds

        for i, url in enumerate(new_urls):
            if state:
                state.mark_seen(url, source)

            logger.info("Submitting [%d/%d]: %s", i + 1, len(new_urls), url)
            result = self.submit_url(url, source, detail)
            results.append(result)

            if state:
                state.mark_submitted(url, result.status)

            logger.info(
                "  -> %s (extracted=%d, saved=%d%s)",
                result.status,
                result.extracted_count,
                result.saved_count,
                f", error={result.error}" if result.error else "",
            )

            if i < len(new_urls) - 1 and delay > 0:
                time.sleep(delay)

        return results

    def close(self) -> None:
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
