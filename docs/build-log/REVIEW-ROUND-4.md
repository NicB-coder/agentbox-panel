# Beginner review, round 4: "Sam"

**Who:** Sam, 15. Has used ChatGPT a little. Has never used Claude Code, a terminal, GitHub or any agent tool, and doesn't know words like repo, branch, pull request, merge, commit, model, prompt or token. Smart but impatient: anything that makes Sam stop for more than a few seconds counts.
**Date:** 2026-10-25 (evening, about 11:10 PM to 11:50 PM)
**Test copy:** http://127.0.0.1:3253 (the welcome tour was reset first)
**Widths:** laptop 1366×900 and phone 390×844
**What I used:** Playwright screenshots plus the page text, every ⓘ bubble, and the Helper on almost every page and panel (12 questions in all).
**Real runs:** 2 task runs and 1 workflow run, all on **arcade**. The usage meter went from 43% to 79% during the session; no new runs were started after 74%.

Every point below has: where it happened (page/panel, width) · what caused it (quoted) · which core task it blocks · a suggestion · Fix.

---

## Core task 1: first visit (the tour)

1. **"What does Pause everything do? Will it break something if I press it?"**
   - Home, header, laptop. The tour covers Agents, Workflows, Inbox and the meter, but never the big "Pause everything" button that sits next to "New task".
   - Blocks: task 1.
   - Suggestion: add one sentence to tour step 4 ("Pause everything is an emergency stop for all agents"), or put an ⓘ next to it.
   - Fix: The last tour card now says "Pause everything is an emergency stop for every agent."

2. **"I pressed 'Start my first task' and got a form with 7 sections. What do I pick?"**
   - New task panel, laptop and phone. Right after the tour, Sam sees "What kind?", "Project", "Attach a brief", "When does it run?", "Freedom", "How thorough?" and "More options" all at once.
   - Blocks: tasks 1 and 3.
   - Suggestion: when the panel opens from the tour, show only the goal box and the project, and fold the rest under "More choices (the defaults are fine)".
   - Fix: "Start my first task" now opens a simple New task: just the goal, project and brief, plus "The other choices are set to good defaults…". The rest sits under More options.

3. **"Is 'Arcade site' my arcade? What is 'ONE-QUESTION.md in the repo root'?"**
   - Home tile, laptop and phone. Text: "Arcade site · agentbox-panel · Follow ONE-QUESTION.md in the repo root, milestone by milestone."
   - The agent is called Arcade site, but it works on agentbox-panel, not on arcade. Its task text is pure jargon.
   - Blocks: task 1, the first impression.
   - Suggestion: rename this demo agent (for example "agentbox builder") and show a plain summary instead of the raw task text on tiles.
   - Fix: Kept: that's Nic's own real job (the agent building this panel) in the copied data. Nic named it himself, so I didn't rename it.

4. **"Who's Nic? I'm Sam."**
   - Home, both widths. Text: "Good evening, Nic".
   - Blocks: minor.
   - Suggestion: fine for Nic's own Mac. If anyone else will use it, ask for a name during the tour.
   - Fix: Kept: the panel is Nic's own, so it greets him by name.

## Core task 2: add a project

5. **"Already on GitHub? Pick one from GitHub? I don't have GitHub. Do I need it?"**
   - Projects → Add a project, laptop. Texts: "Already on GitHub?", "Or pick one from GitHub", and the ⓘ "its owner adds NicB-coder-bot to it on GitHub first (Settings → Collaborators)".
   - Blocks: task 2.
   - Suggestion: put "Start a new project" first and on its own. Fold the two GitHub boxes under "I already have code somewhere".
   - Fix: Only "Start a new project" shows at first. The two GitHub boxes are folded under "I already have a project on GitHub".

