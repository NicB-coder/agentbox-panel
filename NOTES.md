# NOTES

## What Nic should click first

1. Do the one **Needs Nic** step below (the `tailscale serve` command), then open the panel on your phone.
2. Click **Site Checker → Edit** and put your real site addresses in "What should this agent do?". It's set to run tonight at 2:00 AM, and right now its prompt says "my sites" without listing any.
3. Click **Builder**, type a small real task in **Give it a task**, pick **Plan first**, and press **Start**. You'll see its plan, can press **Approve plan**, and then watch the steps tick by until it opens a pull request.

## Done

All six milestones, each tested in a real browser (Playwright) at laptop (1366px) and phone (390px) width:

1. **Home page and agent page** as designed: squircle tiles, status pills, greeting and summary line, "Add an agent" tile, self-refreshing every 3 seconds.
2. **Agent editor** (Add an agent and Edit): name, 6 colors, 8 icons, the big prompt box with the tip, project dropdown, schedule with day/time pickers only when needed, the 3-step "allowed to do" choice, the 4 work modes, time limit slider, Fast/Smartest, Tell me when, On/Off switch and a live one-line summary. Saved to SQLite. Delete is there too.
3. **Real heartbeat data**: "N of N on time" today, last check-in and what Claude said, the last 24 check-ins, and both log files behind "Show the full log".
4. **Real task runs** with Run now, Pause/Resume and Stop. Tested for real: a Look-only report, a Builder run that opened a pull request (#1, a test I closed straight away, which also proved closed pull requests show as Stopped), Ask me each step with Deny, Plan first with Change it and then Approve plan, and Stop (it also kills everything the agent started).
5. **Scheduler**: tested with a temporary agent set 2 minutes ahead. It started on time and rescheduled for the next day.
6. **Always on**: `com.agentbox.panel` LaunchAgent in the agent account runs `npm start` on 127.0.0.1:3000 and restarts it if it dies (tested by killing it). README has "How to open it".

## Not done / known limits

- **Site Checker has no site addresses** yet (see "click first"). Also, in Look only it can't install anything, so it uses whatever browser tools are already on the Mac (Playwright's Chromium is installed in this account).
- **Pending approvals don't time out.** If you never answer an "Ask me each step" question, the agent waits (the time limit doesn't cut you off mid-decision). Press Stop to end it.
- **Stopped runs keep their worktree** in `~/agents/worktrees/` so the work isn't lost. Finished runs clean theirs up. Nothing deletes old stopped ones yet.
- **The History pill for a run that's waiting on an Allow/Deny says "Working"**; the top of the page and the tile correctly say "Needs you".
- **No live push (server-sent events)**: pages poll every 3 seconds instead. Simpler, and fine for one person.
- **After you merge this PR**, the service keeps running from this folder on `build/v1`. Run `git checkout main && git pull && ./scripts/install-launchagent.sh` to switch it over.

## Decisions I made

- **Seed projects:** the only repo under `~/projects` is `agentbox-panel`, so all four Claude agents start pointed at it. Change each one's Project in the editor once you clone more repos (e.g. `portfolio` for Site Checker).
- **No fake history:** seed data is agents only. I cleared my test runs before handing over, apart from one tiny Reviewer run that checked agent runs work under the always-on service. Everything you see is real.
- **Idle status:** an agent that's on but idle with no schedule shows a gray **Ready** pill; one switched off in the editor shows **Off**. (The design lists Working / Needs you / Done / Stopped / Scheduled / Paused; these two cover the gaps.)
- **Heartbeat data source:** `out.log` and `err.log` stay empty when the job works (Discord replies with nothing), so the panel reads each hourly run from the Claude Code transcript the job leaves in `~/.claude/projects/-Users-agent-agents-heartbeat/`, plus `launchctl print` for whether it's loaded and its last exit code. "On time" means it started within 5 minutes of the hour, and each hour counts once.
- **Heartbeat is read-only:** no Run now / Pause / Edit on its page.
- **Accepted the repo invitation:** the bot couldn't push at first. You had a pending write invitation for `NicB-coder-bot` on this repo, so I accepted it.
- **"Run now"** runs the agent's own job (its prompt) with no extra task. To give it something specific, use "Give it a task" or "New task".
- **"New task" button** opens a small window: pick the agent, type the task, pick the mode, Start.
- **Pause vs Off:** Pause (agent page) stops scheduled runs, but Run now still works. Off (editor switch) means it never runs.
- **Mode mapping (checked against `claude --help`, v2.1.304):** Auto → `--permission-mode auto`. Plan first → `plan`, then the same session is resumed in `auto` after you approve (headless plan mode returns the plan instead of asking, so approving resumes it). Ask me each step → `manual` plus a `PermissionRequest` hook that waits for your click. Look only → `auto` with Edit/Write/commit/push removed. Using `dontAsk` for Look only would have blocked Site Checker from opening a browser.
- **"Allowed to do":** *Look only* never pushes or opens a PR; the result is a report. *Suggest changes*: the agent commits in its worktree and the panel pushes and opens the PR (the agent itself can't push). *Make changes*: the agent may also push its own branch itself; the panel still opens the PR so you can see it. A hook blocks pushes to main/master and force pushes in every mode.
- **Progress steps** come from the agent: it's told to write `PLAN: a | b | c`, `STEP: n` and `SUMMARY: …` lines, which the panel turns into ✓ ● ○ steps. If it forgets, the panel uses default steps and moves them along based on what it's doing.
- **Time limit** counts from the start of the run, but never stops it while it's waiting for your OK.
- **Missed schedules are skipped** (e.g. the Mac was asleep at 2 AM). It waits for the next one instead of running late.
- **Closed-without-merging pull requests** show as Stopped ("The pull request was closed without merging").
- **Discord pings during my testing:** Builder is set to "Finished / Needs my OK / Something goes wrong", so my test runs sent a few real pings to your Discord around 7:20 PM. Sorry for the noise.
- **Kept `AGENTS.md`:** Next.js 16 writes it automatically. It tells agents working on this repo to read the bundled Next docs, which helps Builder.
- **TypeScript 5** instead of the brand-new TypeScript 7, to stay safely compatible with Next.js.

## Needs Nic

1. **Make the panel reachable on your tailnet.** From the **admin** account (Tailscale belongs to it), run once:

   ```sh
   /Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg 3000
   ```

   Then `/Applications/Tailscale.app/Contents/MacOS/Tailscale serve status` shows the `https://….ts.net` address to open. It survives restarts. Don't use `funnel`.

2. **Optional but recommended: protect `main` on GitHub** (Settings → Branches → add a rule for `main`, require a pull request). The panel and its hooks already never push to main, but this makes it impossible even if something goes wrong. The bot can't do this because it isn't an admin.
