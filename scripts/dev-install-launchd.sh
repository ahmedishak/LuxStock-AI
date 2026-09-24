#!/usr/bin/env bash
# Install macOS LaunchAgents so LuxStock survives Cursor/session death and restarts on login.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL_FE="com.luxstock.frontend"
LABEL_BE="com.luxstock.backend"
AGENTS_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$ROOT/.luxstock-logs"
UID_NUM="$(id -u)"
DOMAIN="gui/$UID_NUM"

mkdir -p "$AGENTS_DIR" "$LOG_DIR"
chmod +x "$ROOT/scripts/run-frontend.sh" "$ROOT/scripts/run-backend.sh" \
  "$ROOT/scripts/dev-up.sh" "$ROOT/scripts/dev-down.sh" "$ROOT/scripts/dev-status.sh" \
  "$ROOT/scripts/dev-install-launchd.sh" "$ROOT/scripts/dev-uninstall-launchd.sh"

write_plist() {
  local label="$1"
  local script="$2"
  local outfile="$AGENTS_DIR/$label.plist"
  cat >"$outfile" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$label</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$script</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$ROOT</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>3</integer>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/${label}.out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/${label}.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>HOME</key>
    <string>$HOME</string>
  </dict>
</dict>
</plist>
EOF
  echo "Wrote $outfile"
}

bootout() {
  launchctl bootout "$DOMAIN/$1" 2>/dev/null || true
  launchctl unload "$AGENTS_DIR/$1.plist" 2>/dev/null || true
}

ensure_loaded() {
  local label="$1"
  local plist="$AGENTS_DIR/$label.plist"
  if launchctl print "$DOMAIN/$label" &>/dev/null; then
    launchctl kickstart -k "$DOMAIN/$label"
  else
    launchctl bootstrap "$DOMAIN" "$plist"
    launchctl enable "$DOMAIN/$label" 2>/dev/null || true
    launchctl kickstart -k "$DOMAIN/$label"
  fi
  echo "Loaded $label"
}

# Stop first so rewritten ports apply cleanly
bootout "$LABEL_FE"
bootout "$LABEL_BE"
sleep 1
for port in 3004 3002 8000; do
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
done
sleep 0.5

write_plist "$LABEL_BE" "$ROOT/scripts/run-backend.sh"
write_plist "$LABEL_FE" "$ROOT/scripts/run-frontend.sh"
ensure_loaded "$LABEL_BE"
ensure_loaded "$LABEL_FE"

echo "LaunchAgents installed (auto-start on login + KeepAlive)."
echo "Open http://127.0.0.1:3004/  |  make status / make down / make uninstall-service"
