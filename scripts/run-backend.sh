#!/usr/bin/env bash
# Launched by launchd (com.luxstock.backend). Do not call from Cursor agent shells alone.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=8000

pids="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "$pids" ]]; then
  # shellcheck disable=SC2086
  kill -9 $pids 2>/dev/null || true
  sleep 0.3
fi

cd "$ROOT/backend"
exec .venv/bin/uvicorn main:app --reload --port "$PORT" --host 127.0.0.1
