#!/bin/zsh
# Update agentbox: gets the newest main from GitHub, installs, builds it NEXT TO the running version,
# test-starts it on a spare port, switches over, and checks it came back. If anything goes wrong before
# the switch, the old version simply keeps running. If the new version doesn't come up after the switch,
# it switches back to the old one by itself.
#
# Runs as its own launchd job (started by the panel), so it survives the panel restarting under it.
# Settings come from the environment:
#   APP_DIR      the panel's folder (a git checkout on main)          LABEL   its LaunchAgent (com.agentbox.panel)
#   PORT         where it runs (3000)                                  STAGE_PORT  where the new build is test-started (PORT+1)
#   DATA_DIR     the panel's data folder (its database is copied for the test start)
#   STATUS       the JSON file the panel reads to show progress
#   BRANCH       which branch to follow (main)                         FORCE=1  rebuild even if there's nothing new
set -u
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export NEXT_TELEMETRY_DISABLED=1
APP_DIR="${APP_DIR:?}"
LABEL="${LABEL:-com.agentbox.panel}"
PORT="${PORT:-3000}"
STAGE_PORT="${STAGE_PORT:-$((PORT + 1))}"
DATA_DIR="${DATA_DIR:-$APP_DIR/data}"
STATUS="${STATUS:-$DATA_DIR/update.json}"
BRANCH="${BRANCH:-main}"
LOG="${STATUS%.json}.log"
UID_NUM=$(id -u)
STEPS='["Check for a new version","Download it","Install","Build it","Test the new version","Switch over","Check that it started"]'
STARTED=$(date +%s)000
: > "$LOG"

status() { # state step message [from] [to]
  node -e '
    const [file, state, step, message, steps, started, from, to] = process.argv.slice(1);
    const done = ["done", "failed", "rolledback", "uptodate"].includes(state);
    require("fs").writeFileSync(file + ".tmp", JSON.stringify({ state, step: Number(step), steps: JSON.parse(steps), message, startedAt: Number(started), endedAt: done ? Date.now() : null, from, to, pid: process.ppid }));
    require("fs").renameSync(file + ".tmp", file);
  ' "$STATUS" "$1" "$2" "$3" "$STEPS" "$STARTED" "${OLD:-}" "${NEW:-}"
  echo "[$(date '+%H:%M:%S')] $1 · step $2 · $3" >> "$LOG"
}
fail() { status failed "$STEP" "$1"; exit 0; }
up() { # port seconds expected-version → 0 if /api/ping answers (with that version, if given)
  local port=$1 secs=$2 want=${3:-} i out
  for i in $(seq 1 $secs); do
    out=$(curl -s -m 2 "http://127.0.0.1:$port/api/ping" 2>/dev/null)
    if [[ "$out" == *'"ok":true'* ]]; then
      if [[ -z "$want" || "$out" == *"\"version\":\"$want"* ]]; then
        curl -s -m 10 -o /dev/null -w "%{http_code}" "http://127.0.0.1:$port/" 2>/dev/null | grep -q "^200$" && return 0
      fi
    fi
    sleep 1
  done
  return 1
}
restore_source() { # back to the old code and packages
  git reset -q --hard "$OLD" >> "$LOG" 2>&1
  if [[ "$LOCK_CHANGED" == 1 ]]; then npm ci --no-audit --no-fund >> "$LOG" 2>&1; fi
  git checkout -q -- tsconfig.json next-env.d.ts 2>/dev/null
}

cd "$APP_DIR" || { STEP=0; fail "Can't find the panel's folder."; }
STEP=0; status running 0 "Checking GitHub for a new version…"
git checkout -q -- tsconfig.json next-env.d.ts 2>/dev/null # Next.js rewrites these; not real changes
CUR=$(git rev-parse --abbrev-ref HEAD)
[[ "$CUR" == "$BRANCH" ]] || fail "The panel's folder is on the branch \"$CUR\", not $BRANCH. Ask Claude to switch it back, or use the Terminal."
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail "There are unsaved changes in the panel's own folder, so it won't overwrite them. Ask Claude to look at it."
git fetch -q origin "$BRANCH" >> "$LOG" 2>&1 || fail "Couldn't reach GitHub. Check the Mac is online and try again."
OLD=$(git rev-parse HEAD)
NEW=$(git rev-parse "origin/$BRANCH")
if [[ "$OLD" == "$NEW" && "${FORCE:-0}" != 1 ]]; then status uptodate 0 "You already have the newest version."; exit 0; fi
git merge-base --is-ancestor "$OLD" "$NEW" || fail "The panel's folder has commits that aren't on GitHub, so it can't update safely. Ask Claude to look at it."

