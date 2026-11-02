# QA checklist (v3.1, milestone 8)

Every control on every page, clicked for real with Playwright on a dev copy of the real database (Oct 25, 2026).
Laptop is 1366px. Phone (390px) results are marked 📱 where the control was also clicked at phone width.
Re-run: `BASE_URL=http://127.0.0.1:PORT node scripts/qa/click-all.mjs out.json laptop|phone [/page ...]`.
Controls that start a real agent run, ask Claude or reach GitHub are stopped at the network by that script (it checks
the request goes out); they were each done for real in the end-to-end runs at the bottom.

## Every page

`node scripts/qa/sweep.mjs` opens every page at 1366, 768 and 390px wide (99 page views: home, Inbox, Workflows, New
workflow, Projects, Settings, Help, Machine, See what changed (with and without a pull request), Connectors, Terminal,
every agent page and its settings, every workflow (editor and past runs), and the not-found pages).

- [x] Zero console errors on every page view
- [x] Zero failed network requests (fixed: See what changed without a pull request asked the server for nothing and got an error)
- [x] No sideways scrolling and nothing off screen at 1366, 768 and 390px (the workflow canvas scrolls sideways on purpose, with an arrow button)
- [x] Every tap target 44px or more
- [x] Every page loads in under 1 second (median 41 ms, slowest 748 ms). Fixed: Projects waited for GitHub on every visit (0.6 to 1.4 s); it now shows what it knew last and refreshes in the background
- [x] Nothing freezes while it polls (a frame is drawn within 200 ms after 4 s of polling, on every page)
- [x] Loading, empty and error states use the shared Loading / EmptyState / ErrorBox pieces with the same words and style (See what changed now has a proper empty state)

## Header, menu and Helper (on every page)

- [x] **Skip to content**: jumps to the content 📱
- [x] **agentbox**: went to /; page changed 📱
- [x] **Agents**: went to /; page changed 📱
- [x] **Workflows**: already chosen 📱
- [x] **Inbox**: went to /inbox; page changed 📱
- [x] **Projects**: went to /projects; page changed 📱
- [x] **Usage meter**: opened/closed or picked something; page changed 📱
- [x] **New task**: opened a pop-up; page changed
- [x] **Pause everything**: opened a pop-up; page changed
- [x] **Connectors**: went to /connectors; page changed 📱
- [x] **Machine**: went to /machine; page changed 📱
- [x] **Terminal**: went to /terminal; page changed; POST /api/terminal, POST /api/terminal/input 📱
- [x] **Settings**: went to /settings; page changed 📱
- [x] **Help**: went to /help; page changed 📱
- [x] **Open the Helper. Ask anything about agentbox**: opened a pop-up; opened/closed a section; page changed 📱
- [x] **Menu** (phone): opens; inside it Close, New task, Pause everything, Connectors, Machine, Terminal, Settings, Help, Open the Helper. Ask anything about agentbox each work 📱

### New task panel (Start a task)

- [x] Close: closed a pop-up; page changed
- [x] What's this: What kind?: opened/closed a section; page changed
- [x] Build something: picked it
- [x] Research something: picked it
- [x] What's this: What should it do?: opened/closed a section; page changed
- [x] Help me think of ideas: page changed
- [x] What should it do?: typed in it
- [x] What's this: Project: opened/closed a section; page changed
- [x] Project: picked another choice (4 choices)
- [x] What's this: Attach a brief: opened/closed a section; page changed
- [x] View: opened a pop-up; page changed
- [x] Upload a file: opens the file picker
- [x] Pick a file from the project: opened/closed a section; page changed
- [x] What's this: When does it run?: opened/closed a section; page changed
- [x] Now: picked it
- [x] Every hour: picked it
- [x] Every day: picked it
- [x] Certain days: picked it
- [x] What's this: Freedom: opened/closed a section; page changed
- [x] Look only: picked it
- [x] Check with me first: picked it
- [x] On its own: picked it
- [x] What's this: How thorough?: opened/closed a section; page changed
- [x] Careful: picked it
- [x] Quick: picked it
- [x] ›More options: opened/closed a section; page changed
- [x] Cancel: closed a pop-up; page changed
- [x] Start: page changed
- [x] Open the Helper. Ask anything about agentbox: opened a pop-up; opened/closed a section; page changed

