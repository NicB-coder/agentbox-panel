# Beginner review, round 3: "Sam"

**Who:** Sam is 15. Sam has used ChatGPT a bit, but never Claude Code, a terminal, GitHub or any agent tool. Sam doesn't know words like repo, branch, pull request, worktree, model, prompt, workflow, merge, commit or token. Sam is smart but impatient: any pause of more than a few seconds counts.
**Date:** 2026-10-25
**Copy tested:** the test copy at http://127.0.0.1:3253, with the welcome tour reset first.
**Widths:** laptop 1366×900 and phone 390×844 (Playwright, Chromium). I looked at every screenshot and read the page text.
**Real runs:** 2 task runs and 1 workflow run, all on **arcade**. I pressed Merge it and Ship it only far enough to read the "are you sure" pop-up, then pressed Cancel every time.

**Safety check:** every Merge it / Ship it button I found asked first. That covers the agent's "See what changed" page, the Inbox card, the Helper's own "Merge change #14" button and the workflow's "Ship it" box. **No button acted without asking.**

Core tasks: 1 First visit · 2 Add a project · 3 Start a task · 4 Workflow from an idea · 5 Attach a brief · 6 Edit a workflow · 7 Run it and understand it · 8 Find the result · 9 Merge / ship · 10 When something fails.

---

## Questions and hesitations

1. **"Is this my arcade? What's ONE-QUESTION.md and a 'repo root'?"**
   - Where: Home page, first tile (laptop + phone)
   - What caused it: tile "Arcade site", project "agentbox-panel", task "Follow ONE-QUESTION.md in the repo root, milestone by milestone."
   - Blocks: 1 (first visit) and 8
   - Suggestion: an agent called "Arcade site" shouldn't work on agentbox-panel. Show a plain one-line title on tiles, never file names.
   - Fix: _(to do)_

2. **"What's a QA checklist? What are '8 real jobs'?"**
   - Where: Home tile summary (both widths)
   - What caused it: "…recorded it all in a fully ticked QA checklist."
   - Blocks: minor
   - Suggestion: keep tile summaries free of jargon, or shorten them to one plain sentence.
   - Fix: _(to do)_

3. **"23% used… of what? Then it was 94% an hour later. Did my two small jobs use up almost everything?"**
   - Where: header usage meter (both widths)
   - What caused it: "23% used" climbed to "94% used" (amber) during my session, with no warning before I pressed Start.
   - Blocks: 7
   - Suggestion: before Start, show a rough cost ("this usually uses about 10%"). Warn when a run would push past ~80%.
   - Fix: _(to do)_

4. **"Today is Sunday. Does the week reset tonight or next Sunday? And why does another page say 3am?"**
   - Where: usage pop-up and Heartbeat page (laptop)
   - What caused it: "This week: 28% used … Resets Sun 2:00 AM", but Heartbeat says "weekly limit · resets 3am".
   - Blocks: minor
   - Suggestion: say "resets next Sunday at 2:00 AM (in 6 days)" and use the same time everywhere.
   - Fix: _(to do)_

5. **"What's Claude? I thought this was agentbox."**
   - Where: tour step 4 (both widths)
   - What caused it: "how much of your Claude usage you've used".
   - Blocks: 1 (minor)
   - Suggestion: one clause: "Claude (the AI that does the work)".
   - Fix: _(to do)_

6. **"#8, #9, #10? Merge #10 and close #8?"**
   - Where: Home > Archived, Reviewer tile (laptop)
   - What caused it: "I checked the 3 open pull requests (#8, #9, #10)… merge #10 and close #8"
   - Blocks: minor
   - Suggestion: put agent summaries through the same plain-words rewrite used elsewhere.
   - Fix: _(to do)_

7. **"What's a pull request? Is it something I have to send?"**
   - Where: agent page "The job" box and progress steps (both widths)
   - What caused it: "send you a pull request, reviewed and fixed before you see it" and the last step "○ Send the pull request".
   - Blocks: 7
   - Suggestion: say "show you the finished change" and "Get it ready for you". Keep "pull request" for the Help page only.
   - Fix: _(to do)_

8. **"It says Done, but the log is empty?"**
   - Where: Arcade site agent page > Show the full log (laptop)
   - What caused it: "There's nothing in this log yet." on a job finished 2 days ago.
   - Blocks: 10 (minor)
   - Suggestion: if the old log is gone, say so ("This run's log was cleaned up after it finished").
   - Fix: _(to do)_

