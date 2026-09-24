#!/usr/bin/env bash
# Start LuxStock via macOS launchd (survives Cursor agent shells dying).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL_FE="com.luxstock.frontend"
LABEL_BE="com.luxstock.backend"
UID_NUM="$(id -u)"
DOMAIN="gui/$UID_NUM"

bash "$ROOT/scripts/dev-install-launchd.sh"

echo "Waiting for servers..."
for _ in $(seq 1 40); do
  fe="$(curl -s -o /dev/null -w '%{http_code}' --max-time 1 http://127.0.0.1:3004/ || true)"
  api="$(curl -s -o /dev/null -w '%{http_code}' --max-time 1 http://127.0.0.1:8000/docs || true)"
  if [[ "$fe" == "200" && "$api" == "200" ]]; then
    echo "OK — app http://127.0.0.1:3004  |  api http://127.0.0.1:8000/docs"
    echo "Managed by launchd (KeepAlive + login). Stop: make down"
    exit 0
  fi
  sleep 0.5
done

echo "Timed out. Check:"
echo "  launchctl print $DOMAIN/$LABEL_FE"
echo "  launchctl print $DOMAIN/$LABEL_BE"
echo "  logs in $ROOT/.luxstock-logs/"
tail -n 20 "$ROOT/.luxstock-logs/${LABEL_FE}.err.log" 2>/dev/null || true
tail -n 20 "$ROOT/.luxstock-logs/${LABEL_BE}.err.log" 2>/dev/null || true
exit 1
