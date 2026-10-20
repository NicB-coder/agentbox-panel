agentbox panel

A private web app for controlling the AI agents that run on this Mac ("agentbox"). The owner is Nic, a high-school developer who builds by directing AI agents rather than coding by hand.

You are working unattended

Nic is away for about 2 hours. Do NOT stop to ask questions. When something is unclear, pick the most reasonable option, write it down in NOTES.md under "Decisions I made", and keep going. Stop only for something that needs an admin password (sudo) or would be destructive; write those in NOTES.md under "Needs Nic" and move on to the next thing you can do.

What it is

The home page: at the top, the name "agentbox", a green "Online" dot, a "New task" button, a greeting ("Good evening, Nic") and one summary line ("2 agents working · 1 thing needs you"). Below that: a grid of agent tiles. Each tile shows the agent, what it's working on and its status. Clicking a tile opens that agent's page.

It runs on agentbox and is only reachable over Tailscale. It is never public.

Design (follow exactly)
Font: Instrument Sans (Google Fonts), weights 400/500/600/700. Page background white, text 
#15171B, muted text 
#555A63.
Header: 64px tall, bottom border 
#E6E8EC. "agentbox" 20px bold. "New task" is a black pill button (
#15171B, white text).
Content: centered, max-width 1080px. Grid repeat(auto-fit, minmax(280px, 1fr)), gap 40px, so 3 tiles per row on a laptop, fewer on smaller screens.
Tiles are squircles: aspect-ratio: 1/1, border-radius: 64px, border: 1px solid rgba(21,23,27,0.28), white background, very soft shadow.
A thin 6px stripe of the agent's color across the top at ~55% opacity.
Top row: a 40px round icon (agent color at 10% opacity behind, icon in the agent color) + agent name (17px semibold) + project (13px muted).
Middle: current task (16px semibold) and a one-sentence plain-English summary (14px muted).
Bottom row: a status pill on the left, a time on the right.
Status pills (dot + label): Working bg 
#EEF1FD text 
#2A3F9E · Needs you bg 
#FDF0DC text 
#8A4600 · Done bg 
#E6F4EA text 
#1E6B34 · Stopped bg 
#FDE8E6 text 
#A11B12 · Scheduled bg 
#EEF0F3 text 
#4A4F57 · Paused (same gray).
The last tile is a dashed "Add an agent" squircle (2px dashed 
#B9BEC6) that opens the agent editor.
Other pages use the same font, colors, generous spacing and large rounded corners (24px for panels, 14px for inputs and buttons).
Plain words everywhere. Never show commands, file paths or jargon in the main UI. Raw logs only behind a "Show the full log" toggle.
Accessible: real buttons and links, labels on inputs, text contrast at least 4.5:1, touch targets 44px+. Works on a phone.
The agent page (opens when you click a tile)

Everything Nic needs for one agent, on one page:

Top: icon, name, project, status pill, and buttons: Run now, Pause / Resume, Stop (only while working), Edit.
Right now: the current task in one plain sentence, plus progress as plain steps (e.g. ✓ Understand the problem → ✓ Make the changes → ● Test it in a browser → ○ Send a pull request).
Give it a task: a text box + "Start" button.
Schedule: when it runs next, in words ("Every night at 2:00 AM · next in 7 hours").
History: past runs, newest first: task, result (Done / Stopped / Needs you), time taken, link to the pull request.
Show the full log: collapsed by default.
The agent editor ("Add an agent" and "Edit")

An agent = one detailed prompt (what it does, in Nic's own words) + a few essential settings as clickable controls. Free text for the open-ended part, controls for anything that must be exact. Layout, top to bottom:

Name, plus a color (6 swatches) and an icon (8 choices).
What should this agent do? A big text box. Placeholder shows a good example prompt. Under it, a short tip: "Say what to look at, what a good result is, and what it should never do."
Project: dropdown of repos cloned under ~/projects.
When does it run? Segmented choice: Only when I ask · Every hour · Every day · Certain days. Day and time pickers appear only when needed.
What is it allowed to do? 3-step choice: Look only (reads and reports) · Suggest changes (opens pull requests, the default) · Make changes (can push to its own branch, still never to main).
How should it work with me? Segmented choice (maps to Claude Code permission modes; check claude --help):
Auto (default): works on its own; a safety checker approves each step (permission mode auto).
Plan first: it writes a short plan, then waits. The agent page shows the plan with Approve plan / Change it buttons.
Ask me each step: it pauses before every command or change. Status becomes Needs you, and the agent page shows what it wants to do in plain words with Allow / Deny buttons (wire this up through Claude Code's permission-prompt mechanism for headless runs, e.g. a permission-prompt tool or hook that waits for Nic's click).
Look only: never changes anything, just reports. Pending approvals also appear on the home page tile ("Waiting for your OK") and trigger a Discord ping if notifications are on.
Limits: slider for maximum run time (5 to 120 minutes, default 30), and a model choice: Fast (Sonnet) or Smartest (Opus).
Tell me when: Finished · Needs my OK · Only if something goes wrong · Never (multi-select; via the Discord webhook already in the Keychain as discord-heartbeat).
On / Off switch, then Save agent. Show a one-line plain-English summary that updates as you edit, e.g. "Every night at 2:00 AM, Site Checker will look at portfolio on its own and tell you only if something's wrong." The "Give it a task" box on the agent page also has the same mode choice, so Nic can override it for one task.
Starting agents (seed data in SQLite, editable in the UI)
Name	Color	Job
Builder	
#2F4FD8	Does tasks you give it: writes and fixes code, opens a pull request. Only when I ask.
Reviewer	
#0F7B6C	Reviews open pull requests and comments on them. Only when I ask.
Site Checker	
#C2410C	Every day 2:00 AM: opens sites in a real browser and reports problems. Look only.
Overnight	
#7048C8	Every day 3:00 AM: makes one small improvement. Paused by default.
Heartbeat	
#2B8A3E	The existing hourly check-in job (read-only view, see below).
How it works
Stack: Next.js (App Router) + TypeScript + Tailwind, SQLite (better-sqlite3). Keep dependencies few.
Server binds to 127.0.0.1 only, port 3000. Never 0.0.0.0.
Running a task: create a git worktree on a new branch agent/<short-name> → run Claude Code headless in it (check claude --help for current flags; use a JSON/streaming output mode; permission level from the agent's "allowed to do" setting; never use bypassPermissions) with the agent's prompt + the task → record plain-English steps → on finish push the branch and open a PR with gh pr create (gh is logged in as the bot) → statuses: Working → Needs you (PR open) → Done (PR merged, poll gh) → Stopped (error, usage limit, time limit, or Stop pressed).
Schedules: a small scheduler inside the server process that starts runs at their times.
Heartbeat tile: read the existing launchd job com.agentbox.heartbeat and its logs in ~/agents/heartbeat/ (out.log, err.log). Show "N of N on time" for today.
The page refreshes itself (polling every few seconds or server-sent events). No login: Tailscale is the lock.
Rules
Never commit secrets, tokens or webhook URLs. Secrets stay in the macOS Keychain.
Never push to main. Work on the branch build/v1, commit after each milestone, and push it.
When everything is done (or time runs short), open ONE pull request from build/v1 to main with a plain-English summary, screenshots if you can, and how to open the app.
Test each milestone in a real browser (install and use Playwright) at laptop and phone width before moving on.
Milestones (do them in order, without stopping between them)
Home page and agent page exactly as designed, with seed data.
Agent editor (create and edit agents) saved to SQLite.
Real heartbeat data.
Real task runs: worktree → Claude Code → PR → status updates, plus Run now / Pause / Stop.
Scheduler for scheduled agents.
Always on: a launchd LaunchAgent in this (agent) account that keeps npm start running, and a README section "How to open it": the admin account runs tailscale serve for port 3000 (write the exact command in NOTES.md under "Needs Nic").

Finish with NOTES.md: what's done, what isn't, decisions you made, and what Nic should click first.
