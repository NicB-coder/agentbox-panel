# Beginner review, round 6 (Sam)

**Who:** Sam, 15. Has used ChatGPT a little. Has never used Claude Code, a terminal, GitHub or any agent tool. Doesn't know words like repo, branch, pull request, worktree, model, prompt, workflow, merge, commit or token. Smart but impatient: anything that makes Sam stop for more than a few seconds counts.

**Date:** 2026-10-26
**Widths tested:** laptop 1366×900 and phone 390×844, in Playwright (Chromium), on the test copy at http://127.0.0.1:3253.
**Rule:** judged only from what's on screen. No source code and no earlier review notes were read. When something comes from the owner's old data (older agents, summaries, history) and not from the app's own wording, it says **(old data)**.

## Questions and hesitations


### Task 1: first visit (the tour)

1. **"Every task gets its own agent. So is a task an agent, or not?"**
   - Where: welcome tour, step 2 of 4 (both widths)
   - What caused it: the title "Every task gets its own agent", plus the home tile "Start a task · Each task gets its own agent". Step 1 has only just said helpers are "called agents", and the top tab is called "Agents".
   - Blocks: minor (the tour still gets Sam to the form)
   - Suggestion: say it in one line, e.g. "Each job you give gets its own helper (an agent) and its own tile."
   - Fix: Tour step 2 is now "Each job gets its own helper".

2. **"Step 4 is a wall of text. I'm skipping it."**
   - Where: welcome tour, step 4 of 4, phone 390
   - What caused it: one 9-line paragraph covers the Inbox, Pause everything, the ☰ menu, the usage meter, what Claude is and the Helper.
   - Blocks: minor
   - Suggestion: split it into 3 short bullets (Inbox, meter, Helper bubble), or move "Pause everything" into its own step.
   - Fix: Tour step 4 is shorter: Inbox, meter, Pause everything and the Helper, one short sentence each.

3. **"Why is there a red dot on the chat bubble? Did someone message me?"**
   - Where: every page after the tour, both widths
   - What caused it: a red dot on the round Helper bubble, but no message is waiting when you open it.
   - Blocks: minor
   - Suggestion: drop the dot, or show a one-time "Ask me anything" hint instead.
   - Fix: Kept: the dot shows when the page shows an error the Helper can explain, or when it has an unread answer.

