#!/bin/zsh
# Starts a separate dev copy of the panel for testing: its own copy of the database, port 3100,
# no schedules, no Discord messages, its own build folder. The always-on panel isn't touched.
#   scripts/dev-copy.sh fresh   copy the live database again first
#   AGENTBOX_DEV_DIR=… AGENTBOX_DEV_PORT=3201 scripts/dev-copy.sh   another copy (e.g. an agent testing changes to the panel)
set -euo pipefail
APP_DIR="${0:A:h:h}"
DEV="${AGENTBOX_DEV_DIR:-/tmp/agentbox-dev-v3}"
mkdir -p "$DEV/data/logs"
if [[ "${1:-}" == "fresh" || ! -f "$DEV/data/agentbox.db" ]]; then
  rm -f "$DEV/data/agentbox.db" "$DEV/data/agentbox.db-wal" "$DEV/data/agentbox.db-shm"
  sqlite3 "$APP_DIR/data/agentbox.db" ".backup '$DEV/data/agentbox.db'"
  # Runs that are live in the real panel aren't ours to stop or resume in the copy.
  sqlite3 "$DEV/data/agentbox.db" "UPDATE runs SET status='done', activity=NULL, pid=NULL WHERE status IN ('working','queued','waiting'); UPDATE workflow_runs SET status='stopped', stop_reason='Copied from the live panel' WHERE status IN ('running','queued','needs'); UPDATE sqlite_sequence SET seq = seq + 10000 WHERE name IN ('runs','agents','workflow_runs','approvals');"
  echo "Copied the live database to $DEV/data"
fi
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
PORT_NUM="${AGENTBOX_DEV_PORT:-3100}"
DIST=".next-dev"
[[ "$PORT_NUM" != "3100" ]] && DIST=".next-dev-$PORT_NUM"
export AGENTBOX_DATA_DIR="$DEV/data" AGENTBOX_NO_SCHEDULE=1 AGENTBOX_NO_DISCORD=1 AGENTBOX_DEV=1 NEXT_DIST_DIR="$DIST" PORT="$PORT_NUM" NEXT_TELEMETRY_DISABLED=1
cd "$APP_DIR"
exec npx next dev -H 127.0.0.1 -p "$PORT_NUM"
