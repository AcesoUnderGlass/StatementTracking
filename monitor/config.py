"""Central configuration for all monitor scripts.

Reads from ~/.statement-tracker/config.yaml if it exists,
falling back to environment variables and sensible defaults.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml

_CONFIG_DIR = Path.home() / ".statement-tracker"
_CONFIG_FILE = _CONFIG_DIR / "config.yaml"

_DEFAULTS = {
    "api_base_url": "http://localhost:8000",
    "submission_delay_seconds": 5,
    "max_submissions_per_run": 20,
    "log_level": "INFO",
    "state_db_path": str(_CONFIG_DIR / "monitor-state.db"),
}


@dataclass
class MonitorConfig:
    api_base_url: str = _DEFAULTS["api_base_url"]
    submission_delay_seconds: int = _DEFAULTS["submission_delay_seconds"]
    max_submissions_per_run: int = _DEFAULTS["max_submissions_per_run"]
    log_level: str = _DEFAULTS["log_level"]
    state_db_path: str = _DEFAULTS["state_db_path"]
    extra: dict = field(default_factory=dict)


def load_config() -> MonitorConfig:
    """Load configuration with precedence: env vars > config file > defaults."""
    values: dict = dict(_DEFAULTS)

    if _CONFIG_FILE.exists():
        with open(_CONFIG_FILE) as f:
            file_values = yaml.safe_load(f) or {}
        values.update({k: v for k, v in file_values.items() if v is not None})

    env_map = {
        "MONITOR_API_BASE_URL": "api_base_url",
        "MONITOR_SUBMISSION_DELAY": "submission_delay_seconds",
        "MONITOR_MAX_SUBMISSIONS": "max_submissions_per_run",
        "MONITOR_LOG_LEVEL": "log_level",
        "MONITOR_STATE_DB_PATH": "state_db_path",
    }
    for env_key, cfg_key in env_map.items():
        env_val = os.environ.get(env_key)
        if env_val is not None:
            if cfg_key in ("submission_delay_seconds", "max_submissions_per_run"):
                values[cfg_key] = int(env_val)
            else:
                values[cfg_key] = env_val

    known_keys = set(_DEFAULTS.keys())
    extra = {k: v for k, v in values.items() if k not in known_keys}
    core = {k: v for k, v in values.items() if k in known_keys}

    return MonitorConfig(**core, extra=extra)