### Pause everything

- [x] Cancel: closed a pop-up; page changed
- [x] Pause everything: closed a pop-up; page changed; POST /api/pause-all
- [x] Open the Helper. Ask anything about agentbox: opened a pop-up; opened/closed a section; page changed

## /

- [x] Archived (4): page changed 📱
- [x] Arcade site: Done. Follow ONE-QUESTION.md in the repo root, milestone : went to /agents/12; page changed 📱
- [x] Heartbeat: Done. Hourly check-in: went to /agents/5; page changed 📱
- [x] +Start a taskEach task gets its own agent: opened a pop-up; page changed 📱

## /inbox

- [x] All: already chosen 📱
- [x] Needs you: opened/closed or picked something 📱
- [x] Done & shipped: page changed 📱
- [x] Reports: page changed 📱
- [x] Go to your agents: went to /; page changed 📱
- [x] What's this: Ideas: opened/closed a section; page changed 📱
- [x] New idea: typed in it 📱
- [x] Add idea: page changed 📱

## /workflows

- [x] Build → Review → Ship. When you start it, it researches the task, Buil: went to /workflows/1; page changed 📱
- [x] Research report. When you start it, it researches the task, it builds : went to /workflows/2; page changed 📱
- [x] Background Lookout Builder. When you start it, it researches the task,: went to /workflows/4; page changed 📱
- [x] Calorie Tracker App. When you start it, it researches the task, Builde: went to /workflows/5; page changed 📱
- [x] +New workflow: went to /workflows/new; page changed 📱

## /workflows/new

- [x] ← All workflows: went to /workflows; page changed 📱
- [x] What's this: What do you want to make?: opened/closed a section; page changed 📱
- [x] Help me think of ideas: page changed 📱
- [x] What do you want to make?: typed in it 📱
- [x] What's this: Project: opened/closed a section; page changed 📱
- [x] Project: picked another choice (4 choices) 📱
- [x] What's this: Attach a brief: opened/closed a section; page changed 📱
- [x] View: opened a pop-up; page changed 📱
- [x] View › Close: closed a pop-up; page changed 📱
- [x] View › Open the Helper. Ask anything about agentbox: opened a pop-up; opened/closed a section; page changed 📱
- [x] Upload a file: opens the file picker 📱
- [x] Pick a file from the project: opened/closed a section; page changed 📱
- [x] Hidden file box behind Upload a file: opens the file picker 📱
- [x] What's this: The steps: opened/closed a section; page changed 📱
- [x] Change the steps: page changed 📱
- [x] Next: page changed 📱

## /projects

