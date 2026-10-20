# NOTES

# v2: Workflows, usage meter, Inbox

## v2: What Nic should click first

1. **Open the panel.** You'll get a 4-step welcome tour (skippable; Help → "Show the welcome tour again" brings it back).
2. **Workflows → New workflow → Build → Review → Ship → Test run.** Type a small real idea (e.g. "make the page titles friendlier"). Watch each step light up. It stops before shipping and sends no Discord messages. Close the draft pull request afterwards if you don't want it.
3. **Inbox.** When the badge shows a number, answer right there: Allow/Deny, Approve plan, Approve/Send back/Stop, Ship it.
4. **Tap the usage meter** at the top to see this session's and this week's usage, reset times, and today's split by agent and workflow. In **Settings** you can make new runs wait when usage passes a number you pick (off by default).

## v2: Done

All 7 milestones, each committed and pushed on `build/v2`, each tested with Playwright at 1366px and 390px:

1. **Shared header** on every page: agentbox + Online, Agents · Workflows · Inbox (count badge), the **usage meter**, **New task**, **Pause everything** (asks "Are you sure?", stops running agents and workflows, holds all schedules and queued runs, becomes **Resume everything** with a banner on every page). On phones: tabs at the bottom, the rest under Menu. **Inbox** with inline actions and an **Ideas** list (each idea → "Make it a task" or "Start a workflow").
2. **Workflows list** (same squircle grid, step icons on each tile, dashed "New workflow"), **4 templates**, and the **editor**: name, project, On/Off, Test run, Save, live sentence; steps as 160px squircles with app-drawn lines and arrowheads; **+** between steps and at the end; drag the dots to reorder (or arrow keys); "passed" / "needs work" lines drawn back to the chosen step or to "stop and tell me"; side panel (bottom sheet on phones) with ⓘ on every control; limits (rounds, time, usage); **Undo/Redo** (button and Cmd/Ctrl+Z, Shift+Cmd+Z); **Version history** with Restore; Make a copy; Delete.
3. **Describe it**: Claude (headless, no tools at all, JSON schema) drafts the steps and opens them in the editor, switched off. Tested for real twice.
4. **Workflow runner**: one worktree, one branch, one draft pull request per run, and every step comments its result on the PR. Live view: done steps ✓, the current one glowing with its "right now" line, waiting ones faded. Click a step to see what it did and "Show the full log". Run history under the canvas. Gates, loops, Ask me, Ship, Tell me. **Tested for real**: a full test run (quick step → review passed → check → Ask me approved from the Inbox → stopped before Ship); a loop run (review said "needs work" → back to the build step with the feedback → stopped after the round limit); Pause everything during a run; "Pick up where it stopped". Test pull requests #4, #5 and #6 were closed and their branches deleted.
5. **Projects page**: each project with open pull requests and last change; paste `owner/name`, pick one of the bot's repos, or "Make a new repo" (public, asks first). "Add a project…" is at the end of every project dropdown. Tested by cloning GitHub's sample repo (then removed it).
6. **Help bubbles** (ⓘ) on every setting, **empty states** that say what to click next, **errors** in plain words with **Try again** and **Ask Claude to fix this** (starts a Builder task with the error attached, in Plan first so you OK it). A page-level error screen and loading state.
7. **Polish**: beginner walkthrough of every page, consistency fixes, research of other tools (below), the welcome tour and **Help** page, and a final check: every page passes at both widths (no console errors, no sideways scrolling, tap targets 44px+, visible keyboard focus in a sensible order). The always-on service was reinstalled, runs v2, and came back by itself after I killed it.

### Usage meter: what I found (Claude Code 2.1.304)

- **`claude -p /usage --output-format json`** prints the plan's real numbers ("Current session: 16% used · resets Oct 20 at 3am", "Current week (all models): 29% used · resets Oct 25 at 3am"). It's a local command: `total_cost_usd` is 0 and it takes ~0.2 s. The panel asks every ~5 minutes.
- **Every headless run streams `rate_limit_event`** with `unifiedWindows.five_hour.utilization` / `seven_day.utilization` and `resetsAt` as a Unix time, plus `status` (`allowed` / `rejected`). These are fresher, so they win while runs are going; a `rejected` status marks you as out of usage until the exact `resetsAt`.
- **Each run's `result` event** has `total_cost_usd` and token counts. These are saved per run in SQLite (`runs.cost_usd`, `runs.tokens`) for the "today by agent / by workflow" split, shown as shares, not dollars (you're on a subscription, so dollars would mislead).
- The percentage is exact, not an estimate, as long as it was read in the last 20 minutes; otherwise it's labelled "about". It counts everything on your Claude account, not only agentbox, and the panel says so.
- I didn't use the status-line input: `/usage` and the stream events cover everything without needing an interactive session.

