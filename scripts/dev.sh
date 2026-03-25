#!/usr/bin/env bash
#
# Run frontend and backend dev servers together from the repo root.
#
# Usage: ./scripts/dev.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_PYTHON="python3"
REQUIREMENTS_FILE="$ROOT/requirements.txt"

if [ ! -f "$REQUIREMENTS_FILE" ]; then
  echo "Missing $REQUIREMENTS_FILE"
  exit 1
fi

if [ -x "$ROOT/backend/venv/bin/python" ]; then
  BACKEND_PYTHON="$ROOT/backend/venv/bin/python"
fi

if ! "$BACKEND_PYTHON" -m uvicorn --version >/dev/null 2>&1; then
  if [ "$BACKEND_PYTHON" = "python3" ]; then
    echo "==> Creating backend virtualenv..."
    python3 -m venv "$ROOT/backend/venv"
    BACKEND_PYTHON="$ROOT/backend/venv/bin/python"
  fi
  echo "==> Installing backend dependencies..."
  "$BACKEND_PYTHON" -m pip install -r "$REQUIREMENTS_FILE"
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "==> Installing frontend dependencies..."
  (
    cd "$ROOT/frontend"
    npm install
  )
fi

ports_to_free=(8000 5173)
for port_to_free in "${ports_to_free[@]}"; do
  listener_pids=($(lsof -tiTCP:"$port_to_free" -sTCP:LISTEN 2>/dev/null || true))
  if [ "${#listener_pids[@]}" -gt 0 ]; then
    echo "==> Port $port_to_free is in use, stopping existing listeners..."
    for listener_pid in "${listener_pids[@]}"; do
      kill "$listener_pid" 2>/dev/null || true
    done
  fi
done

echo "==> Starting backend on http://localhost:8000"
(
  cd "$ROOT/backend"
  exec "$BACKEND_PYTHON" -m uvicorn app.main:app --reload --port 8000
) &
BACKEND_PID=$!

echo "==> Starting frontend on http://localhost:5173"
(
  cd "$ROOT/frontend"
  exec npm run dev
) &
FRONTEND_PID=$!

cleanup() {
  echo ""
  echo "==> Stopping dev servers..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  for port_to_free in "${ports_to_free[@]}"; do
    listener_pids=($(lsof -tiTCP:"$port_to_free" -sTCP:LISTEN 2>/dev/null || true))
    for listener_pid in "${listener_pids[@]}"; do
      kill "$listener_pid" 2>/dev/null || true
    done
  done
}

trap cleanup EXIT INT TERM

while true; do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    wait "$BACKEND_PID" 2>/dev/null || true
    break
  fi
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    wait "$FRONTEND_PID" 2>/dev/null || true
    break
  fi
  sleep 1
done