- [x] NicB-coder/agentbox-panel on GitHub: https://github.com/NicB-coder/agentbox-panel 📱
- [x] #12 Arcade site (in progress)draft: went to /changes?pr=https%3A%2F%2Fgithub.com%2FNicB-coder%2Fagentbox-panel%2Fpull%2F12; page changed 📱
- [x] Add a file: opens the file picker 📱
- [x] What's this: Add a file: opened/closed a section; page changed 📱
- [x] Hidden file box behind Upload a file: opens the file picker 📱
- [x] NicB-coder-bot/arcade on GitHub: https://github.com/NicB-coder-bot/arcade 📱
- [x] Play: opens in a new tab (/preview/arcade/live/ → 200) 📱
- [x] Add a file: opens the file picker 📱
- [x] What's this: Add a file: opened/closed a section; page changed 📱
- [x] Hidden file box behind Upload a file: opens the file picker 📱
- [x] NicB-coder-bot/lookout on GitHub: https://github.com/NicB-coder-bot/lookout 📱
- [x] #1 Build → Review → Ship: Follow the details under: "What should this : went to /changes?pr=https%3A%2F%2Fgithub.com%2FNicB-coder-bot%2Flookout%2Fpull%2F1; page changed 📱
- [x] Add a file: opens the file picker 📱
- [x] What's this: Add a file: opened/closed a section; page changed 📱
- [x] Hidden file box behind Upload a file: opens the file picker 📱
- [x] What's this: Paste a GitHub repo: opened/closed a section; page changed 📱
- [x] Repo (owner/name): typed in it 📱
- [x] Add it: page changed 📱
- [x] What's this: Pick one of the bot's repos: opened/closed a section; page changed 📱
- [x] What's this: Make a new repo: opened/closed a section; page changed 📱
- [x] Name: typed in it 📱
- [x] What is it? (optional): typed in it 📱
- [x] Make it: page changed 📱
- [x] #6 Short report: three tips: What to make: A one-page report with thre: went to /changes?pr=https%3A%2F%2Fgithub.com%2FNicB-coder-bot%2Farcade%2Fpull%2F6; opened/closed or picked something; page changed; POST /api/changes/shots?project=arcade&before=live&after=agent~wf-short-report-three-what-to-make-20003&page= 📱
- [x] #5 Short comment at: Add a short comment at the top of index.html that: went to /changes?pr=https%3A%2F%2Fgithub.com%2FNicB-coder-bot%2Farcade%2Fpull%2F5; opened/closed or picked something; page changed; POST /api/changes/shots?project=arcade&before=live&after=agent~short-comment-at-add-a-short-comment-20056&page= 📱
- [x] #4 README footer line: Add one line at the very bottom of README.md th: went to /changes?pr=https%3A%2F%2Fgithub.com%2FNicB-coder-bot%2Farcade%2Fpull%2F4; opened/closed or picked something; page changed; POST /api/changes/shots?project=arcade&before=live&after=agent~one-line-at-add-one-line-at-20054&page= 📱

## /settings

- [x] What's this: Pause new runs when usage gets high: opened/closed a section; page changed 📱
- [x] Pause new runs when usage gets high: switched it (false → true) 📱
- [x] What's this: Discord messages: opened/closed a section; page changed 📱
- [x] What's this: Ping me when something ships: opened/closed a section; page changed 📱
- [x] Ping me when something ships: switched it (true → false) 📱
- [x] What's this: Ping me when something needs my OK: opened/closed a section; page changed 📱
- [x] Ping me when something needs my OK: switched it (true → false) 📱
- [x] Send a test message: page changed; POST /api/discord 📱
- [x] What's this: Update agentbox: opened/closed a section; page changed 📱
- [x] Update agentbox: page changed; POST /api/update 📱
- [x] Show the welcome tour again: opened a pop-up; page changed 📱
- [x] Show the welcome tour again › Next: page changed 📱
- [x] Show the welcome tour again › Skip the tour: closed a pop-up; page changed; POST /api/settings, POST /api/settings 📱
- [x] Show the welcome tour again › Open the Helper. Ask anything about agentbox: opened a pop-up; opened/closed a section; page changed 📱
- [x] Wait when usage passes90%: changes with live data; checked on the other pass

## /help

- [x] Show the welcome tour again: opened a pop-up; page changed
- [x] See your agents: went to /; page changed
- [x] See your workflows: went to /workflows; page changed
- [x] Open the Inbox: went to /inbox; page changed
- [x] Usage settings: went to /settings; page changed
- [x] Ask the Helper: opened a pop-up; opened/closed a section; page changed
- [x] What's this: Update agentbox: opened/closed a section; page changed
- [x] Update agentbox: page changed; POST /api/update

## /machine

