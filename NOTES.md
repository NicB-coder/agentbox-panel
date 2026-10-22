# NOTES

# v3: simpler, fully in the panel, deep research

## v3 — What Nic should click first

1. **New task** (top right). Type something small and real, like "make the arcade's home page title friendlier", pick **arcade**, leave **Careful** on, press **Start**. A new agent appears, named after the job. Watch its tile: the step it's on, what it's doing right now, and time so far. A second AI reviews and fixes the work before it reaches your **Inbox**.
2. In the Inbox, press **Look at it**: what it did in plain words, **before and after pictures**, and the code behind a toggle. Then **Merge it**, or **Send back with a note**. When it's merged you get a **Shipped** item with a **Play** button.
3. **New task → Research something**, and ask a question you actually care about. You get a report with a short answer first and every source linked, and a PDF if you want one.
4. Look at **Machine** and **Connectors** (Menu on your phone, or the footer). On Connectors, connect anything you'd like agents to use (Slack, Notion…) through claude.ai.

## v3 — Done

All 7 milestones, each committed and pushed on `build/v3` and tested with Playwright at 1366px and 390px on a separate dev copy (its own database copy, port 3100, schedules and Discord off; from milestone 4 on, a real production build):

1. **Leftovers** were already on main. **One agent per job**: premade agents archived (Heartbeat stays), New task makes a job-named agent, **Add a follow-up** continues the same job (same branch and pull request), **Archive** with an Archived filter. **One Start a task panel** used by New task, follow-ups, Inbox ideas and the Helper, with Freedom, Careful/Quick, When does it run (pickers and "Next run" shown at once) and More options; short labels with ⓘ bubbles.
2. **Careful mode** (build → review by the other model → fix, up to 2 rounds → polish → final check → Inbox with "Reviewed ✓ · 2 fixes made · optimized"). **Never lose work to usage limits**: runs wait and carry on in the same conversation (this happened for real during testing). **Ran out of time** with **Keep going (+30 min)**. **Big jobs** with milestones, checkpoints, a usage budget, hold-small-runs, brief files. **Runs survive panel restarts** (their own launchd jobs; tested by restarting mid-milestone) and resume after a Mac restart. Old copies tidied after 3 days. Sign-in problems show **Sign in again**.
3. **Projects** in the header, **See what changed** for any pull request (pictures, code toggle, comment, send back), **Preview / Play**, **Update agentbox** with a side-by-side build and **automatic rollback** (tested with a good update, a broken build and a version that wouldn't start), **Install it** for jobs that change the panel, **Machine** page, **Terminal** page.
4. **Busy tiles** (tint, pulsing dot, right-now line, step x of y, time so far; running and waiting ones first; workflow tiles show their step). **Shipped** items in the Inbox with Play, louder and logged Discord messages, and the Tell me investigation (below). **Workflows**: the "What should this workflow make?" box, labeled step instructions, Freedom and Careful/Quick in steps.
5. **Deep research** with the Report page, PDF and Markdown, Reports in the Inbox, save to project, and the same method for workflow Research steps.
6. **Connectors** page, per-task and per-step choices, and "send, delete or book asks first" (tested with a real Gmail send that I denied).
7. **Helper** knows v3 and opens Start a task filled in; it answers by itself after a usage reset. **Beginner walkthrough** of every page at both widths (below), README, these notes.

`npm test`: 31 of 31 pass (no app, no Claude usage). Type check and production build pass. Every page passes the browser check at both widths (no console errors, no sideways scrolling, tap targets 44px+).

## v3 — Changes from the beginner walkthrough

- Agent pages and the Inbox showed an agent's raw formatting (backticks around file names) → plain text everywhere.
- After a follow-up, both the old and the new run said "Needs you" for the same pull request → the follow-up takes over the pull request and the old one says "Continued in a follow-up".
- Research jobs talked about branches and buttons in their follow-up box → research wording ("Ask more about the same topic. It builds on the earlier report.").
- A research report that a reviewer flagged and the researcher then corrected still said "a few things still need a look" → "Reviewed and corrected ✓".
- The Help page, welcome tour and help texts still described Builder and "Add an agent" → rewritten for v3 (Start a task, Careful, Freedom, follow-ups, Shipped, reports); the safety list mentions connectors and automatic rollback.
- Look steps in workflows showed a hammer → an eye.
- The phone Projects page scrolled sideways, and two small links were hard to tap → fixed.
- Typing quickly in the Terminal could arrive out of order → keystrokes now go out in order.
- The Start a task panel could show "None connected yet" right after a restart → it fetches the current connectors when you open More options.
- The header was crowded at laptop width → the usage meter shows the short form until very wide screens.

## v3 — Not done / known limits

- **Preview / Play only works for plain HTML/CSS/JS sites and games** (or an already-built folder). Projects that need `npm run dev` (Next.js, Vite) can't be previewed or photographed yet; See what changed just leaves the pictures out for them.
- **A Mac restart was simulated, not done for real.** I tested a session being cut off (the panel restarting, a session killed) and the "carry on with --resume" path, but didn't restart the Mac while you were away.
- **Sign in again** opens the Terminal with the right command typed in; I didn't run it for real, so as not to sign the bot or Claude Code out.
- **Connectors**: Slack, Notion, Linear, Figma and Canva show "Not connected" until you connect them in claude.ai. Connecting other MCP servers by address isn't in the panel.
- **A job's Settings page doesn't have the Connectors choice** (pick them in Start a task, or per follow-up).
- **The Helper's auto-answer after a usage reset** shows up in an open chat the next time you open or switch chats, not live.
- **Big jobs that change the panel itself** were tested on arcade, not on agentbox-panel. The prompt tells such agents to test on their own dev copy (`scripts/dev-copy.sh` with its own port), and **Install it** uses the update flow that was tested with rollback.
- **Hydration warning**: once during testing the home page reported a one-off mismatch between server and browser text (a time label crossing a minute). I couldn't reproduce it.
- **Week usage**: building and testing v3 used a fair share of this week's Claude usage (the weekly meter was at 80% when I finished).

## v3 — Needs Nic

Nothing needs an admin password.

- **Switching the always-on panel to v3**: your `build-v3.sh` script merges this pull request and runs `./scripts/install-launchagent.sh` by itself once I create `BUILD_V3_DONE`. If you'd rather do it by hand: `cd ~/projects/agentbox-panel && git checkout main && git pull && ./scripts/install-launchagent.sh`. After that, use **Settings → Update agentbox** for future updates.
- **On first start, v3 archives Builder, Reviewer, Site Checker and Overnight** (history kept; Unarchive any of them from the Archived filter). Their schedules stop.
- **Optional: connect more apps** at claude.ai → Settings → Connectors (signed in with the same Claude account), then press Check again on the Connectors page.
- The v1 items still apply if you haven't done them (`tailscale serve`, protecting `main` on GitHub).

## v3 — Decisions I made

- **HELPER.md doesn't exist** in the repo (or anywhere I could find). I used the Helper sections of NOTES.md (v2.1) and the code instead.
- **Leftovers (section 0) were already on `main`**: Create it twice, fixed labels for risky buttons, pruning busy chats, the tools secret and the 25 unit tests all merged in #10 (commit 12caf61). Nothing left to do there.
- **The premade agents are archived once**, the first time v3 starts (a `v3Migrated` setting makes sure it never happens again, so if you unarchive one it stays). Their history and pull requests are kept. Heartbeat stays on the grid. Workflow steps that point at Builder or Reviewer still work.
- **New task names the agent after the job**: a quick guess straight away ("Read README"), then a better 2–4 word name from Claude Haiku a few seconds later ("Project README summary"). If you rename it yourself first, your name wins. Colors rotate so the grid stays varied; the icon follows the kind of job (hammer = build, eye = look only, book = research, moon = scheduled).
- **The agent editor is now "Settings"** on each job (same Freedom / Careful / When controls as the Start a task panel). It's there to change the schedule or name; the page nudges you to **Add a follow-up** for new work instead of rewriting the job.
- **Follow-ups**: if the job's pull request is still open, the follow-up works on that same branch and the same pull request gets the new commits. If an earlier run stopped part-way, the follow-up continues in that same copy. Otherwise it starts a fresh branch. The follow-up's prompt includes the job, every earlier run with its result and pull request, and the follow-up itself. The Inbox shows a shared pull request once.
- **Follow-ups don't have a "When does it run?"**: a follow-up is "do this next", so it starts now. Scheduling belongs to the job itself (Settings).
- **"Add an agent" is gone**: the dashed tile is now **Start a task**, and old `/agents/new` links open the Start a task panel.
- **Freedom mapping**: Look only = reads and reports; Check with me first = Plan first (you approve its plan, then it works and opens a pull request); On its own = auto, always a pull request. "Ask me each step" (under More options) still exists for the rare times you want it.
- **"Ask Claude to fix this"** now starts its own new job on agentbox-panel ("Check with me first", Careful) instead of borrowing Builder.
- **Agent runs no longer live inside the panel.** Every Claude Code session an agent runs is its own launchd job in this account (`com.agentbox.run.<tag>.<run>-<n>`, with a small supervisor `scripts/proc-runner.mjs`). Its output goes to files; the panel reads them every 1.5 seconds and remembers how far it got, so after a panel restart or update it simply reattaches. Tested: restarted the dev panel in the middle of a milestone and the session kept going, then was picked up again ("The panel restarted. Reattaching to its session."). If a session is cut off for real (Mac restart), the panel carries on in the same conversation with `--resume` once the agent account is logged in and the panel is back ("Resumed after restart").
- **Careful mode** = build (Fast/Sonnet by default) → review by the *other* model (Opus) → fix (the builder's same conversation) up to 2 rounds → polish and optimize → final check by the other model → one last fix if the final check still finds something → pull request. The pull request body includes "Reviewed ✓ · N fixes made · optimized" and every review behind a fold. If the build changed nothing, there's nothing to review and no pull request.
- **Quick pull requests still get read by a reviewer**, automatically, after they open (Opus, look only, on a copy of the pull request's branch). The Inbox shows "Reviewed ✓ Nothing to fix" or what it found with **Send back to fix**. "Get a second opinion" (under More) uses the other model from the last review.
- **Send back to fix / Send back with a note** start a follow-up on the same job, so the same pull request gets the fix.
- **Time limits count working time only** (not time waiting for your OK, for usage, or while the Mac sleeps). Defaults: Quick 30 min, Careful 60 min, Look only 20/30 min, Research 60 min. Hitting it shows **Ran out of time** (amber, not red) with **Keep going (+30 min)**, which continues in the same copy and conversation.
- **Usage limits never stop a run.** It shows **Waiting · back at 12:41 AM** and continues in the same conversation at the real reset time (from Claude's own rate-limit event), or every 30 minutes if no time is known. This happened for real during testing: my Careful test run hit the real limit at 12:24 AM and finished by itself after the 12:41 AM reset.
- **Newer scheduled runs dismiss older stopped ones** of the same agent in the Inbox.
- **Big job** (More options): no time cap. A first session splits the job into 3–10 milestones; then one fresh session per milestone, with the earlier milestones' summaries and a written handoff (also in `.agentbox/progress.md` in its copy). After each milestone it commits, pushes the branch (a draft pull request appears after the first one) and pings Discord if "Finished" is ticked. It stops only if it passes its **usage budget** (points of the weekly meter, default 40, carried across weekly resets), which you can raise any time on its page. "Hold small runs" makes scheduled runs of other agents wait until it's done; the waiting ones are listed on its page.
- **Long briefs**: attach a .md/.txt (up to ~400 KB) or pick one from the project. It's stored with the job (`data/briefs/`) and put in the agent's copy as `.agentbox/brief.md`, which is never committed.
- **Sign-in problems** (Claude Code or GitHub) show **Sign in again** instead of a vague error. It links to the Machine page's sign-in section.
- **Old copies are cleaned up** 3 days after a run ends. A stopped run's unfinished work is committed and pushed to its own branch first, so nothing is lost.
- **Connectors** are blocked unless ticked for the task, and anything that sends, deletes, books or changes something in a connected app asks you first (and is never allowed in Look only). This is in the safety hook now; the Connectors page comes in milestone 6.
- **Test pull requests**: arcade #2 and #3 were made by my tests on the dev copy. I'll close them and delete their branches before handing over.
- **Projects is in the top header** (Agents · Workflows · Inbox · Projects; a 4th tab on phones). Machine and Terminal are in the phone menu and the footer.
- **See what changed** (`/changes?pr=…`) works for any pull request, made by agentbox or not: what it did in plain words, the Careful line or the reviewer's findings, before/after pictures at laptop and phone width when the project is a page or game (taken with Playwright from previews of both versions, cached), the code changes behind **Show the code changes**, and **Merge it / Send back to fix / Send back with a note / Comment**. "Look at it" in the Inbox and on agent pages opens it; GitHub is one click further. Pull requests agentbox didn't make get a reviewer automatically the first time you open them (once per 6 hours at most).
- **Send back to fix on someone else's pull request** starts a new Careful job that works on that pull request's own branch, so its commits update the same pull request.
- **Preview / Play** serves a project's files from a read-only copy of a branch, at `/preview/<project>/live/` (what's on main now) or a pull request's branch, inside the panel, so it works over Tailscale with no extra ports. A site that links to "/style.css" still gets its own file (the panel looks at where the request came from). **Only plain HTML/CSS/JS sites and games** (or an already built `dist/`, `public/`, `docs/`… folder) can be previewed; projects that need `npm run dev` (Next.js, Vite) can't yet. Projects with an index.html get a **Play** button.
- **Update agentbox** (Settings and Help): builds the new version *next to* the running one (`.next-a` / `.next-b`, the active one is named in `.active-build`), test-starts it on port 3001 with a copy of the database and nothing running, then switches and checks the panel answers with the new version. If the build or the test start fails, nothing changes. If the new version doesn't come up after the switch, it switches back by itself. It runs as its own launchd job so it survives the restart. The LaunchAgent now starts the panel with `scripts/start-panel.sh`. Tested on a throwaway copy of the panel with its own LaunchAgent and a local stand-in for GitHub: a good update (installed), a broken build (refused, old version kept running, folder restored) and a version that builds and passes the side test but won't start for real (switched, didn't come up, rolled back by itself after ~2 minutes).
- **Install it**: a finished job on agentbox-panel shows **Install it** instead of Merge it: it merges the pull request and runs the same update with the same rollback. "Install when finished" (a big-job option for agentbox-panel) does it automatically after the final review passes.
- **Machine page**: battery and charging, disk space (and how much the agents' copies take), how long since the Mac restarted, when the panel started, Tailscale, heartbeat, version, and who's signed in (Claude, the GitHub bot, Discord, and people logged in to the Mac). A red banner on the home page and Machine page when disk space drops under 15 GB.
- **Sign in again** opens the Terminal page with the sign-in command already typed (`claude auth login` or `gh auth login … --web`); you press Enter and follow the link it prints. I didn't run either for real, because that could have signed the bot out while you were away.
- **Terminal page**: a real shell as the agent account (xterm.js in the page, a small Python pseudo-terminal bridge on the Mac, so no native add-ons). One terminal at a time; it stays where you left it when you leave the page, and **New terminal** starts over. On phones there's a box to type a command plus Tab, Ctrl-C, ↑, ↓ and Esc buttons. Two new packages: `@xterm/xterm` and `@xterm/addon-fit`.
- **Changes from other websites are blocked.** Since the panel can now run commands, any button press (POST) from a page on another website is refused (it checks the browser's `Sec-Fetch-Site` / `Origin`). The agents' safety hook and the panel's own pages are unaffected.
- **Why the arcade workflow's Tell me step was "silent"**: I couldn't find a failure. The webhook is valid, and the step's record says Discord accepted the message on Oct 20 at 4:47 PM. But it was a plain message with mentions switched off, in the same channel as the hourly heartbeat posts, so it arrived without a sound and got buried. Fixes: (1) every message now waits for Discord to confirm it was posted (`?wait=true`), retries once, and is written to a log you can see in **Settings → Discord messages**, with a **Send a test message** button; (2) "Shipped: …" and "needs your OK" messages are a clear card with a title and **@here** so your phone makes a sound (two switches in Settings, both on); (3) every ship also lands in the Inbox as **Shipped: <name>** with what changed, **Play** (for sites and games) and the pull request. It stays marked New until you open it or press Got it.
- **Inbox filters**: All · Needs you · Done & shipped · Reports. Opened Shipped items stay under their filter for a week. The red badge counts things that need you plus new Shipped items.
- **Busy tiles** (home and Workflows) get a 7% tint of their color, a gently pulsing dot, the task in a few words, a live "right now" line, "Step 3 of 6" with a small bar, and time so far. Running ones and ones that need you come first.
- **Workflows**: a big **What should this workflow make?** box at the top (saved with the workflow and its version history). Run now and Test run open with it filled in and editable; automatic runs use it. Each step's own instructions are labeled **This step's instructions**. Build/Look steps use the same **Freedom** and **Careful / Quick** controls as tasks. The templates no longer use the archived Builder or Site Checker: their build steps are fresh agents with written instructions. Old workflows that still name Builder keep working.
- **The test copy now runs a real production build** (`scripts/dev-copy.sh`), not the hot-reloading dev server. The dev server kept reloading pages in a loop after many code changes, which is a dev-tool problem, not the app's. `AGENTBOX_DEV_MODE=dev` still gives the old behaviour.
- **Deep research** is a choice at the top of Start a task (Build something · Research something). A research job plans sub-questions, searches widely, reads the actual pages, cross-checks claims between sources, uses parallel sub-agents for big questions, and writes a report: **short answer first**, then sections, a **What's uncertain** list (each flagged ⚠️), and **every source as a numbered link**, with each claim tied to its sources by number. Defaults: Smartest, 60 minutes, Careful (a second model, here Sonnet, opens the sources and checks the report against them; the researcher then corrects it). It's always Look only: research never changes anything, and connectors that would send or change something are refused. Tested for real: "Why do simple browser games run slowly on phones?" took about 2 minutes; the reviewer found problems, the report was corrected, and it's shown as "Reviewed and corrected ✓".
- **The Report page** (`/reports/N`) has **Download PDF** (printed by a real browser on the Mac, without the panel's header and buttons) and **Download Markdown**. Reports get their own Inbox item ("Report ready", under the **Reports** filter) and a **Read the report** button on the job's page. **Save the report in the project** (More options, when a project is picked) adds it to the project's `reports/` folder as a pull request. A follow-up question on a research job builds on the earlier report.
- **Research steps in workflows** use the same method and report format, written to research.md for the later steps.
- **Connectors page** (footer and phone menu): Gmail, Google Calendar, Google Drive, Google Sheets, Claude Docs, Slack, Notion, Linear, Figma, Canva and GitHub, each with Connected / Not connected, what it lets agents do, and what always asks first. Status comes from Claude Code itself (`claude mcp list`), checked every few minutes or with **Check again**. Apps you've connected in claude.ai but aren't on the list show up too.
- **Connecting goes through claude.ai**, because Claude Code on this Mac uses your Claude account's connectors (Gmail, Calendar, Drive, Sheets and Docs were already connected). **Connect** walks you through it: claude.ai → Settings → Connectors → Connect → back to agentbox → Check again. A connector that needs signing in again gets **Sign in again** (the Terminal, with `claude mcp login --no-browser …` typed in). GitHub works through the bot's own login and is always on.
- **Per task (More options) and per workflow step**, you tick which connectors it may use; every other one is blocked for that run. Anything that sends, replies, forwards, deletes, shares, books or changes events asks you first (Allow / Deny in the Inbox and on the agent's page), and is simply refused in Look only. Tested for real: a task with Gmail ticked tried to send an email, it showed "Gmail: send message" waiting for my OK, I pressed Deny, and nothing was sent.
- **Helper**: it knows every v3 page and control (Start a task, follow-ups, Careful, big jobs, See what changed, reports, Connectors, Machine, Terminal, Update agentbox). Its "Set up this task" button opens the Start a task panel filled in (a new job), or a follow-up on an existing one. For a one-off job it now offers that instead of making an agent; its agent preview cards are kept for repeating jobs. Replies stay short, with the calm typing and the "↓ New text" button from v2.1.
- **The Helper waits out usage limits too**: a question asked while you're out of usage is saved with "I'll answer this by myself at 6:12 AM", and is answered automatically after the reset (or 30 minutes later if the reset time isn't known). Tested on the dev copy. If the chat is open at that moment, the answer shows the next time you open or switch chats.
- **Dev copy for testing**: `scripts/dev-copy.sh` (port 3100, its own copy of the database, schedules and Discord off, its own build folder; run numbers in the copy start 10,000 higher so their branches never clash with real ones).

# v2.1: the Helper chat bubble

## v2.1: What Nic should click first

1. **Do the one "Needs Nic" step below** (switch the always-on service to this version after you merge).
2. **Tap the round black bubble** in the bottom-right corner of the home page and press **What's running right now?** Agents, runs and pages it mentions are chips you can tap.
3. **Open an agent that stopped** (or the Inbox) and ask **Why did this stop?** It reads the real log and answers in plain words, usually with a **Try again** button.
4. **Type "Make me an agent that…"** and finish the sentence. It may ask one or two questions, then shows a preview card. **Create it** saves it switched Off and opens it in the normal editor so you can check it and turn it on.

## v2.1: Done

All 5 milestones, each tested with Playwright at 1366px and 390px on a separate dev copy (its own database copy, port 3100, schedules off):

1. **Bubble + chat panel + saved conversations + streaming replies.** 56px black bubble with a white chat icon on every page (above the tabs on a phone). The panel: "Helper", **New chat**, **Earlier chats**, close. Nic's messages on the right (dark), the Helper's on the left (light gray). "Thinking…" shows in about 0.15 s and replies stream in word by word (typical answer: 4 to 8 s). Chats are saved in SQLite, survive reloads and page changes, and work across laptop and phone (last 20 kept). Escape closes it and puts focus back on the bubble.
2. **Live snapshot + read-only lookups.** Every message sends where you are (page, the open agent or workflow, the selected step, the run on the canvas, what you've typed in the agent editor, any error on screen) and a fresh snapshot of everything (agents, recent runs with their steps and the end of their logs, workflows and live runs, Inbox, ideas, usage numbers and reset times, projects, heartbeat). It can look up more with 8 read-only tools: a run's full log, a run's details, an agent's full settings, a workflow's steps, a workflow run step by step, a pull request's live state (via `gh`), projects, heartbeat. Nothing it has can change anything.
3. **Suggested questions per page, chips, action buttons.** 2–3 questions under the box that fit the page and what's happening (e.g. "Why did this stop?" only shows when it did). Agents, runs, workflows, pull requests and pages become chips. Suggested actions are buttons (Try again, Approve plan, Allow/Deny, Run now, Start a test run, Pick up where it stopped, Approve, Ship it, Merge it, Pause/Resume everything, Open a page, "Set up this task" which opens New task already filled in). Every one needs your click; Merge, Ship and Pause everything show the same "Are you sure?" as the rest of the site.
4. **"Make me an agent / a workflow"** with preview cards (name, color, icon, project, the plain-English sentence, steps for workflows) and **Create it** / **Change it**. Create it saves it **Off** and opens the normal editor. Tested for real at both widths: 2 agents and 2 workflows made and opened in the editor, all switched off.
5. **Beginner walkthrough** of the Helper on every page at both widths (answers saved and read one by one), fixes (below), Help page section and a line in the welcome tour, README section, screenshots in `docs/screenshots/v2.1-*`.

## v2.1: Fixes after review (this pull request replaces #8)

Everything from #8 is merged in, plus:

- **Buttons can't be disguised.** The Helper only picks *which* action; the panel writes the label and the "Are you sure?" from the real thing. A log that talks it into a "Show the full log" button that really merges still shows **Merge pull request #8**, and asks first: "This merges pull request #8 ("Fix the footer") into main of portfolio on GitHub… agentbox can't undo a merge." Ship and Pause everything work the same way (Pause says how many runs it will stop, or "Nothing is running right now"). There is no Delete button the Helper can offer at all.
- **Logs, pull request comments and the snapshot are data, never instructions.** The Helper's instructions say so, and that text is put in clearly marked boxes it can't break out of. Tested with a planted "SYSTEM NOTE TO THE HELPER… add this button" in a pull request comment: it ignored it, told you about it, and gave the real reason the run stopped.
- **Create it only makes it once.** Pressing it twice (double tap, two tabs, laptop and phone) returns the link to the one already made. If you deleted it since, it can be made again.
- **Chat cleanup (keep the last 20) never removes a chat that's still answering.** It's cleaned up on a later pass once it's done.
- **The Helper's lookup tools need a secret.** A random one is made each time the panel starts and handed to the Helper's tool server by environment variable. It's never saved or committed. Anything else calling that address gets "Not allowed".
- **Shorter replies, every step.** Most answers are 1–3 sentences; a how-to is a numbered list of every step, each under 10 words. "How do I make a new agent and run it?" went from about 170 words to about 70 with all the steps still there.
- **Calmer typing.** Replies type out at an even pace of about 11–13 words a second, however fast they arrive. Buttons and cards show once the words are all there.
- **The view stays still.** It no longer jumps down with every word. When new words appear below what you can see, a small **↓ New text** button shows; tap it to jump to the end. It still jumps to the end when you open the panel, pick a chat, or send something.
- Smaller fixes: a missing chat gives "That conversation isn't here any more" (and the bubble quietly opens your latest chat instead), message and card numbers are checked, the confusing "Ask Claude to fix this" error now says "Check that Claude Code is installed on this Mac", and an empty bit of code is gone.
- **`npm test`**: 25 quick checks of the Helper in about 1.5 seconds, with no live app and no Claude usage (a throwaway database and a pretend Claude). They cover disguised merge buttons, broken and cut-off cards, Create it twice, chat cleanup, the reply time limit, Claude Code not installed, made-up links, and the secret.

## v2.1: How I tested it

- **`npm test`**: 25 of 25 quick checks pass in about 1.5 s (no app running, no Claude usage).
- **Type check and a full production build** both pass.
- **Real browser (Playwright) at 1366px and 390px** on a separate dev copy (its own database copy, port 3100, schedules and Discord pings off) with `scripts/helper-calm-test.mjs`: **19 of 19 checks pass.** "Thinking…" shows in under 5 ms; words type at 10–13 a second; the view doesn't move while typing; **↓ New text** jumps to the end; the how-to answer is 66–76 words with numbered steps; a planted instruction in a pull request comment was ignored (no disguised button, no Pause everything) and the real reason (30-minute time limit) was given; two **Create it** presses at the same moment made 1 agent and returned the same link, and the card's own button then opened that same agent.
- **The "Are you sure?" for Pause everything** checked by eye in the browser (screenshot `docs/screenshots/v2.1-helper-are-you-sure.png`); I pressed Cancel.
- **API checks by hand:** the tools address answers 403 without the secret, a missing chat gives 404, a card number that isn't a number gives 400.
- The live panel on port 3000 was left alone and still answers.

## v2.1: Changes from the beginner walkthrough

- It sometimes started with "The snapshot already shows the log…" → it now starts straight with the answer and never talks about how it knows things or uses run numbers.
- It named files ("package-lock.json") → it now says "the list of packages" instead of file names.
- On a stopped agent's page it suggested both "What does this error mean?" and "Why did this stop?" → only the second.
- A workflow step's settings panel sits exactly where the bubble is → while a step's panel is open the bubble steps aside, and the panel gets its own **Ask** button ("What does this step do?" / "What did this step do?").
- Nobody would know the bubble is there → the Help page has a "The Helper" section with **Ask the Helper**, and the last welcome-tour card says "Stuck? Tap the round chat bubble in the corner".
- When an error box shows on a page, the bubble gets a red dot, and the empty chat offers "I see an error on this page. Want me to explain it?"
- Checked that it's honest: asked "How many pull requests did Builder open last week?" it said it couldn't see that far back and pointed to Projects and GitHub instead of guessing. Asked to delete an agent, it said it can't and explained where Delete is.

## v2.1: Not done / known limits

- **The always-on service still runs the old version** until you merge and reinstall (see Needs Nic). I wasn't allowed to touch the live panel.
- **A reply can't be stopped halfway.** It's cut off after 2.5 minutes at most. While one reply is being written, a second question to the same chat waits ("Wait a moment, the Helper is still answering").
- **The Helper sees what's typed only in the agent editor** (and whether the workflow editor has unsaved changes). Other forms aren't sent.
- **Pressing Escape with a step panel and the Helper both open closes both.**
- **The browser tests of the Helper use real Claude usage** (`helper-test.mjs` and `helper-calm-test.mjs` a little, `helper-test2.mjs` and `helper-walkthrough.mjs` more). `npm test` uses none.
- **A pull request comment can still mislead the Helper's words** (for example, give a wrong reason). It can't make a button do something other than what its label says, and risky ones always ask first. Read the log yourself before merging anything important.

## v2.1: Decisions I made

- **Branch:** the brief said `build/helper`, but this run was told to use its own branch. The first version was on `agent/builder-its-usual-job-5` (#8); the fixes merged it into `agent/builder-fix-the-open-helper-22`, whose pull request replaces #8.
- **All button labels are written by the panel**, not only the risky ones: Try again, Approve plan, Allow, Deny, "Run Builder now", "Open the Inbox" and so on. Simpler, and a harmless-looking label can never sit on a different action.
- **The tools secret is made fresh at each start** (32 random bytes) instead of being stored in the Keychain: nothing to set up, nothing that can leak into git, and only the Helper's own tool server ever gets it. `AGENTBOX_HELPER_SECRET` can override it if ever needed.
- **Typing pace:** one word every 75 ms (about 13 a second, still faster than reading), a little faster only when far behind so a long reply doesn't drag. If your Mac is set to "Reduce motion", replies show without the typing effect.
- **Tests without extra packages:** `npm test` uses Node's own test runner and its built-in TypeScript support, with a 30-line loader (`tests/register.mjs`). The color and icon lists moved to `lib/choices.ts` so the tests don't need the UI code.
- **Fix dev copy:** `/tmp/agentbox-dev-22`, port 3100, schedules off, Discord pings off, my own live run marked done in the copy only, plus one pretend stopped Reviewer run whose log hides a sneaky instruction. Your real database and the always-on service weren't touched.
- **Cheapest reliable option:** Claude Code headless (`claude -p`) with **Sonnet**, the same tool the rest of the panel already uses, so it shares your login and shows up in the same usage numbers. No API key needed. It costs about 2 cents of API-equivalent usage per reply.
- **No tools that change things, by construction:** `--tools ""` removes every built-in tool (no files, no shell, no web). The only tools are 8 read-only lookups served by a tiny MCP server I wrote with no extra packages (`scripts/helper-mcp.mjs`), which only calls `POST /api/helper/tools` on 127.0.0.1. `--permission-mode dontAsk` plus an allow-list of exactly those tools, `--strict-mcp-config` (no other MCP servers), `--setting-sources ""` (no settings or hooks from elsewhere), `--no-session-persistence`, and its own short system prompt instead of the coding one.
- **Its working folder is `~/agents/helper-room`**, empty and outside every project, so it never picks up a project's instructions.
- **The panel remembers the conversation, not Claude:** each message sends the last 14 messages itself. That way chats work the same from laptop and phone and nothing depends on Claude's session files.
- **Buttons and chips are checked by the server**, so the Helper can't show a button for something made up or out of date: a chip to something that doesn't exist becomes plain text; *Try again* only appears for a stopped run, *Approve plan* only while a plan is waiting, *Merge pull request #N* only while a pull request is open, *Pause everything* only when it isn't already paused.
- **Buttons do exactly what the same button elsewhere does**, through the same endpoints. "Start a test run" opens the workflow with its Test run window (it still needs your task and Start). A suggested task opens **New task** filled in; you still press Start.
- **Create it** uses the same checks as the editors. If the Helper picks a project that isn't on this Mac, it falls back to agentbox-panel. A workflow name that's taken gets a number. Agents and workflows are always saved **Off**.
- **The bubble gets a red dot** when an error box is on the page or a reply finished while the panel was closed.
- **Suggested questions that end in "…"** (e.g. "Make me an agent that…") fill the box instead of sending, so you can finish the sentence.
- **Out of usage:** the panel shows "Out of Claude usage until 3:00 PM (in 2h 14m). I'll be back then." and the box is disabled; if you'd already typed and sent, your question is saved with that answer.
- **Helper usage** shows in the usage meter as **Helper** under "Today, by agent", counted in chat replies.
- **New chat** reuses an empty chat instead of piling up blank ones.
- **Welcome tour stays 4 cards:** I added one sentence about the Helper to the last card instead of a fifth card.
- **Dev copy:** `/tmp/agentbox-dev` (a copy of the live database made with SQLite's backup), port 3100, schedules off. In the copy only, I marked my own live run as done (otherwise the copy would have tried to stop it on start-up) and switched off Discord pings for every agent so testing couldn't message you. I also added one pretend stopped Reviewer run to the copy to test "Why did this stop?". Your real database wasn't touched.

## v2.1: Needs Nic

Nothing needs an admin password. After you merge the pull request, switch the always-on service to the new version (from the `agent` account):

```sh
cd ~/projects/agentbox-panel && git checkout main && git pull && ./scripts/install-launchagent.sh
```

It rebuilds and restarts the panel. The Helper's chat tables are added to your database by themselves on first start.

---

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
