# NOTES

## Done

## Not done yet

## Decisions I made

- **Seed projects:** the only repo under `~/projects` is `agentbox-panel`, so all four Claude agents start pointed at it. Change each one's Project in the editor once you clone more repos (e.g. `portfolio` for Site Checker).
- **No fake history:** seed data is agents only. History and pull request links only ever show real runs, so nothing on screen is made up.
- **Idle status:** an agent that is on but has nothing to do and no schedule shows a gray **Ready** pill; one switched off in the editor shows **Off**. (The design lists Working / Needs you / Done / Stopped / Scheduled / Paused; these two cover the gaps.)
- **Heartbeat data source:** `out.log` and `err.log` stay empty when the job succeeds (Discord replies with nothing), so the panel reads each hourly run from the Claude Code transcript the job leaves in `~/.claude/projects/-Users-agent-agents-heartbeat/`, plus `launchctl print` for whether the job is loaded/running and its last exit code. "On time" = started within 5 minutes of the hour; each hour counts once.
- **Heartbeat is read-only:** no Run now / Pause / Edit buttons on its page.
- **Kept `AGENTS.md`:** Next.js 16 writes it automatically; it tells future agents working on this repo to read the bundled Next docs. Harmless and useful for Builder.

## Needs Nic
