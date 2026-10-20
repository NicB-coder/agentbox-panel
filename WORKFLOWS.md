# agentbox panel — v2: Workflows, usage meter, Inbox

Read `CLAUDE.md` (the v1 brief: design, rules, stack) and `NOTES.md` (what v1 built and decided) first.
Everything here must look and feel like the existing pages: same font, colors, status pills, squircle shapes,
plain words, and accessibility rules. It is for a beginner. If a screen needs explaining, simplify it.

## You are working unattended

Nic is asleep for about 8 hours. Do NOT stop to ask questions. Decide, write the decision in `NOTES.md` under
"v2 — Decisions I made", and keep going. Anything that needs sudo or is destructive goes under "v2 — Needs Nic".
Work on branch `build/v2` (from `main`), commit after each milestone, push, and at the end open ONE pull request.
Test each milestone with Playwright at laptop (1366px) and phone (390px) width.

## 1. One shared header on every page

Left: "agentbox" + Online dot. Middle: nav **Agents · Workflows · Inbox** (Inbox shows a count badge).
Right: the **usage meter**, then **New task**, then a **Pause everything** button (asks "Are you sure?",
stops running agents and pauses all schedules and workflows; becomes **Resume everything**).

### Usage meter (always visible)
- A compact pill: a small progress bar + "Claude usage 62% · resets 9:00 PM".
- Colors: normal under 75%, amber 75–94%, red at 95%+.
- When the limit is hit: "Out of usage · back in 2h 14m" (live countdown). New runs are **queued** and start
  automatically after the reset; the tile shows "Waiting for usage to reset".
- Clicking it opens a small panel: today's usage by agent and by workflow, and the reset times.
- Data: find the most reliable official source available to this Claude Code version. Check `claude --help`,
  the stream-json/JSON output of headless runs (per-run token and cost fields, any rate-limit or usage events),
  the status line input, and `/usage`. Record per-run usage in SQLite. If the exact plan percentage isn't
  available, show the best honest estimate labeled "about", and always capture the real reset time from
  usage-limit errors. Write what you found in NOTES.md.
- Optional guard in settings: "Pause new runs when usage passes [90%]".

## 2. Inbox

One list of everything that needs Nic, newest first: approvals (Allow/Deny, Approve plan), pull requests waiting
for review, failed runs, and workflows waiting at an "Ask me" step. Each row has the action buttons inline,
so most things can be handled without leaving the Inbox. Empty state: "Nothing needs you. Nice."

## 3. Workflows

A workflow is a chain of steps that passes work along, like n8n but simpler: **no free-form wiring**.
Steps snap into a left-to-right row (top-to-bottom on a phone) and the app draws the lines.

### Workflows list page
Same squircle tile grid as the Agents page. Each tile: name, its one-sentence summary, status pill
(Running / Needs you / Done / Stopped / On / Off), last run time. Last tile: dashed "New workflow".

### New workflow
A friendly start screen with two options:
- **Describe it:** a big text box, "What should happen?", e.g. "When I give it an idea, research it, build it,
  have it reviewed and checked against the research, then ship it." Claude (headless, Look only) turns it into
  steps and opens them in the editor. Nic always reviews before turning it on.
- **Start from a template:**
  1. **Build → Review → Ship:** Research, Build, Review (back to Build if changes needed, max 2 rounds), Tests pass, Ask me, Ship, Tell me.
  2. **Nightly site check:** Every night, Site Checker, if problems then Tell me plus open an issue.
  3. **Research report:** Research a topic, write a short report as a PR to a `reports/` folder, Tell me.
  4. **Ideas to pull requests:** When a GitHub issue gets the `agent` label, Build, Review, Ask me.

### The workflow editor
- Top: name, project, On/Off switch, **Test run**, **Save**, and the live plain-English sentence describing the whole flow.
- Canvas: steps as smaller squircle tiles (about 160px, radius 40px, same thin border and colored stripe as agent tiles)
  joined by simple lines with arrowheads. Between any two steps and at the end: a round **+** to insert a step.
  Steps can be reordered by dragging; lines redraw automatically. A step with a fail path shows two short labeled
  lines: "passed" (to the next step) and "needs work" (curving back to the chosen step, or to "Stop and tell me").
- Clicking a step opens a side panel (bottom sheet on phone) with that step's settings, in the same control style
  as the agent editor, every control with an ⓘ help bubble.