STEP=1; status running 1 "Downloading the new version…"
git merge -q --ff-only "$NEW" >> "$LOG" 2>&1 || fail "Couldn't download the new version."
LOCK_CHANGED=0
git diff --quiet "$OLD" "$NEW" -- package-lock.json package.json || LOCK_CHANGED=1

STEP=2; status running 2 "Installing what it needs…"
if [[ "$LOCK_CHANGED" == 1 ]]; then
  npm ci --no-audit --no-fund >> "$LOG" 2>&1 || { restore_source; fail "Installing the new version failed, so the old one keeps running."; }
fi

STEP=3; status running 3 "Building the new version (a minute or two)…"
ACTIVE=".next"
[[ -f .active-build ]] && ACTIVE="$(cat .active-build)"
[[ "$ACTIVE" == ".next-a" ]] && NEXTDIR=".next-b" || NEXTDIR=".next-a"
rm -rf "$NEXTDIR"
if ! NEXT_DIST_DIR="$NEXTDIR" npm run build >> "$LOG" 2>&1; then
  rm -rf "$NEXTDIR"; restore_source
  fail "The new version didn't build, so the old one keeps running. Nothing changed."
fi
git checkout -q -- tsconfig.json next-env.d.ts 2>/dev/null

STEP=4; status running 4 "Test-starting the new version on the side…"
TEST_DATA=$(mktemp -d /tmp/agentbox-update-test.XXXXXX)
mkdir -p "$TEST_DATA/logs"
sqlite3 "$DATA_DIR/agentbox.db" ".backup '$TEST_DATA/agentbox.db'" >> "$LOG" 2>&1
NEXT_DIST_DIR="$NEXTDIR" AGENTBOX_DATA_DIR="$TEST_DATA" AGENTBOX_NO_BACKGROUND=1 AGENTBOX_NO_SCHEDULE=1 AGENTBOX_NO_DISCORD=1 PORT="$STAGE_PORT" \
  ./node_modules/.bin/next start -H 127.0.0.1 -p "$STAGE_PORT" >> "$LOG" 2>&1 &
TEST_PID=$!
if up "$STAGE_PORT" 60; then OK=1; else OK=0; fi
kill $TEST_PID 2>/dev/null; sleep 1; kill -9 $TEST_PID 2>/dev/null
rm -rf "$TEST_DATA"
if [[ "$OK" != 1 ]]; then
  rm -rf "$NEXTDIR"; restore_source
  fail "The new version built but didn't start properly, so the old one keeps running. Nothing changed."
fi

STEP=5; status running 5 "Switching over (the panel restarts for a few seconds)…"
echo "$NEXTDIR" > .active-build
launchctl kickstart -k "gui/$UID_NUM/$LABEL" >> "$LOG" 2>&1

STEP=6; status running 6 "Checking the new version is up…"
if up "$PORT" 90 "${NEW:0:12}"; then
  # Keep the old build one more round, in case. Remove anything older.
  for d in .next-a .next-b; do [[ "$d" != "$NEXTDIR" && "$d" != "$ACTIVE" ]] && rm -rf "$d"; done
  status done 6 "Updated and restarted. You're on the new version."
  exit 0
fi

# The new version didn't come up: go back to the old one.
echo "$ACTIVE" > .active-build
restore_source
launchctl kickstart -k "gui/$UID_NUM/$LABEL" >> "$LOG" 2>&1
if up "$PORT" 90; then
  status rolledback 6 "The new version didn't come up, so it went back to the old one by itself. Everything is as it was."
else
  status failed 6 "The new version didn't come up, and the old one is slow to come back. Wait a minute and reload; if it's still down, run scripts/install-launchagent.sh in the Terminal."
fi