- [x] What's this: Disk space: opened/closed a section; page changed
- [x] What's this: Tailscale: opened/closed a section; page changed
- [x] What's this: Heartbeat: opened/closed a section; page changed
- [x] Open Heartbeat: went to /agents/5; page changed
- [x] What's this: Version: opened/closed a section; page changed
- [x] Update agentbox: went to /settings#update; page changed
- [x] What's this: Signed in: opened/closed a section; page changed
- [x] Sign in again: went to /terminal?cmd=claude%20auth%20login; page changed; POST /api/terminal, POST /api/terminal/input
- [x] What's this: Sign in to Claude: opened/closed a section; page changed
- [x] Sign in again: went to /terminal?cmd=gh%20auth%20login%20--hostname%20github.com%20--git-protocol%20https%20--web; page changed; POST /api/terminal, POST /api/terminal/input
- [x] What's this: Sign in to GitHub (the bot): opened/closed a section; page changed

## /connectors

- [x] What's this: Connectors: opened/closed a section; page changed
- [x] Check again: page changed
- [x] Connect: opened/closed a section; page changed
- [x] Connect: opened/closed a section; page changed
- [x] Connect: opened/closed a section; page changed
- [x] Connect: opened/closed a section; page changed
- [x] Connect: opened/closed a section; page changed

## /terminal

- [x] What's this: Terminal: opened/closed a section; page changed
- [x] New terminal: POST /api/terminal, POST /api/terminal/input
- [x] Terminal input: typed in it
- [x] Type a command: typed in it
- [x] Run: POST /api/terminal/input
- [x] Tab: POST /api/terminal/input
- [x] Ctrl-C: POST /api/terminal/input
- [x] ↑: POST /api/terminal/input
- [x] ↓: POST /api/terminal/input
- [x] Esc: POST /api/terminal/input

## /agents/12

- [x] ← All agents: went to /; page changed 📱
- [x] Add a follow-up: opened a pop-up; page changed 📱
- [x] Add a follow-up › Close: closed a pop-up; page changed 📱
- [x] Add a follow-up › What's this: What should it do next?: opened/closed a section; page changed 📱
- [x] Add a follow-up › What should it do next?: typed in it 📱
- [x] Add a follow-up › What's this: Freedom: opened/closed a section; page changed 📱
- [x] Add a follow-up › Look only: picked it 📱
- [x] Add a follow-up › Check with me first: picked it 📱
- [x] Add a follow-up › On its own: picked it 📱
- [x] Add a follow-up › What's this: How thorough?: opened/closed a section; page changed 📱
- [x] Add a follow-up › Careful: picked it 📱
- [x] Add a follow-up › Quick: picked it 📱
- [x] Add a follow-up › ›More options: opened/closed a section; page changed 📱
- [x] Add a follow-up › Cancel: closed a pop-up; page changed 📱
- [x] Add a follow-up › Start: page changed 📱
- [x] Add a follow-up › Open the Helper. Ask anything about agentbox: opened a pop-up; opened/closed a section; page changed 📱
- [x] Archive: opened a pop-up; page changed 📱
- [x] What should it do next?: typed in it 📱
- [x] Next: opened a pop-up; page changed 📱
- [x] See what changed: went to /changes?pr=https%3A%2F%2Fgithub.com%2FNicB-coder%2Fagentbox-panel%2Fpull%2F12; page changed 📱
- [x] Show the full log: opened/closed a section; page changed 📱

## /agents/5

- [x] ← All agents: went to /; page changed
- [x] Show the full log: opened/closed a section; page changed
- [x] ← All agents: went to /; page changed
- [x] Show the full log: opened/closed a section; page changed

## /agents/12/edit

