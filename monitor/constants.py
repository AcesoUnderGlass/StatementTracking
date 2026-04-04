"""Single source of truth for monitor RSS polling and Vercel harvest.

Change env var names, log lines, feed source_type values, and harvest defaults here."""
from __future__ import annotations

# --- Environment variable names ---
ENV_CRON_SECRET = "CRON_SECRET"
ENV_MONITOR_API_BASE_URL = "MONITOR_API_BASE_URL"
ENV_MONITOR_FEEDS_FILE = "MONITOR_FEEDS_FILE"
ENV_VERCEL_URL = "VERCEL_URL"

# --- Feed `source_type` values (feeds.yaml; matches ingestion / frontend) ---
SOURCE_TYPE_RSS_FEED = "rss_feed"
SOURCE_TYPE_GOVERNMENT_RSS = "government_rss"

# --- Vercel harvest ---
# Ephemeral SQLite in /tmp — API-side dedup prevents reprocessing across invocations.
HARVEST_STATE_DB_PATH = "/tmp/monitor-state.db"
DEFAULT_LOCAL_API_BASE_URL = "http://localhost:8000"

# --- HTTP / JSON (harvest handler) ---
AUTH_BEARER_PREFIX = "Bearer "
HTTP_HEADER_AUTHORIZATION = "Authorization"
HTTP_HEADER_CONTENT_TYPE = "Content-Type"
MEDIA_TYPE_JSON = "application/json"
JSON_KEY_ERROR = "error"
JSON_KEY_STATUS = "status"
JSON_VALUE_ERROR = "error"
JSON_VALUE_OK = "ok"
MSG_HTTP_UNAUTHORIZED = "Unauthorized"

# --- Logging (rss_poller + harvest) ---
LOG_DATEFMT = "%H:%M:%S"
LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"

MSG_DONE_SUBMITTED = "Done. Submitted %d articles, %d quotes saved for review."
MSG_DRY_RUN_WOULD_SUBMIT = "[DRY RUN] Would submit: %s (%s) [%s]"
MSG_FEED_ERROR = "Feed error for %s: %s"
MSG_FOUND_CANDIDATES_TOTAL = "Found %d candidate articles total"
MSG_LOADED_FEEDS = "Loaded %d feeds from %s"
MSG_NEW_ENTRIES_FROM_FEED = "  %d new entries from feed"
MSG_NO_FEEDS_IN_FILE = "No feeds found in {path}"
MSG_NO_RELEVANT_ARTICLES = "No relevant articles found across all feeds"
MSG_PASSED_KEYWORD_FILTER = "  %d passed keyword filter"
MSG_POLLING_FEED = "Polling %s (cutoff: %s)"
MSG_SKIP_CUTOFF_ON_ERROR = "Skipping cutoff update for %s due to submission errors"
MSG_SUBMIT_RESULT = "  -> %s (extracted=%d, saved=%d%s)"
MSG_SUBMITTING = "Submitting: %s [%s]"

# Harvest JSON summary keys (run_harvest return value)
SUMMARY_KEY_CANDIDATES = "candidates"
SUMMARY_KEY_ERRORS = "errors"
SUMMARY_KEY_FEEDS_POLLED = "feeds_polled"
SUMMARY_KEY_SAVED = "saved"
SUMMARY_KEY_SUBMITTED = "submitted"
SUMMARY_KEY_TIMESTAMP = "timestamp"

# --- Logging (archive_backfill) ---
MSG_BACKFILL_START = "Backfilling %s from %s to %s"
MSG_BACKFILL_GOOGLE_WINDOW = "  Google News window %s -> %s (%d entries)"
MSG_BACKFILL_WAYBACK_SNAPSHOTS = "  Wayback CDX returned %d snapshots for %s"
MSG_BACKFILL_WAYBACK_PARSING = "  Parsing snapshot %d/%d (%s)"
MSG_BACKFILL_WAYBACK_SNAPSHOT_ENTRIES = "    %d entries from snapshot"
MSG_BACKFILL_TOTAL_ENTRIES = "  %d unique entries discovered for %s"
MSG_BACKFILL_SKIPPING_FEED = "Skipping %s (--feed-name filter)"
MSG_BACKFILL_DRY_RUN = "[DRY RUN] Would submit %d URLs from %s"
MSG_BACKFILL_SUBMITTING = "Submitting %d URLs from %s"
MSG_BACKFILL_DONE = "Backfill complete. Discovered %d URLs across %d feeds, submitted %d."
