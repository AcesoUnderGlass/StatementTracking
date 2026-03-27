#!/usr/bin/env bash
#
# Run all frontend and backend tests and report results.
#
# Usage: ./scripts/test.sh
#
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_PYTHON="python3"

if [ -x "$ROOT/backend/venv/bin/python" ]; then
  BACKEND_PYTHON="$ROOT/backend/venv/bin/python"
fi

BACKEND_EXIT=0
FRONTEND_EXIT=0

# ── Backend (pytest) ─────────────────────────────────────────────────────

echo "══════════════════════════════════════════════════════════════"
echo "  Backend Tests (pytest)"
echo "══════════════════════════════════════════════════════════════"
echo ""

if ! "$BACKEND_PYTHON" -m pytest --version >/dev/null 2>&1; then
  echo "pytest not found – installing dev dependencies..."
  "$BACKEND_PYTHON" -m pip install -r "$ROOT/requirements-dev.txt" -q
fi

(cd "$ROOT/backend" && "$BACKEND_PYTHON" -m pytest -v)
BACKEND_EXIT=$?
echo ""

# ── Frontend (vitest) ────────────────────────────────────────────────────

echo "══════════════════════════════════════════════════════════════"
echo "  Frontend Tests (vitest)"
echo "══════════════════════════════════════════════════════════════"
echo ""

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "node_modules missing – running npm install..."
  (cd "$ROOT/frontend" && npm install)
fi

(cd "$ROOT/frontend" && npx vitest run)
FRONTEND_EXIT=$?
echo ""

# ── Summary ──────────────────────────────────────────────────────────────

echo "══════════════════════════════════════════════════════════════"
echo "  Results"
echo "══════════════════════════════════════════════════════════════"
echo ""

if [ "$BACKEND_EXIT" -eq 0 ]; then
  echo "  Backend  : PASS"
else
  echo "  Backend  : FAIL (exit $BACKEND_EXIT)"
fi

if [ "$FRONTEND_EXIT" -eq 0 ]; then
  echo "  Frontend : PASS"
else
  echo "  Frontend : FAIL (exit $FRONTEND_EXIT)"
fi

echo ""

if [ "$BACKEND_EXIT" -ne 0 ] || [ "$FRONTEND_EXIT" -ne 0 ]; then
  exit 1
fi
