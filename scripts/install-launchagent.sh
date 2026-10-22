#!/bin/zsh
# Installs (or reinstalls) the LaunchAgent that keeps the panel running in this account.
# It builds the app, writes ~/Library/LaunchAgents/com.agentbox.panel.plist and (re)starts it.
# No admin password needed.
set -euo pipefail
APP_DIR="${0:A:h:h}"
LABEL="com.agentbox.panel"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/agents/panel"
mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"

export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "$APP_DIR"
npm ci --no-audit --no-fund
git checkout -q -- tsconfig.json next-env.d.ts 2>/dev/null || true
NEXT_DIST_DIR=.next npm run build
git checkout -q -- tsconfig.json next-env.d.ts 2>/dev/null || true
echo ".next" > .active-build   # Update agentbox switches this between builds later

sed -e "s#__APP_DIR__#$APP_DIR#g" -e "s#__HOME__#$HOME#g" -e "s#__LOG_DIR__#$LOG_DIR#g" \
  "$APP_DIR/launchd/$LABEL.plist" > "$PLIST"
plutil -lint "$PLIST" >/dev/null

UID_NUM=$(id -u)
launchctl bootout "gui/$UID_NUM/$LABEL" 2>/dev/null || true
# launchd can take a moment to let go of the old job; wait for it, then load the new one.
for i in {1..20}; do
  launchctl print "gui/$UID_NUM/$LABEL" >/dev/null 2>&1 || break
  sleep 0.5
done
for i in {1..5}; do
  launchctl bootstrap "gui/$UID_NUM" "$PLIST" 2>/dev/null && break
  sleep 1
done
launchctl kickstart -k "gui/$UID_NUM/$LABEL"
echo "agentbox panel is starting at http://127.0.0.1:3000 (logs in $LOG_DIR)"
