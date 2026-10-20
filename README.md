# agentbox-panel

A private web panel for controlling the AI agents that run on agentbox. See every agent at a glance, give them tasks, approve their plans and steps, and watch their pull requests.

![Home page](docs/screenshots/home.png)

## How to open it

The panel runs all the time on agentbox (a LaunchAgent in the `agent` account keeps it going, even after a restart or crash). It only listens on `127.0.0.1:3000`, so nothing outside the Mac can reach it directly. Tailscale is the lock: there is no login.

**One-time setup, from the admin account** (Tailscale belongs to the admin account, so the `agent` account can't do this):

```sh
/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg 3000
```

Then run `/Applications/Tailscale.app/Contents/MacOS/Tailscale serve status` to see the address. It looks like `https://agentbox.<your-tailnet>.ts.net`. Open it on any device signed in to your tailnet (laptop or phone). Never use `tailscale funnel`; that would make it public.

On agentbox itself you can also just open http://127.0.0.1:3000.

## Running it

| What | How |
| --- | --- |
| Install or update the always-on service | `./scripts/install-launchagent.sh` (builds the app and restarts it) |
| Restart it | `launchctl kickstart -k gui/$(id -u)/com.agentbox.panel` |
| Stop it until next login | `launchctl bootout gui/$(id -u)/com.agentbox.panel` |
| Its logs | `~/agents/panel/out.log` and `err.log` |
| Develop locally | `npm run dev` (stop the service first, both use port 3000) |

Data lives in `data/agentbox.db` (SQLite) and run logs in `data/logs/`. Both are ignored by git.

## How it works

- **Agents** are rows in SQLite: a prompt in your own words plus a few exact settings (project, schedule, what it's allowed to do, how it works with you, time limit, model, notifications).
- **A run** makes a git worktree on a new branch `agent/<agent>-<task>-<number>`, starts Claude Code headless in it (`claude -p --output-format stream-json`), and reads its stream to show plain-English steps. When it finishes, the panel commits anything left over, pushes the branch and opens a pull request with `gh`. The status goes Working → Needs you (pull request open) → Done when you merge it. Errors, usage limits, time limits and the Stop button end in Stopped.
- **How it works with you:**
  - *Auto* uses Claude Code's `auto` permission mode (a safety checker approves each step).
  - *Plan first* runs in `plan` mode, shows you the plan, and resumes the same session in `auto` when you press Approve plan. Change it sends your note back for a new plan.
  - *Ask me each step* uses `manual` mode with a `PermissionRequest` hook (`scripts/agentbox-hook.mjs`) that asks the panel and waits for your Allow or Deny.
  - *Look only* removes the editing tools and never pushes or opens a pull request. The result is a report.
- **Safety:** agents never use `bypassPermissions`. A `PreToolUse` hook blocks any push to main/master, force pushes, and every push unless the agent is set to Make changes. The panel itself only ever pushes the agent's own branch.
- **Schedules** run inside the server process (checked every 30 seconds). Runs missed while the Mac was asleep are skipped, not replayed.
- **Heartbeat** is the existing `com.agentbox.heartbeat` launchd job, shown read-only. Its logs stay empty when it works, so the panel reads each check-in from the Claude Code transcript it leaves behind.
- **Discord pings** use the webhook stored in the Keychain as `discord-heartbeat`. It is read when needed and never saved anywhere else.

## v2: workflows, usage meter, Inbox

- **Shared header** on every page: Agents · Workflows · Inbox (with a count), the usage meter, New task and Pause everything. On phones the three pages are tabs at the bottom and the rest is in Menu.
- **Usage meter** reads Claude Code's own numbers: `claude -p /usage --output-format json` (a local command that costs nothing) every few minutes, plus the `rate_limit_event` that every headless run streams (`unifiedWindows.five_hour` / `seven_day` utilization and exact `resetsAt`). Per-run cost and tokens from each run's `result` event are saved in SQLite for the "today by agent / by workflow" split. When usage runs out (or passes the optional limit in Settings) new runs are saved as *queued* and start by themselves after the reset.
- **Inbox** collects pending Allow/Deny questions, plans, pull requests waiting for review, stopped runs and workflows waiting at Ask me or Ship, each with its buttons inline. It also has an Ideas list.
- **Workflows** (`lib/wf.ts` for the step types and templates, `lib/workflowRunner.ts` for the engine). One run = one git worktree on `agent/wf-…`, one draft pull request that every step comments on. Agent-like steps reuse the v1 runner (same hooks, approvals and main/force-push block; workflow steps also can't `gh pr merge`). Review and Check can send work back to an earlier step up to the loop limit. Check runs real gates in `lib/checks.ts` (npm test, Playwright page load, console errors). Ship merges with `gh pr merge --squash`; it never ships agentbox-panel on its own. Test runs stop before Ship and never send Discord messages.
- **Describe it** (`lib/draft.ts`) runs Claude Code headless with `--tools ""` (no tools at all) and `--json-schema`, then opens the draft switched off.
- **Projects** clones with `gh repo clone` or makes a public repo with `gh repo create --public --add-readme --clone` into `~/projects`.

## Tests

With the panel running:

```sh
node scripts/ui-check.mjs out/              # screenshots at laptop + phone width, flags sideways scrolling and small tap targets
node scripts/editor-test.mjs                # create, edit and delete an agent through the UI
node scripts/run-flow-test.mjs out/         # real runs: Ask me each step, Plan first, Stop (uses a little Claude usage)
node scripts/m1-test.mjs out/               # header, usage panel, Pause everything, Inbox, ideas
node scripts/m2-test.mjs out/               # workflow templates, editor, undo, drag, versions
node scripts/m3-test.mjs out/               # Describe it (uses a little Claude usage)
node scripts/walkthrough.mjs out/           # screenshots of every page at both widths
```

To try changes without touching the always-on service, run a second copy with its own data and build folder:

```sh
AGENTBOX_DATA_DIR=/tmp/agentbox-dev AGENTBOX_NO_SCHEDULE=1 NEXT_DIST_DIR=.next-dev PORT=3100 npx next dev -H 127.0.0.1 -p 3100
```