9. **"Is it Done, in progress, or still being built? Three pages say three things."**
   - Where: Home tile, See what changed page, Projects page (laptop)
   - What caused it: tile "Done" · changes page "Arcade site (in progress)" + "Waiting for you" · Projects "1 change waiting for you to look at — Arcade site (in progress) **still being built**".
   - Blocks: 8
   - Suggestion: use one status per thing everywhere. "Finished, waiting for you to look" can't also be "still being built".
   - Fix: _(to do)_

10. **"Ready to look at, Needs you, Pull request ready, Waiting for you… are these the same?"**
    - Where: one finished task, four places (both widths)
    - What caused it: tile pill "Ready to look at", agent history "Needs you", Inbox "Pull request ready", changes page "Waiting for you".
    - Blocks: 8
    - Suggestion: pick one phrase ("Ready to look at") and use it everywhere.
    - Fix: _(to do)_

11. **"Who is 'a reviewer'? Did I just start something by opening this page?"**
    - Where: See what changed (laptop)
    - What caused it: "A reviewer is reading it now…" appeared seconds after I opened an old change.
    - Blocks: 8
    - Suggestion: say "A second AI is double-checking this (uses a little usage)" and explain why it started.
    - Fix: _(to do)_

12. **"Which of these files is the game?"**
    - Where: See what changed > Show the exact changes (laptop)
    - What caused it: list of "app/api/agents/[id]/brief/route.ts +12 −0" and so on.
    - Blocks: minor
    - Suggestion: put a plain grouping on top ("3 new pages, 1 changed page") above the raw list.
    - Fix: _(to do)_

13. **"Why can I only press Play on arcade?"**
    - Where: Projects page (both widths)
    - What caused it: only the arcade card has "▶ Play". The other three have none and no reason is given.
    - Blocks: minor
    - Suggestion: show a greyed Play with a reason ("Nothing to play yet").
    - Fix: _(to do)_

14. **"Merge a file? I just want to add it."**
    - Where: Projects > "Add a file" ⓘ (laptop)
    - What caused it: "It shows up in your Inbox first: press Merge it there to finish adding it."
    - Blocks: minor
    - Suggestion: "…press Add it to my project in the Inbox."
    - Fix: _(to do)_

15. **"How do I 'allow' the bot to see my project?"**
    - Where: Projects > "Already on GitHub?" ⓘ
    - What caused it: "The agentbox GitHub account (NicB-coder-bot) needs to be allowed to see it."
    - Blocks: 2 (minor)
    - Suggestion: link to a short how-to, or say "Ask Nic to share it with NicB-coder-bot".
    - Fix: _(to do)_

16. **"Public? Can I make it private? Will people see my name?"**
    - Where: Projects > Make it > pop-up (laptop)
    - What caused it: "It's saved on GitHub as a public project: other people can look at the code…" There's only Cancel / Make it.
    - Blocks: 2
    - Suggestion: offer a "Keep it private" choice, or say plainly that the bot's name (not yours) is shown. The Helper had to explain this.
    - Fix: _(to do)_

17. **"Could I break agentbox itself if I pick that?"**
    - Where: New task / New workflow, Project dropdown (both widths)
    - What caused it: "agentbox-panel (this app itself)" sits right next to my games.
    - Blocks: 3
    - Suggestion: put it last, under an "Advanced" divider, or ask "Are you sure? This changes agentbox itself."
    - Fix: _(to do)_

18. **"What's that little dot? Is 'Pick a file' part of it?"**
    - Where: New task > Attach a brief (both widths)
    - What caused it: "Upload a file **·**" with "Pick a file from the project" wrapped onto the next line.
    - Blocks: 5 (minor)
    - Suggestion: put the two links on one line, or make them two clear buttons.
    - Fix: _(to do)_

19. **"'Model'? And why would my game need my Gmail?"**
    - Where: New task > More options (laptop)
    - What caused it: label "Model" (Fast/Smartest), and Connectors "Gmail · Google Calendar · Google Drive…"
    - Blocks: 3 (minor)
    - Suggestion: rename to "Which AI". Hide Connectors for Build tasks unless asked.
    - Fix: _(to do)_