- [x] ← Back to Arcade site: went to /agents/12; page changed
- [x] What's this: Name: opened/closed a section; page changed
- [x] Site Checker: typed in it
- [x] What's this: Color: opened/closed a section; page changed
- [x] Blue: picked it
- [x] Teal: picked it
- [x] Orange: picked it
- [x] Purple: picked it
- [x] Green: picked it
- [x] Pink: picked it
- [x] What's this: Icon: opened/closed a section; page changed
- [x] Hammer: picked it
- [x] Eye: picked it
- [x] Globe: picked it
- [x] Moon: picked it
- [x] Heart: picked it
- [x] Lightning: picked it
- [x] Book: picked it
- [x] Sparkle: picked it
- [x] What's this: The job: opened/closed a section; page changed
- [x] The job: typed in it
- [x] What's this: Project: opened/closed a section; page changed
- [x] Project: picked another choice (4 choices)
- [x] What's this: When does it run?: opened/closed a section; page changed
- [x] When I start it: picked it
- [x] Every hour: picked it
- [x] Every day: picked it
- [x] Certain days: picked it
- [x] What's this: Freedom: opened/closed a section; page changed
- [x] Look only: picked it
- [x] Check with me first: picked it
- [x] On its own: picked it
- [x] What's this: How thorough?: opened/closed a section; page changed
- [x] Careful: picked it
- [x] Quick: picked it
- [x] What's this: Time limit: opened/closed a section; page changed
- [x] Time limit: moved it (180 → 180)
- [x] What's this: Model: opened/closed a section; page changed
- [x] Fast: picked it
- [x] Smartest: picked it
- [x] What's this: Tell me when: opened/closed a section; page changed
- [x] ✓Finished: switched it (true → false)
- [x] ✓Needs my OK: switched it (true → false)
- [x] ✓Only if something goes wrong: switched it (true → false)
- [x] Never: switched it (false → true)
- [x] What's this: Ask me each step: opened/closed a section; page changed
- [x] Ask me each step: switched it (false → true)
- [x] What's this: On: opened/closed a section; page changed
- [x] On: switched it (true → false)
- [x] Save: went to /agents/12; page changed; PUT /api/agents/12
- [x] Cancel: went to /agents/12; page changed
- [x] Delete agent: opened a pop-up; page changed

## /workflows/1