## v2: Not done / known limits

- **The Discord webhook wasn't exercised by workflows** in testing on purpose: test runs never send messages. The Tell me step uses the same Keychain item (`discord-heartbeat`) as v1, so it should work; a real (non-test) run will be the first to send one.
- **Ship (merge) wasn't run for real.** I didn't want to merge anything into main while you were asleep. It runs `gh pr ready` then `gh pr merge --squash`, and shows a plain message if GitHub refuses.
- **"Page loads" / "No console errors" on a Next.js project** starts the project's own `npm run dev -- --port N` in the workflow's copy. It works for typical Next/Vite projects; for unusual setups put a full https:// address in the step instead. I tested the gates directly against a static page and a live site, not inside a full workflow on this repo (that would build a second copy of the panel).
- **"Most usage per run"** is measured from the session meter, so other Claude use at the same time counts too. That's why the label says "about".
- **Workflow triggers from GitHub** (issue label, new pull request) check every 2 minutes and only count issues and PRs that appear *after* you turn the workflow on. I didn't test them end to end (that needs real issues or PRs on GitHub).
- **A workflow's step running out of usage waits and retries after the reset**, but a plain agent run that runs out mid-way still ends as Stopped (with Try again), as in v1.
- **Playwright** stays a dev dependency in `package.json`; the installer installs dev packages too, so the Check step has it. `npm install --save` didn't move it and I didn't want to hand-edit the lock file.

## v2: Decisions I made