20. **"Tell me when… on what? I don't have Discord."**
    - Where: New task > More options and agent settings
    - What caused it: "Tell me when ✓Finished ✓Needs my OK ✓Something goes wrong" all on by default; the ⓘ says Discord.
    - Blocks: minor
    - Suggestion: hide this, or show "Messages aren't set up" when Discord isn't connected for this person.
    - Fix: _(to do)_

21. **"Five buttons. 'Skip the questions' or 'Skip this and start'? What's the difference?"**
    - Where: New task > "A few quick questions" (laptop)
    - What caused it: "Improve my goal · Skip the questions · Keep mine and start" plus footer "Cancel · Skip this and start". Later "Use this and start · Edit it · Keep mine" plus the same footer.
    - Blocks: 3
    - Suggestion: hide the footer buttons while the question box is open. At most 2 choices.
    - Fix: _(to do)_

22. **"Should I press 'Turn it on'? What happens if I don't?"**
    - Where: improved goal > "Settings I'd suggest" (laptop)
    - What caused it: "Use the Smartest model · Games have rules and tricky logic… Turn it on"
    - Blocks: 3 (minor)
    - Suggestion: say what it costs ("uses more of your usage").
    - Fix: _(to do)_

23. **"Wait, the agent I clicked is gone. Oh, it renamed itself?"**
    - Where: agent page while running (laptop)
    - What caused it: the name changed from "Puzzle game" to "Puzzle Tile Quest" about a minute into the run. The Helper then gave a made-up reason ("agentbox names it after what you asked for").
    - Blocks: 7
    - Suggestion: keep the first name, or show "Renamed to Puzzle Tile Quest" for a moment.
    - Fix: _(to do)_

24. **"Step 1 of 6 AND a second list of steps? What are 'rule checks' and 'docs'?"**
    - Where: running agent page (laptop)
    - What caused it: "Step 1 of 6 · Build it" plus a separate "Build it, step by step" list. The status line said "the game and its rule checks are written and passing. Next I'll tidy the docs".
    - Blocks: 7
    - Suggestion: put the inner steps inside the current big step. Ban "docs", "tests" and "rule checks" in update lines.
    - Fix: _(to do)_

25. **"The title is my whole paragraph. And 'optimized'… what got optimized?"**
    - Where: Inbox card, changes page (both widths)
    - What caused it: card title "What to make: Make a simple puzzle game, a brain teaser with one level…" and "Reviewed ✓ · optimized".
    - Blocks: 8
    - Suggestion: use the agent's short name as the title ("Memory game"). Drop or explain "optimized".
    - Fix: _(to do)_

26. **"A second opinion from who?"**
    - Where: Inbox > More options
    - What caused it: "Get a second opinion"
    - Blocks: minor
    - Suggestion: "Ask another AI to double-check it".
    - Fix: _(to do)_

27. **"'…on both my ph'… ph what?"**
    - Where: See what changed subtitle and the Merge confirm (laptop + phone)
    - What caused it: "…that I can play on both my ph" and "(change #14)… a brain teaser with one level, that I c". The text is cut mid-word with no "…".
    - Blocks: 8 (minor bug)
    - Suggestion: cut at a word boundary and add "…", or use the short name.
    - Fix: _(to do)_

28. **"'Open the old version' of what?"**
    - Where: See what changed > Before and after
    - What caused it: "Try the new version / Open the old version"
    - Blocks: minor
    - Suggestion: "Open the arcade as it is now".
    - Fix: _(to do)_

29. **"'What it found'? It didn't find anything, it added a line."**
    - Where: Inbox card for the README task
    - What caused it: heading "What it found" (the other card says "What it did").
    - Blocks: minor
    - Suggestion: always "What it did".
    - Fix: _(to do)_

30. **"The workflow cards got cut in half."**
    - Where: Workflows page, laptop, Helper open
    - What caused it: card text clipped through the middle of a line: "When you start it, it" (the lower half of the letters is cut off).
    - Blocks: minor (bug)
    - Suggestion: clamp to whole lines with "…" at narrower widths.
    - Fix: _(to do)_

