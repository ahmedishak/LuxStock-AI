#!/usr/bin/env bash
# Launched by launchd (com.luxstock.frontend). Do not call from Cursor agent shells alone.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=3004

pids="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "$pids" ]]; then
  # shellcheck disable=SC2086
  kill -9 $pids 2>/dev/null || true
  sleep 0.3
fi

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
cd "$ROOT/frontend"
exec npm run dev -- -p "$PORT" -H 127.0.0.1