- **Pause everything blocks new runs too** (New task, Run now, Test run) until you resume. It's an emergency brake, so nothing new should start by surprise. Per-agent Pause still works as in v1.
- **Queued runs** (out of usage, or past your Settings limit) show a gray **Waiting** pill and "Waiting for usage to reset at 3:00 AM". They start by themselves within 30 seconds of usage coming back, unless everything is paused.
- **The usage guard in Settings is off by default.** Turning it on starts at 90%, adjustable from 50 to 99%.
- **The Inbox shows** pending approvals, plans, pull requests waiting for review, runs that stopped in the last 7 days (not ones you stopped yourself), and workflow runs waiting at Ask me / Ship or that stopped. Stopped items have **Dismiss**. Pull requests have **Look at it**, **Merge it** (asks first) and **Ask Reviewer to check it**.
- **The home summary** ("N things need you") now counts the same things as the Inbox and links to it, so they never disagree.
- **Workflows always start Off** (templates, drafts and copies). **Run now** needs it On; **Test run** always works.
- **Shared branch** is `agent/wf-<workflow>-<task>-<run>`; the **pull request opens as a draft** after the first step that changes something, gets a comment from every step, and is marked ready for review when the run ends (unless it's a test).
- **Agent steps never push themselves**: even agents set to "Make changes" act as "Suggest changes" inside workflows, so the panel does all pushing on the shared branch. Workflow steps are also blocked from `gh pr merge`; only the Ship step merges.
- **Research** writes `research.md` on the branch. **Review** is look-only and uses Opus by default (a different model from Builder's Sonnet); it must end with `VERDICT: passed` or `VERDICT: needs work`, and the panel posts its review on the PR. Look-only agent steps end with `OUTCOME: all good / problems found`, which "Tell me → only if something's wrong" and "open an issue" use.
- **A Check with no tests in the project is "skipped", not "passed".** Automatic shipping needs every earlier Review/Check to have truly *passed*, so a skipped check makes it ask you instead.
- **No double asking:** if Ask me comes right before Ship, your OK there counts for Ship.
- **Ship merges with squash** (one tidy commit on main) and never ships agentbox-panel by itself, whatever the setting.
- **Send back from Ask me** goes to the nearest earlier agent step with your note, and doesn't count toward the "needs work" round limit (you asked for it). Time spent waiting for you doesn't count toward the run's time limit.
- **Pick up where it stopped** (inspired by n8n/Make, see below) continues a stopped run in the same copy and pull request. If a Review/Check stopped it, it goes back to the step it points to, with the feedback, and the round count starts over.
- **Panel restarts:** a workflow step cut off by a restart is started again automatically (v1 agent runs still end as Stopped).
- **Workflows ping Discord** when they wait for you or stop (never for test runs), since those need you.
- **"Ask Claude to fix this"** starts Builder on agentbox-panel in **Plan first**, so you see what it wants to do before it changes anything.
- **Describe it** uses Sonnet with no tools and a JSON schema; whatever comes back is cleaned (one Start first, "needs work" only to earlier steps, unknown agents become quick steps).
- **"Make a new repo"** makes a **public** repo under the bot, as the brief says, and asks first with a warning not to put secrets in it.
- **Help bubbles open on click/tap** (not hover), so they work on phones and with a keyboard; Escape closes them.
- **Phone layout:** Agents · Workflows · Inbox as bottom tabs; New task, Pause everything, Projects, Settings and Help under Menu. Projects, Settings and Help are also in a small footer on every page.
- **The welcome tour and the usage guard are saved in SQLite**, not the browser, so they carry across your laptop and phone.
- **Dev testing used a separate copy** (its own database, build folder and port 3100, with schedules off), so the always-on service and your data weren't touched until the final reinstall. I backed up `data/agentbox.db` to `/tmp` before reinstalling.
- **Test pull requests:** testing opened #4, #5 and #6 on this repo as drafts; I closed them and deleted their branches.
- **Claude usage:** testing used a fair share of this session (it went from 44% to about 87%). Nothing was left running.

## v2: Changes from the beginner walkthrough

- The home summary said "nothing needs you" while the Inbox had items → it now counts the Inbox and links to it.
- The agent page showed the stop reason twice → shown once, in the error box with Try again / Ask Claude to fix this.
- Workflows made from the same template all had the same name → numbered ("Build → Review → Ship 2").
- Workflow tiles were walls of text → a row of step icons above the sentence.
- Step notes showed markdown symbols (`**`, backticks) → plain text everywhere in the main UI.
- "up to 1 times" → "up to once / twice / N times".
- The workflow canvas didn't show that it scrolls sideways → a fade and arrow on the right edge when there's more.
- On phones the editor's Save bar would hide behind the bottom tabs → it sits above them.
- "5340 days ago" → months and years.
- Template previews showed a generic icon for Builder → the agent's own icon and color.
- Placeholder text was too light → darker, 4.5:1 contrast.
- Out of usage was only visible in the meter → also a line on the home page.
- A repeated "New task" button on phones pushed the page sideways → fixed.

## v2: Recommended next

What beginner tools do well that agentbox doesn't yet (from Zapier, n8n, Make, Relay.app, Lindy and Gumloop docs and reviews):

- **Run one step on its own** (Zapier "Test step", n8n "execute node"): try a single step without running the whole workflow. Faster to tweak a step, but it needs a way to fake the earlier steps' work.
- **An input form step** (Relay.app "Send input form"): a step that asks you a question and waits for your answer, not just yes/no. Useful for "which color do you want?" moments.
- **Memory between runs** (Lindy): agents remember what happened last time. Would stop Overnight repeating itself; needs care so old notes don't confuse it.
- **Notes on steps** (Make): sticky notes on the canvas to remind yourself why a step is there.
- **More templates and sharing** (Zapier, Lindy galleries): a dozen more starting points, plus export/import of a workflow as a file.
- **More ways to be told** (Make emails on errors, Relay.app Slack/email): email or phone push besides Discord.
- **Search and filter run history** (Zapier Zap history): only matters once there are many runs.
- **Weekly usage forecast**: "at this pace you'll run out Thursday", using the per-run history already being saved.

Sources: [Zapier help: Zap history and replay](https://help.zapier.com/hc/en-us/categories/14013973271565), [Testing Zaps before turning them on](https://www.temperstack.com/learn/zapier/test-zaps-before-activation/), [n8n: debug and re-run past executions](https://docs.n8n.io/workflows/executions/debug), [n8n: error handling](https://docs.n8n.io/build/flow-logic/handle-errors-gracefully.md), [Make: error handling overview](https://help.make.com/Overview-of-error-handling?hl=en), [Relay.app: human-in-the-loop steps](https://docs.relay.app/human-in-the-loop/human-in-the-loop-steps), [Lindy features review](https://nocode.mba/articles/lindy-ai-review), [Gumloop beginner guide](https://beginnersinai.org/how-to-use-gumloop/).

## v2: Needs Nic

Nothing new needs an admin password. The v1 items below still apply if you haven't done them yet (the `tailscale serve` command, and optionally protecting `main` on GitHub).

After you merge the v2 pull request, the service keeps running from this folder on `build/v2`. To switch it to `main`: `git checkout main && git pull && ./scripts/install-launchagent.sh`.

---

# v1

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