- [x] ← All workflows: went to /workflows; page changed 📱
- [x] Workflow name: typed in it 📱
- [x] What's this: Project: opened/closed a section; page changed 📱
- [x] Project: picked another choice (4 choices) 📱
- [x] What's this: On: opened/closed a section; page changed
- [x] On: switched it (true → false)
- [x] Run now: changes with live data; checked on the other pass
- [x] Run with a different goal…: changes with live data; checked on the other pass
- [x] Test run: page changed; POST /api/workflows/1/run 📱
- [x] What's this: Test run: opened/closed a section; page changed 📱
- [x] Test with a different goal…: opened a pop-up; page changed 📱
- [x] Test with a different goal… › What do you want to make this time?: typed in it 📱
- [x] Test with a different goal… › Cancel: closed a pop-up; page changed 📱
- [x] Test with a different goal… › Start test run: closed a pop-up; page changed; POST /api/workflows/1/run 📱
- [x] Test with a different goal… › Open the Helper. Ask anything about agentbox: opened a pop-up; opened/closed a section; page changed 📱
- [x] Saved: greyed out until there's something to do (correct) 📱
- [x] Undo: greyed out until there's something to do (correct) 📱
- [x] Redo: greyed out until there's something to do (correct) 📱
- [x] Version history: opened a pop-up; page changed 📱
- [x] Version history › Restore: closed a pop-up; page changed; PUT /api/workflows/1 📱
- [x] Version history › Restore: closed a pop-up; page changed; PUT /api/workflows/1 📱
- [x] Version history › Close: closed a pop-up; page changed 📱
- [x] Version history › Open the Helper. Ask anything about agentbox: opened a pop-up; opened/closed a section; page changed 📱
- [x] Make a copy: went to /workflows/6?copied=1; page changed; POST /api/workflows/1/duplicate 📱
- [x] What's this: Edit tools: opened/closed a section; page changed 📱
- [x] What's this: What do you want to make?: opened/closed a section; page changed 📱
- [x] What do you want to make?: typed in it 📱
- [x] What's this: Attach a brief: opened/closed a section; page changed 📱
- [x] Upload a file: opens the file picker 📱
- [x] Pick a file from the project: opened/closed a section; page changed 📱
- [x] Hidden file box behind Upload a file: opens the file picker 📱
- [x] Change it in your own words: typed in it 📱
- [x] Draft the change: greyed out until there's something to do (correct) 📱
- [x] Add a step that tests it on a phone: page changed 📱
- [x] Make the review stricter: page changed 📱
- [x] Don't ship, just tell me: page changed 📱
- [x] Step 1: Start. When I start it: page changed 📱
- [x] Add a step here: opened a pop-up; page changed 📱
- [x] Add a step here › BuildAn agent does a piece of the work: builds or changes something, o: closed a pop-up; page changed 📱
- [x] Add a step here › ResearchLooks things up and writes research.md for the later steps to : closed a pop-up; page changed 📱
- [x] Add a step here › ReviewA reviewer checks the work against the task and the research. Pa: closed a pop-up; page changed 📱
- [x] Add a step here › CheckHard tests, not opinions: tests pass, the page loads, no errors.: closed a pop-up; page changed 📱
- [x] Add a step here › Ask meWaits for you in the Inbox: Approve, Send back or Stop.: closed a pop-up; page changed 📱
- [x] Add a step here › ShipMerges the pull request into main.: closed a pop-up; page changed 📱
- [x] Add a step here › Tell meSends you a Discord message with a summary and links.: closed a pop-up; page changed 📱
- [x] Add a step here › Cancel: closed a pop-up; page changed 📱
- [x] Add a step here › Open the Helper. Ask anything about agentbox: opened a pop-up; opened/closed a section; page changed 📱
- [x] Step 2: Research. Looks things up: page changed 📱
- [x] Move Research. Drag it, or use the arrow keys.: page changed 📱
- [x] Add a step here: opened a pop-up; page changed 📱
- [x] Step 3: Builder. Does its usual job: page changed 📱
- [x] Move Builder. Drag it, or use the arrow keys.: page changed 📱
- [x] Add a step here: opened a pop-up; page changed 📱
- [x] Step 4: Review. If it needs work: back to Builder: page changed 📱
- [x] Move Review. Drag it, or use the arrow keys.: page changed 📱
- [x] Add a step here: opened a pop-up; page changed 📱
- [x] Step 5: Review. If it needs work: back to Builder: page changed 📱
- [x] Move Review. Drag it, or use the arrow keys.: page changed 📱
- [x] Add a step here: opened a pop-up; page changed 📱
- [x] Step 6: Check. Tests pass: page changed 📱
- [x] Move Check. Drag it, or use the arrow keys.: page changed 📱
- [x] Add a step here: opened a pop-up; page changed 📱
- [x] Step 7: Ask me. It's built, reviewed and tested. Ship it?: page changed 📱
- [x] Move Ask me. Drag it, or use the arrow keys.: page changed 📱
- [x] Add a step here: opened a pop-up; page changed 📱
- [x] Step 8: Ship. Asks before shipping: page changed 📱
- [x] Move Ship. Drag it, or use the arrow keys.: page changed 📱
- [x] Add a step here: opened a pop-up; page changed 📱
- [x] Step 9: Tell me. Discord message: page changed 📱
- [x] Move Tell me. Drag it, or use the arrow keys.: page changed 📱
- [x] Add a step at the end: opened a pop-up; page changed 📱
- [x] What's this: Limits: opened/closed a section; page changed 📱
- [x] What's this: “Needs work” rounds: opened/closed a section; page changed 📱
- [x] “Needs work” rounds slider: moved it (210 → 220) 📱
- [x] What's this: Longest run: opened/closed a section; page changed 📱
- [x] Longest run slider: moved it (50 → 55) 📱
- [x] What's this: Most usage per run: opened/closed a section; page changed 📱
- [x] Most usage per run slider: moved it (2 → 3) 📱
- [x] Pull request: https://github.com/NicB-coder-bot/arcade/pull/1 📱
- [x] See it: went to /workflows/1?run=1; page changed 📱
- [x] Pull request: https://github.com/NicB-coder-bot/lookout/pull/1 📱
- [x] See it: went to /workflows/1?run=2; page changed 📱
- [x] Delete this workflow: opened a pop-up; page changed 📱

