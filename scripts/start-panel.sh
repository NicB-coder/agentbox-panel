#!/bin/zsh
# Starts the panel (used by the LaunchAgent). Runs whichever build is active: Update agentbox builds the
# new version next to the running one, and switches by writing its folder name into .active-build.
APP_DIR="${0:A:h:h}"
cd "$APP_DIR"
DIST=".next"
[[ -f .active-build ]] && DIST="$(cat .active-build)"
[[ -d "$DIST" ]] || DIST=".next"
export NEXT_DIST_DIR="$DIST"
exec ./node_modules/.bin/next start -H 127.0.0.1 -p "${PORT:-3000}"