- Step types, in plain words, with an icon each:
  - **Start:** When I start it · On a schedule · When a GitHub issue gets a label · When a pull request opens.
  - **Agent step:** pick an existing agent, or "Quick step" with its own short prompt. Choose work mode and time limit.
  - **Research:** looks things up and writes `research.md` on the branch for later steps to use.
  - **Review:** a reviewer agent checks the PR against the task and `research.md`. Its result is "passed" or "needs work"
    with comments on the PR. Prefer a different model from the builder (e.g. Opus reviews Sonnet's work).
  - **Check:** hard gates, not opinions: tests pass · page loads in a real browser · no errors in the console.
  - **Ask me:** waits for Nic in the Inbox (Approve / Send back / Stop).
  - **Ship:** merges the PR (deploys follow from GitHub/Vercel if set up). Default **Ask me before shipping**. "Ship
    automatically" is allowed only if every earlier gate passed, and is never allowed for the agentbox-panel repo.
  - **Tell me:** Discord message (webhook in Keychain as `discord-heartbeat`), with a summary and links.
- Limits on every workflow: max "needs work" loops (default 2), max total run time, max usage per run.
- **Undo** (Cmd+Z and a button) and **Version history** (restore an earlier version).

### Running a workflow
- All steps share one branch and one pull request. The PR is the shared workspace: agents read the task, the
  research and earlier comments from it, and write their results there.
- **Live view:** the canvas shows the run: done steps ✓, the current step glowing with its one-line "right now"
  text, and waiting steps faded. Click any step to see what it did, with its log behind "Show the full log".
- **Test run:** runs the whole workflow but stops before Ship and doesn't send Discord messages.
- Run history under the canvas, like the agent page history.
- Reuse the v1 task runner, approvals and hooks. Never push to main, and keep the force-push/main block in every mode.

## 4. Projects

A simple Projects page (reached from the project dropdowns via "Add a project…"): paste a GitHub repo
("owner/name") or pick from the bot's repos, and it is cloned into `~/projects` with `gh`. Show each project with
its open PRs and last activity. A "Make a new repo" option creates a public repo under the bot and clones it.

## 5. Beginner touches everywhere

- An ⓘ help bubble on every setting, in one plain sentence.
- Empty states always suggest the next click (e.g. "No workflows yet. Start from a template").
- Errors in plain words with **Try again** and **Ask Claude to fix this** (starts a Builder task with the error attached).

## 6. Ship-ready polish (treat this as a product that goes on sale tomorrow)

After the features work, do a full product pass. This matters as much as the features.

**a. Beginner usability review of every page.** Pretend to be a first-time user who has never coded.
Walk through every page and flow with Playwright at laptop and phone width (first visit, add a project, make an
agent, start a task, approve something, build a workflow from a template, build one by describing it, test run,
running out of usage, pausing everything). For each screen ask: is it obvious what this is and what to do next?
Are any words jargon? Is anything cluttered, inconsistent, or hidden? Fix what you find. Keep a list of what you
changed in NOTES.md.

**b. Consistency.** Same header, spacing, corner radii, buttons, pills, empty states, loading states and error
messages everywhere. Pages must feel like one product.

**c. Compare with other simple platforms.** Research how beginner-friendly automation and agent tools handle this
(for example n8n, Zapier, Make, Lindy, Relay.app, Gumloop; look at their current docs and product pages). List
features that are important for beginners and missing here. Build the ones that are high value and fit the
product's simplicity. Put the rest in NOTES.md under "v2 — Recommended next", each with one line on why.

**d. First-run experience.** A short welcome tour on the first visit (3–4 steps, skippable), and a simple **Help**
page: what agents, workflows, the Inbox and the usage meter are, in plain words, with "try this first" suggestions.

**e. Ideas list.** A simple list on the Inbox page where Nic can jot ideas. Any idea can become a task or start a
workflow with one click.

**f. Final check.** Every button does something, nothing errors in the console, every page works on a phone,
contrast and keyboard navigation pass, and the always-on service runs the final version.

**Priorities if time or usage runs short:** finished and polished beats more features. Never leave a half-built
feature visible in the UI. Hide it and note it in NOTES.md instead.

## Milestones (in order, without stopping)

1. Shared header with usage meter, Pause everything, and the Inbox.
2. Workflows list, templates, and the editor (with undo and version history), saved to SQLite.
3. "Describe it" drafting with Claude.
4. Workflow runner: live view, test run, gates, loops, Ask me, Ship, Tell me.
5. Projects page.
6. Help bubbles, empty states and error handling across all pages.
7. Ship-ready polish (section 6, a to f). Reinstall the LaunchAgent so the always-on service runs the final
   version, and confirm it restarts.

Goal: when Nic wakes up, this should be one prompt away from finished.

Finish by updating `NOTES.md` (v2 sections: done, not done, decisions, what Nic should click first) and open the PR.