## Welcome tour (`node scripts/qa/tour.mjs`, laptop and phone)

- [x] Opens by itself on a first visit, and not again after it's finished
- [x] Next (1 → 4), Back, Let's go, Skip the tour, Escape
- [x] The Help page's tour button shows it again
- [x] The Helper bubble sits inside the tour, covers none of its buttons, opens on top of it, and Escape in the chat closes only the chat
- [x] No console errors

## Labels (`node scripts/qa/labels.mjs`)

- [x] Every box, menu and slider on every page, in Start a task and in every workflow step's panel has a name a screen
  reader reads out. Fixed: the workflow Limits sliders, a step's Time limit slider and the agent Name box had none
  (the ⓘ button inside their label took the label for itself).

## Real end-to-end runs (`node scripts/qa/e2e.mjs <scenario>`, project arcade, real Claude, real pull requests)

Started by clicking through the panel like Nic would, on a second dev copy (port 3254) so the click-through above
couldn't pause them.

- [x] **Quick task** (New task → Quick → coach said "Looks good" → Start): pull request arcade#4, in the Inbox as
  "Pull request ready" with "It finished in under 2 minutes. Check it did the whole job"
- [x] **Careful task**: built, reviewed by a second AI, polished, pull request arcade#5, in the Inbox with "Reviewed ✓ · optimized"
- [x] **Usage-limit wait and resume** (during the Careful task, `/api/dev/simulate`): showed "Waiting · back at 3:49 AM",
  carried on by itself in the same session 45 seconds later and finished
- [x] **Workflow from a template** (start screen → Change the steps → Research report → coach asked 3 quick questions →
  Use this and next → Test run): research, report, pull request arcade#6, in the Inbox as "Finished" (new, see below).
  This run also sat out a real usage limit for about 4 hours and carried on by itself.
- [x] **Panel restart mid-run** (during the template workflow's research step): the step's session was picked up again
  after the restart and the workflow went on to finish
- [x] **Vague one-line goal through the prompt coach** ("make a joke page" → 3 quick questions → improved goal → Next)
- [x] **Workflow changed in my own words** (same workflow: "Make the review step use the fast model and keep it to 10
  minutes" → Draft the change → before/after → Apply; saved as Sonnet, 10 min), then Test run: built, reviewed, stopped
  before shipping, pull request arcade#7, in the Inbox as "Finished · Test run"
- [x] **Workflow with an attached brief** (Upload a file → "Brief: TINY-BRIEF.md" chip → goal "Follow TINY-BRIEF.md." →
  coach "Looks good" → Test run): the run page shows the brief it was given, pull request arcade#8, in the Inbox as
  "Finished very fast" with Look at it (it was a one-line job)
- [x] Run now on a saved goal sends at once with no pop-up; Run with a different goal… opens with the saved goal filled
  in; Run now with no goal points at the goal box instead of starting
- [x] No page errors in any run

All test pull requests (arcade#4 to #8) were closed afterwards without merging.

## Fixed during this check

- See what changed opened without a pull request: asked the server for nothing every 8 seconds and got an error. Now a
  plain "Nothing to show here" with Go to the Inbox.
- Projects waited for GitHub on every visit (up to 1.4 s). Now instant, refreshed in the background, warmed at start.
- A workflow that finished with a pull request (no Ship step, or a Test run) never reached the Inbox. New "Finished"
  card with Look at it / Dismiss; it goes away when the pull request is merged or closed.
- A workflow that finished in under 2 minutes with a pull request said "Didn't do anything" with no way to see the
  work. Now "Finished very fast" with Look at it first.
- Delete agent used the browser's plain grey confirm box. Now the panel's own "Delete …?" pop-up.
- The Discord ping switches waited for the server before moving; they move at once now (and move back with a message if
  saving fails).
- Missing screen-reader names on 5 controls (see Labels).
- Task names could end on a joining word ("Short comment at"); now "Short comment".
