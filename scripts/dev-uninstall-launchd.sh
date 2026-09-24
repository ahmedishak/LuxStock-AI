#!/usr/bin/env bash
# Remove LuxStock LaunchAgents (permanent uninstall).
set -euo pipefail

LABEL_FE="com.luxstock.frontend"
LABEL_BE="com.luxstock.backend"
AGENTS_DIR="$HOME/Library/LaunchAgents"
UID_NUM="$(id -u)"
DOMAIN="gui/$UID_NUM"

for label in "$LABEL_FE" "$LABEL_BE"; do
  launchctl bootout "$DOMAIN/$label" 2>/dev/null || true
  rm -f "$AGENTS_DIR/$label.plist"
  echo "Removed $label"
done

echo "LuxStock LaunchAgents uninstalled."