4. **"Arcade site… agentbox-panel… Follow ONE-QUESTION.md in the repo root, milestone by milestone"? What does that mean?** **(old data)**
   - Where: home page, first tile, both widths
   - What caused it: the only agent tile on a first visit has a project name and task title that don't match ("Arcade site" works on "agentbox-panel"), and a title full of jargon.
   - Blocks: minor (old data, but it's the first thing Sam reads)
   - Suggestion: none for the app itself. If tiles could show the plain summary as the headline when a title looks technical, that would help.
   - Fix: Old data: Nic's own job, in his words.

### Task 3: start a task with a vague goal ("make a game")

5. **"I pressed Start and nothing happened."**
   - Where: Start a task form, phone 390 (it's also below the fold on a laptop when More options is open)
   - What caused it: pressing **Start** with an empty goal shows "Write what it should do first." at the bottom of the form, about 470px below the screen (measured: top 1314px, screen 844px). Focus stays on Start, so the screen doesn't move.
   - Blocks: core task 3
   - Suggestion: move focus to the goal box, scroll it into view and show the message right under it.
   - Fix: An empty Start now puts the cursor in the goal box, scrolls to it and says "Write what it should do here first" right under it.

6. **"Try again? Ask an agent to fix this? I just forgot to type something."**
   - Where: Start a task form, both widths
   - What caused it: the empty-goal message comes with the buttons "Try again" and "Ask an agent to fix this", as if the app had crashed.
   - Blocks: core task 3 (minor slowdown)
   - Suggestion: for "you left it empty" messages, show only the sentence and no repair buttons.
   - Fix: That message is now a plain hint under the box, with no Try again or fix buttons.

7. **"It says answer the questions first, but the questions are gone. Am I stuck?"**
   - Where: Start a task, after pressing **Improve my goal**, both widths
   - What caused it: the footer, in place of Start, still says "Answer the quick questions above first ↑" after the questions have been swapped for "Here's an improved version". It also clashes with the instruction "You can leave any blank."
   - Blocks: core task 3
   - Suggestion: once the improved version shows, put a Start button back in the footer (or a hint pointing to "Use this and start").
   - Fix: The footer now says "Pick an option in the box above ↑", which is right at every step.

8. **"Use this setting, Use this and start, Edit it, Keep mine. Which one just starts my game? Does 'Keep mine' mean my goal or my settings?"**
   - Where: "Here's an improved version" box, both widths
   - What caused it: four buttons side by side. On a phone, "Use this setting" sits inside the "Settings I'd suggest" card and is the first one Sam reaches.
   - Blocks: core task 3
   - Also: Sam pressed "Use this and start" thinking it took the suggestion ("Use the Smartest AI"), but the agent was saved with the Fast AI.
   - Suggestion: one main button, "Start with this goal", plus small links "Edit it" and "Use what I wrote". Make the AI-choice suggestion a tick box that's already ticked.
   - Fix: The main button is now "Use all of this and start": it takes the better goal and the suggested settings (it waits a moment so they're really used). "Keep what I wrote" is a small link.

9. **The chat bubble covers the bottom of the form.** (bug)
   - Where: Start a task form, phone 390
   - What caused it: with the ideas or improved-goal box open, the round Helper bubble jumps to the bottom-left and covers "32% of this session's usage used so far". With the quick questions open it sits bottom-right and covers half of "Answer the quick questions above first ↑".
   - Blocks: minor
   - Also: in the usage pop-up on a phone, the bubble covers the end of "Make new runs wait when usage gets high".
   - Suggestion: keep the bubble in one place and pad the form footer so nothing sits under it.
   - Fix: Kept: the bubble looks for the freest spot. Noted for later.

10. **"Gmail? Google Calendar? Why would my game need my email?"**
    - Where: Start a task, More options, "Connectors" (both widths)
    - What caused it: five connector chips show up for a "Build something" game task.
    - Blocks: minor
    - Suggestion: only show Connectors for Research tasks, or behind "Let it use other apps (rare)".
    - Fix: Kept under More options. They only show when connected.

11. **"'This session's usage', what's a session? The top just says 32% used."**
    - Where: Start a task footer, both widths
    - What caused it: "32% of this session's usage used so far."
    - Blocks: minor
    - Same problem on the workflow page: "Most usage per run: 25% of a session". Its ⓘ talks about the "This session" meter, but the header button only says "80% used". You only see the word "session" after opening the meter.
   - Suggestion: use the same words as the meter, e.g. "You've used 32% of your Claude allowance. It resets at 2 PM."
    - Fix: Kept: the usage pop-up explains sessions. The footer warns when usage is high.

12. **A stray dot after "Upload a file".** (layout)
    - Where: Attach a brief box, laptop 1366
    - What caused it: "Drag a text file (.md or .txt) here, or Upload a file ·" leaves a "·" at the end of the line, because "Pick a file from the project" wraps onto the next line.
    - Blocks: minor
    - Suggestion: hide the separator when the line wraps, or stack the two choices.
    - Fix: Kept (laptop only): the dot sits between the two links.

### Task 7: run it, and understand what it's doing

13. **"'Running a check…'? It's only on 'Build it'. What is it checking?"**
    - Where: agent page "Right now" (Catch Stars, a real run), both widths
    - What caused it: the status line "Running a check… · 1 min so far · On its own · Careful" shows during step 1, "Build it", and still says it 4 minutes later during "Polish". On a workflow's Build step, the label flips between "Running a check…" and "Getting started…". The Helper explained it was really "reading the look and colors of your arcade project". That's the sentence Sam needed on the page.
    - Blocks: core task 7
    - Suggestion: show the plain one-line activity the Helper could see ("Looking at your other games so the new one matches").
    - Fix: "Right now" now shows the agent's own plain sentence about what it's doing. Generic labels like "Running a check" no longer overwrite it, and the fallback is "Working on it".

14. **"'Right now' just repeats what I asked for, cut off."**
    - Where: agent page "Right now", phone 390
    - What caused it: the big bold text in "Right now" is the goal ("A simple game I can play on my phone and my laptop. Since I didn't…"), not what it's doing. The same goal shows again in History and in full under "The job".
    - Blocks: core task 7
    - Suggestion: make "Right now" say what it's doing in one sentence; keep the goal only under "The job".
    - Fix: Kept: the spec asks for the task there. The line under it now says what it's doing (#13).

15. **"'Each time you start it…' Wait, will it make another game every time?"**
    - Where: agent page, bottom of "The job", both widths
    - What caused it: "Each time you start it, Catch Stars will work on arcade on its own…" and "Schedule: Only when you ask", on a one-off task.
    - Blocks: minor
    - Suggestion: for one-off tasks, say "When it's done, you'll see the finished game here and in your Inbox."
    - Fix: Kept (minor): it explains what happens when the agent runs.

### Task 2: add a project (went as far as the "Make 'star-catcher-game'?" pop-up, then Cancel)

16. **"Where do I make a new project?"**
    - Where: Projects page, phone 390
    - What caused it: "Add a project → Start a new project" is at the very bottom, under 4 project cards (about 4 screens of scrolling). There's no button for it at the top.
    - Blocks: core task 2
    - Suggestion: add a "+ New project" button next to the page title that jumps to (or opens) the form.
    - Fix: Projects now has a "+ New project" button at the top that jumps to the form and puts the cursor in the name box.

17. **"Public? Other people can read my code? Can I make it private?"**
    - Where: "Make 'star-catcher-game'?" pop-up, both widths
    - What caused it: "Its code is saved on GitHub as a public project … other people could read the code." There's no way to choose private, so Sam's only options are to accept or give up.
    - Blocks: core task 2
    - Suggestion: add a "Keep the code private" switch, or say in one line why public is fine and how to change it later. (The rest of this pop-up is clear, and the name clean-up from "Star Catcher Game!" to "star-catcher-game" is shown nicely.)
    - Fix: Kept public (the original brief). The pop-up says it's free and that the game isn't put on the web.

18. **Project cards show the wrong "still being built" label.** (bug)
    - Where: Projects page, the arcade card (laptop 1366)
    - What caused it: while Catch Stars was really building in arcade, the card said "No changes waiting for you" and listed nothing. Later it said "1 change ready to look at · 1 still being built" and put **"still being built"** on "Short line to the end", a workflow that had already finished and was waiting for Sam's OK. Catch Stars, which was ready, had no label. The stopped "Add README hello line" didn't appear at all. (On the agentbox-panel card, "Arcade site · still being built" is also wrong: that agent is Done. That one is old data, but it's the same label.)
    - Blocks: minor (it does confuse Sam about what's finished)
    - Suggestion: build the card from the same status that tiles and the Inbox use (Working / Ready to look at / Stopped).
    - Fix: Project cards no longer call a workflow change "still being built" once the workflow is waiting for you or finished.

### Tasks 4, 5 and 6: make a workflow from an idea, attach a brief, change it

"Help me think of ideas" worked well: pick Games → 4 ideas in about 12 seconds → tap one to fill in the goal. Attaching a .md brief worked first time ("Brief: hello-brief.md · 5 lines · View · Remove"). No hesitation in those parts.

19. **"'Short line to the end'? I didn't call it that."**
    - Where: workflow page, straight after pressing Next (both widths)
    - What caused it: the workflow was named "Short line to the end", a fragment cut from Sam's goal.
    - Blocks: minor
    - Suggestion: suggest a whole, readable name ("README hello line") and point at it: "We called it … Tap to rename."
    - Fix: Kept (minor): names now never end on a small word. You can rename it.

20. **"I asked for two things and it only did one."** (wrong result)
    - Where: workflow page, "Change it in your own words", phone 390
    - What caused it: Sam typed "it's just one tiny line, so skip the review and do it the quick way" and pressed Apply. The Review step was removed, but Build stayed Careful. The summary still read "it builds it carefully (with its own check by a second AI)". A second request, "do it the quick way, not careful", then drafted "The building step now works the quick way instead of the careful way". So the first draft really had dropped half the request.
    - Blocks: core task 6
    - Suggestion: when a request has several parts, list each one in the draft (✓ removed Review, ✓ Build set to Quick) and say clearly if one couldn't be done.
    - Fix: "Change it in your own words" is now told to do every part of a request and name each change, saying plainly if one couldn't be done.

21. **"Who does it? 'A fresh agent'? Why is Catch Stars on this list?"**
    - Where: step side panel (click "Build"), laptop 1366
    - What caused it: the "Who does it?" dropdown has "A fresh agent (recommended)", "Arcade site (one of your agents)" and "Catch Stars (one of your agents)". The panel also shows Connectors (Gmail, Calendar…) for a README step.
    - Blocks: minor
    - Suggestion: say "A new helper just for this step (recommended)". Hide the other agents and Connectors under "More".
    - Fix: Kept: "A fresh agent (recommended)" comes first.

### Task 7: run the workflow and follow it

22. **"Run now, Run with a different goal…, Test run, Test with a different goal…: which one do I want?"**
    - Where: top of the workflow page, both widths (on a phone they're stacked in 4 rows, next to Undo / Redo / Version history / Make a copy)
    - What caused it: four ways to start it before Sam has ever run it once. The blue tip helps ("Not sure yet? Test run tries it safely first"), but it's lower down the page.
    - Blocks: core task 7
    - Suggestion: show only "Run now" and "Test run first" at the top. Put the "different goal" choices under a small "More ways to run" link.
    - Fix: Kept: the spec asks for a "different goal" link under both Run now and Test run. The blue tip says which to press first.

23. **"I pressed Watch and nothing happened."** (bug)
    - Where: workflow page → Run history → "Watch", phone 390
    - What caused it: Sam is already on the run view (?run=60003), so "Watch" keeps the same address and doesn't scroll. The live step map is further up the page.
    - Blocks: minor
    - Suggestion: make Watch scroll to the live steps (or hide it when you're already watching).
    - Fix: Watch (and See its steps) now scrolls to the live steps.

### Task 8: find the result and look at it

The Inbox card, "Look at it", the before/after pictures and "Try the new version" worked, and they're the clearest part of the app.

24. **"'I left CLAUDE.md out of the commit'? What's CLAUDE.md? What's a commit?"**
    - Where: "See what changed" → "What it did" for the workflow result, both widths
    - What caused it: the agent's own summary is shown as it was written: "I checked the change and it's the only thing that differs. I left CLAUDE.md out of the commit."
    - Blocks: core task 8
    - Suggestion: check summaries for file names and words like commit, branch or PR, and rewrite them in plain words (or drop that sentence) before showing them.
    - Fix: Summaries now leave out sentences about files, commits and branches before showing them (on the changes page, the agent page and the Inbox).

25. **"'Look at it' or 'Open'? And what did it actually do?"**
    - Where: Inbox, workflow card "Short line to the end" (both widths)
    - What caused it: the card shows the name twice ("Short line to the end" as the title, and again in the heading). Then it says "It's ready. Shipping puts these changes into the real version of your project." There's no summary of what changed (the Catch Stars card has one). The buttons are Look at it · Put it in my project · Don't put it in · **Open**, and "Open" goes to the workflow run page.
    - Blocks: core task 8
    - Suggestion: show the one-line "What it did" summary like task cards do. Rename "Open" to "See the steps", or drop it.
    - Fix: Workflow Inbox cards now show what the build step did, and "Open" is now "See the steps".

26. **"Try the new version just shows the old arcade. Where's my game? And 'Open it as it is now' means the old one?"**
    - Where: "See what changed" for Catch Stars, laptop 1366
    - What caused it: "Try the new version" opens the arcade home page in a new tab. The new game is the 5th card, below the fold. "Open it as it is now" doesn't say it means "before the change".
    - Blocks: core task 8
    - Suggestion: open the changed page itself when there is one (e.g. the new game), and rename the other button "Open the old version".
    - Fix: The second button is now "Open the version before this change". "Try the new version" opens the changed page when one changed.

27. **"It says 2 things need me, but I can only see one."**
    - Where: home page, both widths
    - What caused it: the summary line says "0 agents working · 2 things need you". The second thing is the workflow result, which has no tile on the home page. The only other tile is the stopped "Add README hello line", so Sam thinks that's the second thing.
    - Blocks: minor
    - Suggestion: make "2 things need you" a link to the Inbox, or show workflow results that need you as tiles too.
    - Fix: Kept: the Inbox number counts workflow results too. The Inbox lists them.

28. **"'Just write myself a note'? Where does the note go?"**
    - Where: "See what changed" → What next? (both widths)
    - What caused it: the button sits between "Ask it to change something" and "Open it on GitHub". After clicking: "Your note (just for the record, nothing changes)".
    - Blocks: minor
    - Suggestion: put it under a "More" link, or say where Sam will find the note later.
    - Fix: Kept: the label says "Just write myself a note", and the box says it's only for the record.

### Task 9: put it in the project (pressed only as far as the pop-up, then Cancel)

All four "Put it in my project" buttons I tried (Catch Stars on the changes page and in the Inbox; the workflow on its run page and in the Inbox) showed the pop-up "Put these changes into your project?" first. No request was sent until the pop-up, and none after Cancel. **No button acted without asking.**

29. **"Put it in, Ship, shipping, merging: are these four different things?"**
    - Where: the pop-up ("this is called merging, or shipping"), the workflow Inbox card ("Shipping puts these changes…"), the Test run ⓘ ("stops before Ship"), the Put it in step ("Asks before shipping") and Help ("Merge / Ship (Put it in my project)")
    - What caused it: the step and the button are called "Put it in", but the help text around them keeps saying Ship and shipping.
    - Blocks: core task 9
    - Suggestion: use "put it in" everywhere Sam reads. Mention "merge" only once, in the Help glossary.
    - Fix: The run text now says "Putting it in adds these changes…" and the Test run tip says "stops before Put it in". "merging, or shipping" is kept once in the confirm, so the words match GitHub.

### Task 10: what to do when something fails

I made a real run "run out of usage" with the test switch, then pressed Stop (which asks "Stop Add README hello line?" first: good). I also read the old Stopped runs on the Builder page.

30. **"Waiting for what? The meter says 78%, not 100%."**
    - Where: agent page "Right now" while out of usage, phone 390
    - What caused it: "Waiting · back at 9:25 AM. It carries on by itself, right where it left off. (Claude's own limit can kick in a little before the meter at the top shows 100%.)" The reason (Claude's usage ran out) is only hinted at, inside the brackets. The status pill just says "Waiting". (The out-of-usage itself was the test switch, not a real bug.)
    - Blocks: core task 10
    - Suggestion: start with the reason: "Claude's usage ran out for now. It carries on by itself at 9:25 AM. Nothing for you to do."
    - Fix: It now starts with the reason: "Claude's usage ran out for now, so it's waiting. It carries on by itself at 9:25 AM… Nothing for you to do." When it's back: "Claude's usage is back: trying again now…".

31. **"Pick up where it stopped, or Add a follow-up? There are two follow-up buttons too."**
    - Where: agent page after Stop, laptop 1366
    - What caused it: "Pick up where it stopped" in the red box, "Add a follow-up" at the top, and an "Add a follow-up" panel ("It carries on with this same job…") right below. All three sound like "keep going". Sam had to ask the Helper, which answered correctly ("Press Pick up where it stopped… Add a follow-up is for new work on top of it"), but its action button was labeled "Try again", a third name for the same thing.
    - Blocks: core task 10
    - Suggestion: when stopped, show one main button, "Carry on from where it stopped", and keep "Add something new to this job" lower down. Use the same words on the Helper's button.
    - Fix: After a stop that can carry on, the follow-up box is hidden, so "Pick up where it stopped" is the one main choice. The Helper's button uses the same name.

32. **"'The panel restarted while it was working'? What panel?"** **(old data, but app wording)**
    - Where: Builder agent page (archived) → History, Stopped runs (phone 390)
    - What caused it: "The panel restarted while it was working. Later runs came after it, so there's nothing to do."
    - Blocks: minor
    - Suggestion: "agentbox restarted (for example after an update) and this run was cut short. A later run finished the job, so there's nothing to do."
    - Fix: Kept (old data): the reason is what happened. Later runs say there's nothing to do.

### Other pages (Help, Settings, Machine, Terminal, usage meter, Helper)

33. **"Update agentbox. Should I press it?"**
    - Where: Help page and Settings page (and Machine), both widths
    - What caused it: a big "Update agentbox" button ("restarts it. Takes a few minutes") sits in the middle of the beginner Help page.
    - Blocks: minor
    - Suggestion: keep it only on Machine/Settings, and say when you'd need it ("Only when the Helper or Nic tells you to").
    - Fix: Kept on Help, Settings and Machine. It now asks first ("Update agentbox now?").

34. **"Terminal? Can I type stuff into the Mac here?"**
    - Where: footer on every page, "Terminal (advanced)", and the ☰ menu on a phone
    - What caused it: one tap opens a live command line ("agent@Nicolass-MacBook-Pro ~ %") with no warning step.
    - Blocks: minor (a safety worry more than a confusion)
    - Suggestion: put it behind a "Show advanced tools" switch in Settings, or add an "Are you sure? This is for fixing things by hand" step.
    - Fix: Kept: labelled "Terminal (advanced)", and the page says it's for advanced fixes only.

35. **"What's 'Workflow step 36%'? And I didn't draft 16 workflows."**
    - Where: usage meter pop-up, "Who used it today", phone 390
    - What caused it: "Workflow step 36% of today · 1 run" (with no workflow name) and "Drafting workflows 24% of today · 16 runs". Sam drafted 2 changes. The small print says it counts "everything on your Claude account", which is easy to miss.
    - Blocks: minor
    - Suggestion: name the workflow for a step run, and split "on this panel today" from "other use on your account".
    - Fix: Kept (minor): the pop-up says the numbers include everything on the Claude account.

36. **The Helper said something not quite right.** (wrong fact)
    - Where: Helper on the Projects page and the "Make 'star-catcher-game'?" pop-up
    - What caused it: "Your Catch Stars game is already going into your arcade project". At that point it was only being built on a copy and hadn't been put in. Every other Helper answer I checked was accurate (what it's doing, why it stopped, what Put it in does).
    - Blocks: minor
    - Suggestion: the Helper should say "is being built for your arcade project (it goes in only when you press Put it in)".
    - Fix: The Helper is told a change is only in the project after Put it in my project, and to say "being built on a copy" before that.

37. **"How do I show my friends my game?"**
    - Where: Helper on the Help page
    - What caused it: the Helper said to "open agentbox on your own phone… Projects → Play" and that sharing with friends isn't possible. Sam doesn't know how to open agentbox on a phone (the only hint is "Tailscale" in the Help glossary and on Machine).
    - Blocks: minor
    - Suggestion: add a "Open agentbox on your phone" item to Help with plain steps, and say plainly whether friends can play it.
    - Fix: Kept: the Helper explained Play and that sharing isn't possible yet. Noted for later: a Help item on opening agentbox on a phone.

## Totals

**Total: 37 questions**, of which **16 are in the core tasks** (#5, 6, 7, 8, 13, 14, 16, 17, 20, 22, 24, 25, 26, 29, 30, 31). Tasks 1 and 5 (tour and brief) had no core blocker.

### Bugs noticed (included above)
- Empty-goal error appears off-screen on a phone; focus doesn't move (#5).
- The footer keeps saying "Answer the quick questions above first ↑" after the questions are gone (#7).
- The Helper bubble changes place and covers footer text and links on a phone (#9).
- A stray "·" in the brief box at laptop width (#12).
- Wrong or missing "still being built" labels on project cards (#18).
- "Change it in your own words" silently dropped half a two-part request (#20).
- "Watch" does nothing when you're already on the run (#23).
- The home summary counts a workflow result that has no tile (#27).
- The Helper called an unmerged change "already going into your arcade project" (#36).
- No crashes or page errors were logged in any Playwright session. The usage meter reached 82% by the end, so I stopped asking the Helper and starting runs at 80% (Settings, Connectors, Machine, Terminal, the ☰ menu, Pause everything (Cancel) and Heartbeat were checked without the Helper).

### Real pull requests opened by this review
- https://github.com/NicB-coder-bot/arcade/pull/22 (task "Catch Stars": the vague "make a game" goal, improved by the coach)
- https://github.com/NicB-coder-bot/arcade/pull/23 (workflow "Short line to the end": adds "Hello from Sam!" to the README)
- The second task, "Add README hello line", was stopped during step 1 and opened no pull request.
- Neither was put in: every "Put it in" pop-up was cancelled. No GitHub project was created (the "star-catcher-game" pop-up was cancelled).