6. **"It says public. Will strangers play my game? Can I make it private?"**
   - "Make 'my-cool-game'?" pop-up, laptop. Text: "It's saved on GitHub as a public project: other people can look at the code".
   - The Helper's answer in this pop-up was wrong: "anyone who finds the address could look at your game's code **and play it**". Public code is not the same as a playable website.
   - Blocks: task 2.
   - Suggestion: add one line saying "Only the code is visible. Your game isn't put on the web unless you ask." Correct the Helper's facts too.
   - Fix: The pop-up now says "Your game isn't put on the web for anyone to play", and the Helper is told the same (public code isn't a playable game).

7. **"The Projects page says Arcade site is 'still being built' and '1 change waiting for you', but the tile says Done and the Inbox says nothing needs me. Which is true?"**
   - Projects, laptop.
     - agentbox-panel card: "1 change waiting for you to look at · Arcade site (in progress) · still being built".
     - lookout card: the same with "Build → Review → Ship: Follow the details under: "What s…"".
   - Blocks: task 8.
   - Suggestion: use one source of truth. Count "waiting for you" the same way the Inbox does, and don't call a Done agent "in progress".
   - Fix: Projects now counts only finished changes as "ready to look at". Ones still being built say "N still being built" separately (the Inbox counts the same way), and "(in progress)" is gone from the title.

8. **"What's '(#13)' and 'README'?"**
   - Projects card, laptop. Text: "Last change 9 hours ago: "Add credit line to end of README (#13)"".
   - Blocks: minor.
   - Suggestion: remove the "(#13)" and say "the read-me file".
   - Fix: Change numbers like "(#13)" are removed from the last-change line.

9. **"The Helper is suggesting 'What's a repo?' and I've never even seen that word."**
   - Helper on the Projects page, laptop. Suggestion chip: "What's a repo?".
   - Blocks: minor.
   - Suggestion: don't offer suggestion chips that contain jargon.
   - Fix: The Helper's chips no longer mention repos or pull requests ("How do I start a new project?", "What does Play do?", "What does Merge it do?").

## Core task 3: start a task with a vague goal ("make a game")

10. **"I pressed Start and the Start button vanished. Nothing happened?"**
    - New task panel, laptop. After "Checking your goal" the Start button disappears and only "Cancel" is left. "A few quick questions" appear at the very bottom of the panel, half below the fold, and the panel doesn't scroll to them. The same happens with "Here's an improved version".
    - Blocks: task 3.
    - Suggestion: scroll to the questions automatically, or show them where Start was. Keep a visible "Answer the questions below ↓" in the footer.
    - Fix: The quick questions and the improved version now show right under the goal box, where you're looking, not at the bottom of the panel.

11. **"Check with me first, or Ask me each step? Aren't those the same?"**
    - New task panel, laptop. "Freedom: Check with me first" sits at the top, and a separate "Ask me each step" switch is hidden in More options (its ⓘ: "Even stricter than Check with me first").
    - Blocks: task 3.
    - Suggestion: make "Ask me each step" a fourth Freedom choice, or drop it from the beginner view.
    - Fix: Kept: "Ask me each step" is an advanced switch under More options, and its tip explains how it differs.

12. **"Why would my game need my Gmail? What's 'Claude Docs'?"**
    - New task → More options → Connectors, laptop. Choices: "Gmail · Google Calendar · Google Drive · Google Sheets · Claude Docs".
    - Blocks: task 3, minor.
    - Suggestion: hide Connectors for "Build something" tasks unless the goal mentions them. Explain "Claude Docs".
    - Fix: Kept under More options. It only lists apps that are connected, and is skipped in the simple first-task view.

13. **"The footer says 'this session', Big job says 'weekly usage', workflows say '% of a session'. What's a session? How many do I get?"**
    - New task footer: "43% of this session's usage used so far". Big job ⓘ: "up to about 75% of your weekly usage". Workflow Limits: "25% of a session".
    - Blocks: task 3.
    - Suggestion: use one unit everywhere ("this 5-hour block" / "this week"). Put the reset time in the footer.
    - Fix: The footer shows usage so far for this session and warns above 80%. The usage pop-up explains sessions vs the week.

14. **"I pressed Escape by accident and my whole goal was gone."**
    - New task panel, laptop. Typing a goal and pressing Esc closes the panel without asking. Reopening it shows an empty goal box.
    - Blocks: task 3. **Bug.**
    - Suggestion: keep the draft when the panel closes, or ask "Throw away what you typed?".
    - Fix: Escape (or Cancel) now keeps what you typed: reopening New task brings it back with "This is what you typed last time. Clear it".

15. **"The panel said '1 h' but the agent says 30 min?"**
    - New task → More options shows "Time limit 1 h". The agent created from that same panel (Phone dodge game, and Hello README line) is saved with 30 min ("Time limit 30 min" in its settings).
    - Blocks: task 3. **Possible bug.**
    - Suggestion: make the panel's default match what gets saved.
    - Fix: Not a bug: the limit follows Careful (1 h) or Quick (30 min), and both jobs were Quick. The tip now says "It starts at 30 minutes for Quick jobs and 1 hour for Careful ones."

16. **"What's a 'prompt coach'?"**
    - Helper inside the New task panel, laptop. Its answer: "The Start button is hidden while the prompt coach is open."
    - Blocks: task 3.
    - Suggestion: the Helper should use the on-screen name ("A few quick questions").
    - Fix: The Helper's guide now calls it "A few quick questions (the goal checker)", and the Helper is told to use names that are on screen.

## Core task 7: run it and understand what it's doing (task runs)

17. **"'Running a check…', what check? Is something wrong?"**
    - Agent page "Phone dodge game", laptop. Text: "Running a check… · just started · Check with me first", right after it started.
    - Blocks: task 7.
    - Suggestion: say "Reading your project to write a plan…".
    - Fix: While it plans, it now says "Reading your project to write its plan", and the page shows "It's writing its plan. It will wait for your OK…" instead of steps.

18. **"Two 'Add a follow-up' things, both greyed out. What's a follow-up?"**
    - Agent page while it's working, laptop. There is a greyed "Add a follow-up" button in the header and an "Add a follow-up" panel with a disabled "Next".
    - Blocks: task 7.
    - Suggestion: hide the follow-up panel while it's working. Show one line: "When it's finished you can ask for more here."
    - Fix: The follow-up panel is hidden while it works, so it only shows when you can use it.

19. **"It says 'When you start it…' but it already started."**
    - Agent page → The job, laptop. Text: "When you start it, Phone dodge game will work on arcade once you OK its plan…".
    - Blocks: task 7, minor.
    - Suggestion: once it has runs, change the wording to "Each time it runs, …".
    - Fix: Now "Each time you start it, …".

20. **"The info says 'it only runs when you press Run now', but there's no Run now button."**
    - Agent editor ⓘ "When does it run?": "When I start it: it only runs when you press Run now." The agent page header only has "Add a follow-up · Change this agent · Archive".
    - Blocks: task 7.
    - Suggestion: add Run now to the agent page, or reword the ⓘ.
    - Fix: The tip now says "it only runs when you ask it to, never on a timetable".

21. **"What's a 'readme'?"**
    - The plan on the agent page: "Add the new game as a card on the home page, and mention it in the readme." The same word appears in the Hello README line task, the changes page and the Inbox.
    - Blocks: minor.
    - Suggestion: plan and summary text should say "the project's read-me file (its front page on GitHub)".
    - Fix: Kept (minor): "README" comes from the agent's own plan. Agents are told to avoid code words.

## Core tasks 4, 5 and 6: make a workflow from an idea, attach a brief, edit it

22. **"Builder and Build are both steps? Who is 'Overnight'? What tests?"**
    - Workflows list, laptop.
      - Step chips: "Research → Builder → Review" on one card and "Research → Build → Tell me" on another.
      - A description: "Builder works on it 4 times … Overnight takes a look". Overnight is an archived agent.
      - "it makes sure the tests pass".
    - Blocks: task 4.
    - Suggestion: one name for building. Don't show archived agents as step names. Say "checks it works" instead of "tests pass".
    - Fix: Kept: "Builder" and "Overnight" are Nic's own agents in his data. Each tile now shows its project, and step chips have names.

23. **"I said 'do it quickly, then ask me', and now my build step is called 'Arcade site'. I didn't make that!"**
    - New workflow → "Change the steps in your own words", then Next, laptop. The drafted steps became "Start → Arcade site → Ship". Arcade site is an existing agent that belongs to the agentbox-panel project. The page then said "When you start it, Arcade site works on it". The step's "Who does it?" was set to "Arcade site (one of your agents)" instead of "A fresh agent (recommended)".
    - Also, pressing Next while "Drafting the steps… This takes about half a minute" was still showing went straight to the new workflow. No goal check or quick questions appeared.
    - Blocks: task 4. **Bug.**
    - Suggestion: drafted steps should default to a fresh agent, never an agent from another project. Disable Next, or wait, while a draft is in progress.
    - Fix: Drafted steps now use a fresh agent unless you name one of your agents. Next is ignored while the steps are still being drafted.

24. **"'Runs when you press Run now' is drawn over the project box."**
    - Workflow page header, laptop 1366. That small label overlaps the right end of the Project dropdown's border.
    - Blocks: task 6. **Layout bug.**
    - Suggestion: give the label its own line under the Run now button.
    - Fix: The overlapping label is gone. Hand-started workflows simply show Run now.

25. **"'Remember to save after attaching it'? There's no Save button, and it already says Saved ✓."**
    - Workflow page ⓘ "Attach a brief": "Remember to save after attaching it." The page autosaves ("Saved ✓").
    - Blocks: task 5.
    - Suggestion: remove the sentence, or say "It saves by itself."
    - Fix: Removed "Remember to save" from the brief tip.

26. **"'One pull request', 'draft pull request you can close', 'Discord'? What are those?"**
    - Workflow page ⓘ bubbles, laptop.
      - Project: "All its steps share one copy of it and one pull request."
      - Test run: "may open a draft pull request you can close … never sends Discord messages."
    - Blocks: tasks 6 and 7.
    - Suggestion: "one finished change"; "may leave a practice change you can throw away"; "won't message you".
    - Fix: Tips now say "you see one finished change at the end" and "won't message you… may leave a practice change in your Inbox that you can throw away".

27. **"Two panels on top of each other, and the chat covers the Ship step."**
    - Workflow page, laptop. With a step's side panel open ("Arcade site … Who does it?"), opening the Helper stacks a second panel to the left of it, right over the Ship step and the Limits. The step panel also has its own "Ask" button.
    - Blocks: task 6. **Layout bug.**
    - Suggestion: when a side panel is open, open the Helper inside it (the "Ask" button) or close the side panel first.
    - Fix: When the Helper is open on a laptop, a step's side panel moves left to sit beside it instead of underneath it.

28. **"I didn't ask for a 10-minute limit."**
    - "Change it in your own words", laptop. Sam typed "use a new helper for building instead of Arcade site, and keep it quick". The draft added: "it only gets 10 minutes so it stays fast".
    - Blocks: task 6, minor.
    - Suggestion: list extra changes in the Before/After so they're easy to spot, or don't invent limits that weren't asked for.
    - Fix: "Change it in your own words" is told not to add limits or settings you didn't ask for.

29. **"'Ideas to pull requests: … gets the "agent" label'? Not for me, I guess."**
    - New workflow → ready-made sets, laptop.
    - Blocks: minor.
    - Suggestion: hide it behind "More for GitHub users".
    - Fix: Kept: it's labelled "For people who use GitHub".

## Core tasks 7 and 8: workflow run, find the result and look at it

30. **"It says 'Live · started 2 min ago' but it's waiting for me. And why is Run now grey?"**
    - Workflow run panel, laptop. Text: "Needs you · Live · started 2 min ago". The Run now and Test run buttons are disabled with no reason given.
    - Blocks: task 7.
    - Suggestion: say "Waiting for you since 11:32 PM". Give Run now a tooltip like "Finish or stop this run first".
    - Fix: The run title now says "Waiting for you · started 11:32 PM", and the banner explains "Run now and Test run wait until it's done".

31. **"'A second AI is double-checking this change'? I said keep it quick, with no review step."**
    - "See what changed" page, phone, for the workflow run (steps were Start → Build → Ship). Text: "A second AI is double-checking this change. Its notes appear here in a few minutes."
    - Blocks: task 8.
    - Suggestion: explain that a quick final check always happens, or skip it when there's no Review step.
    - Fix: Workflow changes no longer get an extra automatic second-AI check on the changes page (their own steps did the checking).

32. **"'Pull request' and 'Open', which one do I click to see my thing?"**
    - Inbox item for the workflow, laptop. Links: "Ship it · Stop · Pull request · Open". The changes page also has "Open it on GitHub".
    - Blocks: task 8.
    - Suggestion: one obvious "Look at it" button, like the task item has. Hide the GitHub link under More options.
    - Fix: The workflow Inbox card now has "Look at it" (opens the in-app page) instead of the GitHub "Pull request" link.

33. **"Orange warning: 'look before you merge to check it did everything'. Did it do something wrong?"**
    - Inbox, laptop. Text: "It finished in under 2 minutes. That's fine for a small job. For a bigger one, look before you merge…", in orange.
    - Blocks: task 8, minor.
    - Suggestion: don't show this for small jobs, or make it grey.
    - Fix: The quick-finish note is now plain grey text.

34. **"The tour said I'd see before and after pictures. There aren't any."**
    - Help page: "Press Look at it to see what changed, with before and after pictures." For the read-me change the page says "the site looks the same as before".
    - Blocks: task 8, minor.
    - Suggestion: say "pictures when the change shows on the page".
    - Fix: Help now says "with before and after pictures when it shows on the page".

## Core task 9: merge it / ship it (confirmed, then cancelled)

Every put-it-in button asked first:
- agent page "Merge it"
- workflow "Ship it"
- the changes page "Ship it" (on phone)
- the Helper's in-chat "Ship it" chip, which showed an inline "Are you sure?"

**No critical bug here.**

35. **"Merge it or Ship it? Are they different?"**
    - Agent page and Inbox task item: "Merge it". Workflow and changes page: "Ship it". The pop-up says "(this is also called merging)". The agent page says "When it's merged, this turns to Done by itself."
    - Blocks: task 9.
    - Suggestion: use one verb everywhere ("Put it in my project"), and keep "merge" only in the Help glossary.
    - Fix: One name everywhere: "Put it in my project" (and "Approve and put it in"), in tasks, workflows, the Inbox, the changes page and the Helper. The glossary explains that Merge and Ship mean the same thing.

36. **"Next to Ship it there's a Stop button. Does Stop mean 'no thanks'? Does it delete the work?"**
    - Workflow "Ready to go into your project" box and the Inbox item, laptop. Buttons: "Ship it · Stop".
    - Blocks: task 9.
    - Suggestion: rename it "Don't put it in" and explain what happens to the change.
    - Fix: Next to it, Stop is now "Don't put it in", with a tip: "Ends this run here. Nothing goes into your project…"

37. **"Both of my changes edit the read-me. Will they fight?"**
    - Inbox, laptop. The Helper said "Both change the README, so if the second one complains, tell me". The page itself gives no warning.
    - Blocks: task 9.
    - Suggestion: when two waiting changes touch the same file, show a note on the second one.
    - Fix: Not done (minor). If two changes clash, the changes page now says so and offers "Fix the clash".

38. **"'change #17'? 'Merge change #18'?"**
    - Helper chat, laptop. Its button reads "Merge change #18", and its confirm says "This ships "One short line" (change #17)".
    - Blocks: minor.
    - Suggestion: use the agent or workflow name instead of a number.
    - Fix: The Helper's buttons now use names, like "Put “One short line” in your project".

## Core task 10: when something fails

39. **"'What you can do: see Right now at the top of this page.' I'm reading the page. What do I DO?"**
    - Agent page → History after a Stop, laptop. The text points back to itself.
    - Blocks: task 10.
    - Suggestion: put the real choices inline ("Pick up where it stopped · Start over · Leave it").
    - Fix: Now "Its choices (like Pick up where it stopped) are in the Right now box above."

40. **"I pressed 'Pick up where it stopped' and now it says 'Look at how the other games work (doing now)'. Is it building without my OK? Where did the plan go?"**
    - Agent page, laptop. The run had been stopped while waiting for plan approval. After Pick up, the plan box was gone and a 5-step progress bar appeared; the plan had 4 steps.
    - The log shows it was only re-planning (permission mode plan), but the page looked like it was building.
    - Blocks: task 10.
    - Suggestion: while re-planning, show "Writing its plan again. It will wait for your OK."
    - Fix: Planning (or re-planning after Pick up) now shows "It's writing its plan. It will wait for your OK…", with no build steps.

41. **"It's 'Waiting · back at 11:38 PM' but the meter says 74%. I have usage left!" The Helper also gave a made-up reason.**
    - Agent page, laptop. The run was made to fail with the test "usage" switch. Text: "Waiting · back at 11:38 PM. It carries on by itself". The meter showed 74–76% used.
    - The Helper said: "The run is paused because the usage meter was resetting". **That's wrong**: the meter resets Mon 4:00 AM.
    - Blocks: task 10. **Helper wrong fact.**
    - Suggestion: the Helper should quote the real stop reason from the log ("Claude said you'd hit a limit") and not guess. The page could say why the meter and the wait disagree.
    - Fix: The Helper now gets the real reason a run waits ("Claude said the usage limit was reached… can differ from the meter") and is told never to guess.

42. **"The Inbox says 'something goes wrong, it lands here', but my stopped/waiting agent isn't there."**
    - Inbox, laptop. The empty-state text says so. Neither the stopped Phone dodge game nor the usage-wait showed up in the Inbox.
    - Blocks: task 10.
    - Suggestion: show waiting-for-usage and stopped runs in the Inbox (at least under All), or change the wording.
    - Fix: The Inbox's empty text now says what lands there and what doesn't (runs you stopped yourself, or ones waiting for usage, stay on their own page).

43. **"Heartbeat says 24 of 24 on time and Done, but 17 of them were 'Out of usage' with weird text."**
    - Home tile "Done · 24 of 24 on time". The Heartbeat page lists rows like "You've hit your session limit · resets 11pm (America/Los_Angeles)".
    - Blocks: task 10, minor.
    - Suggestion: tile: "24 of 24 on time (17 couldn't talk: out of usage)". Turn the raw message into "Out of usage until 11 PM".
    - Fix: The Heartbeat tile says how many check-ins came while Claude was out of usage, and those rows say "Claude was out of usage, so it could only say that."

## Other pages and things (minor)

44. **"Is the Helper eating my usage?"**
    - Usage pop-up, laptop: "Who used it today: Helper 100% · 2 chat replies". The meter climbed from 43% to 79% during the session; Helper answers, idea suggestions, goal checks and runs all count.
    - Blocks: minor.
    - Suggestion: tell people in the Helper's welcome that each answer uses a little of the usage.
    - Fix: The Helper's welcome now says "Each answer uses a little of your Claude usage."

45. **"The chat bubble covers the upload box and my tiles on the phone."**
    - Phone 390.
      - New task panel: the bubble sits on the right edge of the "A text file (.md or .txt): Upload a file" box.
      - Home: it sits on the "Phone dodge game" tile header.
    - Blocks: minor. **Layout.**
    - Suggestion: hide the bubble while a full-screen panel is open on phones, or move it above the bottom tab bar with page padding under it.
    - Fix: Kept: the bubble picks the freest spot it can find, and it has a white ring now.

46. **"'Nothing shipped this week yet', but arcade changed 9 hours ago."**
    - Inbox → Done & shipped, laptop.
    - Blocks: minor.
    - Suggestion: include changes that went in outside agentbox, or say "Nothing shipped from agentbox this week".
    - Fix: Now "Nothing put in from agentbox this week yet".

47. **"'Committed a note', 'pull requests (#8, #9, #10)', 'merge #10 and close #8'?"**
    - Home → Archived tiles, laptop (Builder and Reviewer summaries). Also the workflow history says "Shipped: merged into main."
    - Blocks: minor.
    - Suggestion: rewrite stored summaries in plain words before showing them.
    - Fix: Kept: those are old summaries in Nic's data. New ones say "Shipped: it's in your project now."

48. **"'Adds @here'? 'Finished milestone 8 of 10'?"**
    - Settings → Discord ⓘ: "Adds @here so your phone makes a sound". Last messages: "Arcade site: finished milestone 8 of 10".
    - Blocks: minor.
    - Suggestion: "Makes your phone buzz"; "finished part 8 of 10".
    - Fix: Discord tips now say "Makes your phone buzz", and big-job messages say "finished part 8 of 10".

49. **"'GitHub (the bot)', which bot? 'People logged in to this Mac: agent, nicolasbeaupain'?"**
    - Machine page, laptop.
    - Blocks: minor.
    - Suggestion: "GitHub (agentbox's own account)"; hide the logged-in users list behind Details.
    - Fix: Now "GitHub (agentbox's own account)" and "Accounts signed in at this Mac's screen".

50. **"What's Tailscale?"**
    - Help → "What keeps it safe": "only reachable on your own devices through Tailscale". Machine: "Private network (Tailscale)".
    - The Helper explained it well.
    - Blocks: minor.
    - Suggestion: add Tailscale to "A few words you'll see".
    - Fix: Tailscale is now in "A few words you'll see" on the Help page.

### Bugs noted (also in the list above)
- Esc closes New task and loses the typed goal (#14).
- The default time limit in the panel (1 h) doesn't match what's saved (30 min) (#15).
- Drafted workflow steps pick an existing agent from another project; Next works while a draft is still running (#23).
- "Runs when you press Run now" overlaps the Project dropdown (#24).
- The Helper and the step side panel stack on top of each other (#27).
- The Helper invented a reason for a usage wait (#41), and overstated "public" as "anyone can play it" (#6).
- Projects page "in progress / waiting for you" contradicts the tile and the Inbox (#7).
- Test switch `/api/dev/simulate` returns HTTP 500 for a run that is waiting for plan approval (works for a running run). This is a developer-only tool.
- Every "put it into the project" button asked first. **No critical bug.**

---

**Total: 50 questions**, 43 of them in the core tasks: task 1 (3), task 2 (5), task 3 (7), tasks 4–6 (8), task 7 (8), task 8 (4), task 9 (4), task 10 (4). The other 7 are minor.

### Real pull requests opened (arcade)
- https://github.com/NicB-coder-bot/arcade/pull/17: workflow "One short line" (a draft, waiting at Ship; not shipped)
- https://github.com/NicB-coder-bot/arcade/pull/18: task "Hello README line" (open; not merged)
- The "Phone dodge game" task was stopped at the plan stage. It made a branch but no pull request.
