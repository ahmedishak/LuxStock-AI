#!/usr/bin/env bash
# Stop LuxStock LaunchAgents (plists stay installed; make up / next login restarts).
set -euo pipefail

LABEL_FE="com.luxstock.frontend"
LABEL_BE="com.luxstock.backend"
UID_NUM="$(id -u)"
DOMAIN="gui/$UID_NUM"

for label in "$LABEL_FE" "$LABEL_BE"; do
  if launchctl print "$DOMAIN/$label" &>/dev/null; then
    echo "Stopping $label"
    launchctl bootout "$DOMAIN/$label" 2>/dev/null || true
  else
    echo "$label already stopped"
  fi
done

# Belt-and-suspenders: free ports if anything else grabbed them
for port in 3004 8000; do
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "Freeing :$port ($pids)"
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
done

echo "LuxStock stopped. Run make up to start again (or reboot — agents are still installed)."