31. **"'Builder works on it twice, it builds it, Builder works on it 4 times'… huh? And which project is it for?"**
    - Where: Workflows page cards (both widths)
    - What caused it: the Background Lookout Builder summary. No card shows its project.
    - Blocks: 4 (minor)
    - Suggestion: shorter summaries ("Researches, builds, gets checked, asks you, ships") and a project line like on agent tiles.
    - Fix: _(to do)_

32. **"Ship? Like… mail it somewhere?"**
    - Where: New workflow > steps (laptop)
    - What caused it: "Start → Build (Careful) → Review → Ship (asks you first)"
    - Blocks: 4
    - Suggestion: "Put it in your project (asks first)". Or give the Ship chip a tooltip.
    - Fix: _(to do)_

33. **"I said 'build, try it on a phone, ask me'. Why two build steps, two 'ask me's and no phone test?"**
    - Where: New workflow > "Change the steps in your own words" (laptop)
    - What caused it: my words became "Builder (Careful) → Build (Careful) → Check → Ask me → Ship (asks you first)". The Helper then said **"Those steps aren't from your request"**, which is wrong: they came from Make these steps.
    - Blocks: 4 / 6
    - Suggestion: fix the step maker (no duplicate Build; don't add "Ask me" when Ship already asks). Fix what the Helper knows about it.
    - Fix: _(to do)_

34. **"Even with the Helper's exact words it still asks me twice."**
    - Where: same, second try
    - What caused it: "Build it once… then ask me, then ship." gave "Builder → Check → Ask me → Ship (asks you first)".
    - Blocks: 4
    - Suggestion: merge "Ask me" into Ship when the two are next to each other.
    - Fix: _(to do)_

35. **"It asks 'Which one do you want?' but there's nowhere to answer."**
    - Where: New workflow > "One thing to check" (laptop)
    - What caused it: "Your goal lists 4 pads… but your brief says 8 big pads. Which one do you want?" The buttons are only "Next · Make it more detailed · Change my goal".
    - Blocks: 5
    - Suggestion: offer answer buttons ("4 pads" / "8 pads") that fix the goal.
    - Fix: _(to do)_

36. **"It said 'Looks good ✓' but I still have to press Next again? And is the limit 2 hours or 30 minutes?"**
    - Where: New workflow, then a step panel
    - What caused it: "Looks good ✓ … Give the build 2 hours · Turn it on" (I didn't), then Limits "Longest run 2 h" and the Builder step "Time limit 30 minutes".
    - Blocks: 4 / 6
    - Suggestion: when it looks good, go straight on. Show one time limit, or explain both side by side.
    - Fix: _(to do)_

37. **"I picked 'Beat Maker Drum Pad' but it's called 'Web pag…'"**
    - Where: new workflow page (laptop)
    - What caused it: auto-name "Web page with a grid", shown cut off as "Web pag…".
    - Blocks: 4
    - Suggestion: use the idea's title as the name, and make the name box wide enough.
    - Fix: _(to do)_

38. **"Where's the name box? It says 'Name (click it to change it)' one word per line."**
    - Where: workflow page, laptop, Helper open
    - What caused it: the label wraps "Name / (click / it / to / change / it)" and the name box shrinks to an empty sliver about 10px wide. It happened on every workflow page I opened with the Helper open.
    - Blocks: 6 (bug)
    - Suggestion: give the name field a minimum width, or stack it above the top row at narrow content widths.
    - Fix: _(to do)_

39. **"'passed' already? I haven't run it yet."**
    - Where: workflow steps diagram before any run (both widths)
    - What caused it: a green "passed" label on the arrow after Check, plus a "needs work" loop.
    - Blocks: 6
    - Suggestion: label the arrows "if it passes" / "if it needs work" until a run happens.
    - Fix: _(to do)_

40. **"Why does the 'Ask me' step talk about phone screens?"**
    - Where: workflow steps (laptop)
    - What caused it: Ask me card: "The beat maker loads on a phone-sized screen. …"
    - Blocks: 6 (minor)
    - Suggestion: an Ask step should say "Waits for your OK".
    - Fix: _(to do)_

41. **"'Does its usual job'… what is its usual job? Why could Puzzle Tile Quest build my beat maker?"**
    - Where: Builder step panel (laptop)
    - What caused it: "Does its usual job"; "Who does it?" lists "Arcade site (one of your agents)" and "Puzzle Tile Quest (one of your agents)".
    - Blocks: 6
    - Suggestion: "Builds what's in your goal box". Group the task agents under "Reuse an earlier agent (advanced)".
    - Fix: _(to do)_

42. **"It's 'Running the checks' but it hasn't built anything. And it's said 'Running a check…' for 10 minutes. Is it stuck?"**
    - Where: workflow run (laptop)
    - What caused it: Builder card "Running the checks…" in the first minute (the Helper agreed it was misleading). Later "Running a check…" stayed unchanged for 10+ minutes, and "Live · started 7 min ago" showed when it had been 12.
    - Blocks: 7
    - Suggestion: show plain sub-steps like the task page does, plus a "still working, last activity 20 s ago" pulse.
    - Fix: _(to do)_

43. **"The step panel just says 'Getting started…'"**
    - Where: running workflow > click the Builder step
    - What caused it: "Doing it now / Getting started… / Writing a file…" while it was halfway done.
    - Blocks: 7
    - Suggestion: reuse the task page's "Build it, step by step" list here.
    - Fix: _(to do)_

44. **"Home says 0 agents working. Isn't my beat maker running?"**
    - Where: Home page while the workflow runs (phone)
    - What caused it: "0 agents working · 2 things need you". Workflow runs don't appear on Home.
    - Blocks: 7
    - Suggestion: count running workflows and show a "Running now" strip or tile.
    - Fix: _(to do)_

45. **"Ran out of time after 5 minutes? I lost it? Which button?"**
    - Where: failed workflow run (laptop)
    - What caused it: "Builder stopped: Ran out of time" with no limit and no "your work is saved". The buttons are "Pick up where it stopped · Try again · Back to editing", but the Time limit ⓘ promised a "Keep going" button. Only the Helper said the limit was 30 minutes and that the work was safe.
    - Blocks: 10
    - Suggestion: say "Stopped at its 30-minute limit. Your work so far is saved." Mark one button as recommended. Use the same name the tooltip promises.
    - Fix: _(to do)_

46. **"'You stopped it'… no I didn't. And what's that title?"**
    - Where: Build → Review → Ship, past run (laptop)
    - What caused it: "You stopped it." and the run title "Follow the details under: "What should this workflow make?""
    - Blocks: 10
    - Suggestion: say who or what stopped it ("Stopped from the Inbox at 11:49 PM"). Don't show template text as a title.
    - Fix: _(to do)_

47. **"'Merged into main'? 'Never straight in main'? What's main?"**
    - Where: workflow run history, and the agent settings Project ⓘ
    - What caused it: "Shipped: merged into main." and "never straight in main".
    - Blocks: minor
    - Suggestion: "Shipped: it's in your project now" and "never straight in your real project".
    - Fix: _(to do)_

48. **"19 of 19 on time and a green Done, but most of them say 'You've hit your limit'?"**
    - Where: Heartbeat page (phone)
    - What caused it: "19 of 19 check-ins on time today". About 15 of those 19 entries read "You've hit your session limit…" or "weekly limit…" and are still tagged "On time".
    - Blocks: 10
    - Suggestion: count those as "checked in, but Claude was out of usage" with an amber pill.
    - Fix: _(to do)_

49. **"Help says Merge/Ship always asks first… and also that it can ship by itself?"**
    - Where: Help page (phone)
    - What caused it: "Merge / Ship … It always asks first" vs "A workflow only ships by itself if you set its Ship step to automatic".
    - Blocks: minor
    - Suggestion: "Ship asks first unless you switched that step to automatic."
    - Fix: _(to do)_

50. **"Should I press 'Update agentbox'? Will it break?"**
    - Where: Help and Settings pages
    - What caused it: a big black "Update agentbox" button on the Help page (I didn't press it, so I don't know if it asks first).
    - Blocks: minor
    - Suggestion: keep it on Machine/Settings only, and confirm first.
    - Fix: _(to do)_

51. **"The chat bubble is on top of 'Delete agent'."**
    - Where: agent settings, phone 390px
    - What caused it: the Helper bubble (x318–374, y716–772) covers the "Delete agent" button (x267–374, y728–772) in the sticky bottom bar.
    - Blocks: minor (bug)
    - Suggestion: lift the bubble above sticky save bars, or hide it while a form bar is showing.
    - Fix: _(to do)_

52. **"Half my phone screen is the Save bar."**
    - Where: agent settings, phone
    - What caused it: the sticky bottom bar (3-line summary + Save/Cancel/Delete) takes about 200px of 844.
    - Blocks: minor
    - Suggestion: collapse the summary to one line on phones.
    - Fix: _(to do)_

53. **"The bubble covers part of the New task form on my phone."**
    - Where: New task pop-up, phone
    - What caused it: the bubble floats over the "Upload a file" line inside the dialog.
    - Blocks: 5 (minor)
    - Suggestion: hide the bubble while a full-screen dialog is open (the dialog already has a Helper chip).
    - Fix: _(to do)_

54. **"Where did the chat bubble go?" / "Why is there a command box one tap from the menu?"**
    - Where: Terminal page, phone
    - What caused it: the black bubble sits on the black terminal and is nearly invisible. "Terminal (advanced)" is in the main phone menu.
    - Blocks: minor
    - Suggestion: give the bubble a white ring on dark backgrounds. Move Terminal under Machine.
    - Fix: _(to do)_

55. **"What are these cut-off links?"**
    - Where: Settings > Last messages
    - What caused it: "Pull request ready: https://github.com/Ni" and "finished milestone 8 of 10".
    - Blocks: minor
    - Suggestion: show the plain title only, without links.
    - Fix: _(to do)_

56. **"The workflow's 'See what changed' has no Ship button, and 'What it did' just repeats my goal."**
    - Where: changes page for the workflow's change (#16) (phone)
    - What caused it: "What next?" only offers "Send back with a note / Leave a note / Open it on GitHub". "What it did" shows "Task: Make a web page…". The Ship step panel says "agentbox did this step itself" while it's waiting for me, and its only button is "See the pull request".
    - Blocks: 9
    - Suggestion: put "Ship it" here too. Show the builder's summary. Fix the step panel wording and give it a "Ship it" button.
    - Fix: _(to do)_

57. **"Did the Check really try my beat maker?"**
    - Where: workflow run > Check step
    - What caused it: "The page loaded ("Arcade")". It only opened the arcade home page, not the drum pad page. The Helper confirmed this.
    - Blocks: 7 / 9
    - Suggestion: have Check open the new page and say which page it tried.
    - Fix: _(to do)_

58. **"Every Helper answer needs scrolling."**
    - Where: Helper, all pages
    - What caused it: almost every answer ends with "↓ More of the answer below".
    - Blocks: minor
    - Suggestion: aim for 3 short lines first, then "Tell me more".
    - Fix: _(to do)_

---

**Total: 58 questions**, 39 of them in the core tasks (including items marked "(minor)" that still touch a core task). The other 19 are minor.

### What worked well (for balance)
- The tour is short and clear, and "Start my first task" goes straight to the task form.
- The goal checker ("A few quick questions", then "Here's an improved version") turned "make a game" into a good brief.
- "Help me think of ideas" gave 4 good, small ideas in about 30 seconds.
- The brief conflict check (4 pads vs 8 pads) was impressive.
- "Change it in your own words" on a saved workflow worked well: clear before/after, then Apply.
- Before/after pictures plus "Try the new version" made it possible to actually play the result.
- Every Merge/Ship button asked first, in plain words.
- The Helper was right about nearly everything, read the real log (it spotted the simulated time-out) and stayed beside pop-ups without covering them on laptop.

### Bugs seen
- Workflow name box collapses to an empty sliver when the Helper is open (#38).
- Workflow card text is clipped mid-line when the Helper is open (#30).
- Text cut mid-word without "…" (#27).
- The Helper bubble covers "Delete agent" on phone (#51).
- The Helper gave wrong facts twice: "steps aren't from your request" (#33) and the reason for the rename (#23).
- The Heartbeat counts usage-limit failures as "on time" (#48).
- "Live · started N min ago" lags behind the real time (#42).
- One 404 console error on the first page load (resource not identified).

### Real pull requests opened (on the bot's arcade project, none merged)
- https://github.com/NicB-coder-bot/arcade/pull/14 (Puzzle Tile Quest, Memory game, task run 1)
- https://github.com/NicB-coder-bot/arcade/pull/15 (Hello from Sam README, task run 2)
- https://github.com/NicB-coder-bot/arcade/pull/16 (Beat Maker workflow run; I made it fail with "time", then pressed Pick up where it stopped; it's now waiting at Ship)
