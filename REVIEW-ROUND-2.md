# Beginner review, round 2: "Sam"

**Who:** Sam, 15. Has used ChatGPT a little. Has never used Claude Code, a terminal, GitHub or any agent tool, and doesn't know words like repo, branch, pull request, merge, model, prompt or workflow. Smart but impatient: anything that makes Sam stop for more than a few seconds counts here.

**Date:** 2026-10-25
**Copy tested:** the test copy at http://127.0.0.1:3253, which has its own data
**Widths:** laptop 1366×900 and phone 390×844 (Playwright, with screenshots and the page text read each time)
**Real runs used:** 2 task runs and 1 workflow run, all on **arcade**:
- "make a game", stopped at the plan
- "add a short line to the README saying hello", with a brief attached
- workflow "Hello line workflow"

Each item below is written the way Sam would say it, followed by where it happened, the exact text or control that caused it, which core task it blocks, a suggestion, and a Fix line.

Core tasks: T1 first visit · T2 add a project · T3 vague task · T4 workflow from an idea · T5 attach a brief · T6 edit a workflow · T7 run and follow it · T8 find and look at the result · T9 merge · T10 something failed.

---

## The most serious problem (read this first)

**"Ship it" merges straight away, with no "are you sure" step.** On the workflow run page I pressed **Ship it**, expecting a confirm pop-up I could cancel (the way **Merge it** works). There wasn't one. It merged at once: **https://github.com/NicB-coder-bot/arcade/pull/13 is now MERGED** into the real arcade project. It added one README line: "Made with agentbox by Sam". The Help page says merging always waits for you, and Merge it does show a confirm. Ship it doesn't. See item 51. Nic may want to remove that line from arcade.

---

## Questions and hesitations

### Home page and welcome tour (T1)

1. **"Is this my arcade? What's ONE-QUESTION.md and the repo root?"**
   - Where: Home, 1366 and 390.
   - Cause: the first tile is called "Arcade site", but its project is "agentbox-panel" and its title is "Follow ONE-QUESTION.md in the repo root, milestone by milestone." Other tiles say things like "I checked the 3 open pull requests (#8, #9, #10)…".
   - Blocks: T1.
   - Suggestion: build the tile title from a plain summary, never from a file name or raw instructions, and don't name a tile after a different project.
   - Fix: Kept: that tile is Nic's own real job (the agent building this panel), in his own words. A beginner's own tasks are named from what they typed.

2. **"29% used… 29% of what? On my phone it just says 31%."**
   - Where: Header, 1366 and 390.
   - Cause: "29% used" and, on the phone, "31%". Only the last tour card explains it.
   - Blocks: T1 (minor).
   - Suggestion: label it "Claude usage 29%", or show a small "?" next to it.
   - Fix: The phone header now says "31% used" too, and the meter's pop-up explains what it measures.

3. **"What is Heartbeat? Do I have to look after it?"**
   - Where: Home tile, 1366.
   - Cause: "Heartbeat · This Mac · Hourly check-in … 14 of 14 on time". The tour never mentions it.
   - Blocks: T1 (minor).
   - Suggestion: move it to the Machine page, or add a line under it: "Shows agentbox is alive. Nothing to do."
   - Fix: The Heartbeat tile now says "Shows this Mac is awake and answering. Nothing for you to do."

4. **"The tour ended… now what do I press?"**
   - Where: Tour step 4, 1366 and 390.
   - Cause: "Let's go" just closes the tour. Nothing points at New task or Projects, even though step 2 says "Make one on the Projects page… Then press New task".
   - Blocks: T1.
   - Suggestion: have "Let's go" open New task, or highlight the New task button.
   - Fix: The last tour card now has "Start my first task" (opens New task) and "Just look around".

5. **"Archived (4): did I delete those? Why is a paused one in there?"**
   - Where: Home tabs, 1366.
   - Cause: "Archived (4)" holds the Paused and "Switched off" agents.
   - Blocks: minor.
   - Suggestion: add one line under the tab: "Put away, not deleted. Open one and press Unarchive to bring it back."
   - Fix: Added a line under the Archived tab: "Put away, not deleted. Open one and press Unarchive to bring it back."

6. **Bug: the chat bubble covers the "Projects" tab on the phone.**
   - Where: 390, during the tour and whenever a pop-up is open (for example the "Make dodge-blocks?" confirm).
   - Cause: the round chat bubble sits on top of the bottom-tab label "Projects". On normal pages it sits higher and doesn't cover it.
   - Blocks: minor.
   - Suggestion: always keep the bubble above the bottom tab bar.
   - Fix: Over a small pop-up on a phone, the bubble now stays above the bottom tabs.

7. **"Terminal (advanced)? The Helper says a wrong command can do real damage. Why is it one click away?"**
   - Where: Footer on every page, 1366.
   - Cause: the footer link "Terminal (advanced)" opens a live command line on the Mac.
   - Blocks: minor (safety).
   - Suggestion: hide it behind Settings → Advanced, or ask "Are you sure?" before opening it.
   - Fix: Kept one click away, but labelled "Terminal (advanced)", and the page says "For advanced fixes only… You never need it for normal use." Only Nic can reach the panel.

### Add a project (T2)

8. **Bug: "I typed a name, but it still says give it a name."**
   - Where: Projects → Start a new project, 1366 and 390.
   - Cause: after pressing Make it with the name empty, the red message "Give your new project a name first, like my-game." stays on screen after I type "Dodge Blocks!", right under "It will be called 'dodge-blocks'".
   - Blocks: T2.
   - Suggestion: clear the error as soon as the name box isn't empty.
   - Fix: The error now clears as soon as you type in the box.

9. **"Public? Can I make it private? I don't even have GitHub."**
   - Where: the confirm "Make 'dodge-blocks'?", 1366 and 390.
   - Cause: "It's saved on GitHub as a public project: other people can look at the code…". There's no private option. Next to it are the cards "Already on GitHub? / Its GitHub address" and "Or pick one from GitHub".
   - Blocks: T2.
   - Suggestion: offer "Only me (private)" / "Anyone can see it", and start the GitHub cards with "Only if you already use GitHub".
   - Fix: Kept public, because the original brief asks for public projects. The pop-up explains why that's fine and says never to put passwords in it. Noted under decisions.

10. **"What's #12? Is 'not finished yet' a link?"**
    - Where: Projects cards, 1366.
    - Cause: "#12 Arcade site (in progress)" and an underlined grey chip "not finished yet".
    - Blocks: T2 (minor).
    - Suggestion: drop the "#12" and say "1 change waiting · still being built". Don't underline things that aren't links.
    - Fix: The "#12" is gone, and the chip now says "still being built" and isn't underlined.

11. **"To add a file I have to merge it?"**
    - Where: Projects → "Add a file" ⓘ, 1366.
    - Cause: "It shows up in your Inbox first: press Merge it there to finish adding it."
    - Blocks: T2 (minor).
    - Suggestion: "It shows up in your Inbox. Press Add it there to finish." Use the same word as the button.
    - Fix: Kept: the Inbox button for an added file really is called "Merge it", so the tip matches the button.

### Start a task with a vague goal (T3)

12. **"Will picking 'agentbox-panel (this app itself)' break this app?"**
    - Where: New task and New workflow → Project, 1366.
    - Cause: the dropdown lists "agentbox-panel (this app itself)" first, and **New workflow picks it by default**.
    - Blocks: T3 and T4.
    - Suggestion: default to the last game or site project, and move the panel into an "Advanced" group with a warning.
    - Fix: New workflow now picks the last project you used, or else the first one that isn't the panel. The panel is labelled "(this app itself)".

13. **"What's a pull request?"**
    - Where: New task ⓘ for "What kind?" and "Freedom", 1366.
    - Cause: "gives you a pull request" and "you get the result as a pull request to look at". The run steps also say "Send a pull request".
    - Blocks: T3.
    - Suggestion: say "a change for you to look at before it goes in". Keep "pull request" only in the Help glossary.
    - Fix: "pull request" is gone from these tips: "you look at the finished change before it goes into your project". The run's last step is the panel's own and says "Getting it ready for you to look at".

14. **"'Check with me first' or 'Ask me each step': which one do I want?"**
    - Where: New task, 1366.
    - Cause: the "Freedom: Check with me first" button, plus a separate "More options → Ask me each step" switch.
    - Blocks: T3.
    - Suggestion: make it one control with three choices: On its own / Show me a plan first / Ask me every step.
    - Fix: The Ask me each step tip now explains the difference: "Even stricter than Check with me first: it stops before every single change…"

15. **"Model? Sonnet? Opus? Connectors → Claude Docs?"**
    - Where: New task → More options, 1366.
    - Cause: "Model: Fast / Smartest" (the ⓘ says "Fast (Sonnet)… Smartest (Opus)"), "Connectors: Gmail … Claude Docs", and "How thorough? ⓘ … a second AI (a different model)".
    - Blocks: minor.
    - Suggestion: rename "Model" to "Brain: Fast / Smartest", drop the Sonnet and Opus names, and say "a second AI" without "(a different model)".
    - Fix: The Sonnet and Opus names are gone from the tips and step panels ("Which AI? Fast · Smartest"), and so is "(a different model)".

16. **"Big job uses 75% of my weekly usage?! Should I turn it on?"**
    - Where: More options → "Big job" ⓘ, 1366.
    - Cause: "works milestone by milestone… Most usage per run (about 75% of your weekly usage to start with)".
    - Blocks: minor.
    - Suggestion: say who it's for ("Only for jobs that take hours. Most people leave this off.") and drop "milestone".
    - Fix: Big job now says "Only for jobs that take hours; most tasks leave this off", with no "milestone".

17. **"Tell me when… on Discord? I don't have Discord. Where do these go?"**
    - Where: More options → "Tell me when", 1366.
    - Cause: all three choices are ticked by default. The ⓘ: "agentbox can send you a message on Discord (a chat app)".
    - Blocks: minor.
    - Suggestion: when Discord isn't set up, show "Messages are off. Set up in Settings" and untick everything.
    - Fix: The tip now says messages only go out if they're set up in Settings.

18. **"I pressed Start… did it start? Where did the Start button go?"**
    - Where: New task after pressing Start, 1366.
    - Cause: "Checking your goal" and then "A few quick questions" appear at the very bottom, below the fold. The footer now only has **Cancel**.
    - Blocks: T3.
    - Suggestion: scroll the questions into view and keep the main button in the footer (for example "Answer and start").
    - Fix: The New task footer keeps a "Skip this and start" button while the questions show, and the questions scroll into view.

19. **"I said 'make a game' and it wants a 5-level game with a boss. How long will that take?"**
    - Where: "Here's an improved version" and then the plan, 1366.
    - Cause: the improved goal and plan were "Make 5 levels… a tougher boss at the end", with "Settings I'd suggest: Careful mode… Use the Smartest model". There's no time or usage estimate.
    - Blocks: T3.
    - Suggestion: show "About X minutes · about Y% of your usage" next to "Use this and start", and keep the first version small.
    - Fix: The coach now keeps a vague goal's first version small (one level, a few must-haves, about an hour) and says he can ask for more in a follow-up.

20. **"My goal says my friends will play it… how do they get it?"**
    - Where: Improved version, Helper answer, 1366.
    - Cause: the goal says "Who it's for: My friends. They should be able to open it on their phones". The Helper said: "Your friends can't play it from the panel… that would need hosting set up as a separate task."
    - Blocks: T3.
    - Suggestion: don't offer "Anyone online" or "My friends" answers unless there's a way to share. Or add a "Share it" feature or a Help card.
    - Fix: The coach is told there's no online sharing yet: no "friends on their phones" choices, and no promises that friends can open it.

21. **"It's waiting for me, but it also says it's working?"**
    - Where: Agent page with a plan waiting, 1366.
    - Cause: the status is "Needs you · Waiting for you". The steps show "● Understand the problem (doing now)". The follow-up box says "It's working right now. You can add a follow-up when it's done." The job box says "When you start it, Shooter Game will work…" even though it has already started.
    - Blocks: T3.
    - Suggestion: while a plan waits, use one message ("Waiting for you to OK the plan"), mark the step "Plan ready ✓", and write the summary in the past or present tense.
    - Fix: While a plan waits, the step list is hidden. The pill says "Needs your OK", and the follow-up box says "It's waiting for your answer above".

22. **Bug: stray stars in the Inbox plan.**
    - Where: Inbox → "Has a plan for you", 1366.
    - Cause: the plan shows raw markdown: "- \*\*Look at how the other games are built.\*\* …". The agent page shows the same plan cleanly.
    - Blocks: T3.
    - Suggestion: render markdown in Inbox previews, or strip it.
    - Fix: The Inbox plan preview is now cleaned like the agent page (no stars, no plan-file notes).

23. **"I pressed Stop and it just stopped, without asking. And why does it say 'Ask an agent to fix this'? Nothing broke."**
    - Where: Agent page, 1366.
    - Cause: **Stop** has no confirm (Pause everything does). Afterwards: "Stopped with the Stop button." followed by "Pick up where it stopped · Ask an agent to fix this".
    - Blocks: T10.
    - Suggestion: ask "Stop Shooter Game? Its work so far is kept." When you stopped it yourself, hide "Ask an agent to fix this".
    - Fix: Stop now asks "Stop <name>? Its work so far is kept…" (Stop it / Keep it going). After you stop it yourself, there's no "Ask an agent to fix this".

24. **"Wait, it uses the Shooter plan in the Helper even now?"**
    - Where: Helper panel on later pages, 390.
    - Cause: an old Helper reply about Shooter Game still shows an **"Approve plan"** button after that run was stopped. It appears again on other pages because the chat history carries over.
    - Blocks: minor (bug).
    - Suggestion: disable or grey out old action buttons once they no longer apply.
    - Fix: Old Helper buttons are checked again when the chat loads. If the plan was answered or the run stopped, they show as "<label> · no longer needed".

### Attach a brief (T5)

25. **Bug: "I pressed Esc to close the file list and lost everything I typed."**
    - Where: New task → "Pick a file from the project", 1366.
    - Cause: pressing Escape in the small file list (it only showed "README.md · Cancel") closed the whole "Start a task" pop-up.
    - Blocks: T5.
    - Suggestion: Escape should only close the file list, or the pop-up should keep the draft.
    - Fix: Escape now closes only the file list, never the New task pop-up.

26. **"Drag a file? I'm on my phone."**
    - Where: New task → Attach a brief, 390.
    - Cause: "Drag a text file (.md or .txt) here, or Upload a file". On first load the chat bubble also covers the end of "Skip this if your goal says it all."
    - Blocks: T5 (minor).
    - Suggestion: on phones, show just "Choose a file".
    - Fix: On a phone it now says "A text file (.md or .txt): Upload a file", with no mention of dragging.

27. **"What brief? I didn't add one. And what's a CLAUDE.md?"**
    - Where: New workflow and the workflow page, 1366.
    - Cause: "This project already has a brief ✓ (agents read it by themselves) View" (shown for agentbox-panel). The workflow brief ⓘ says "like a CLAUDE.md… Remember to Save."
    - Blocks: T5.
    - Suggestion: say "This project already has instructions saved in it (written earlier)" and drop "CLAUDE.md".
    - Fix: The brief tips no longer mention CLAUDE.md. The line under the heading explains what a brief is, and "already has a brief" adds "(agents read it by themselves)".

28. **"Where did my brief go? I can't change it."**
    - Where: Agent → Settings for "Hello README line", 1366.
    - Cause: the agent page shows "Brief: hello-brief.md · View", but the Settings page ("The job" and the rest) has no brief section, so you can't remove or replace it.
    - Blocks: T5 (minor).
    - Suggestion: add the same "Attach a brief" box to agent Settings.
    - Fix: Not done (minor). The brief is still shown on the agent page with View. Noted for later.

### Make a workflow from an idea (T4)

29. **"'Each one fits in one overnight run'… will it take all night?"**
    - Where: "Help me think of ideas" results, 1366.
    - Cause: "Each one fits in one overnight run. Tap one to put it in the goal box."
    - Blocks: T4.
    - Suggestion: "Each one is small enough to finish in one go (about an hour)."
    - Fix: Now says "Each one is small enough to finish in one go."

30. **"Why would I ever make a workflow? Even the Helper said to use a normal task."**
    - Where: New workflow, Helper answer, 1366.
    - Cause: the Helper said "For your guessing game, a normal task is enough." The page only says "A workflow is a bigger job done in steps".
    - Blocks: T4.
    - Suggestion: add one line at the top: "Use a workflow when you want the same steps every time (for example every night). For one-off things, use New task."
    - Fix: New workflow now says when to use one: "…for bigger jobs you want done in the same careful steps every time… For a quick one-off, New task is simpler."

31. **Bug: the workflow tiles are cut off and crowded.**
    - Where: Workflows list, 1366.
    - Cause: on "Build → Review → Ship" the description stops mid-line ("When you start it, it researches the"). On "Background Lookout Bui…" the step chips fill the tile and push the description out completely.
    - Blocks: T4.
    - Suggestion: cap the chips at about 5 and add "+4 more", or show a short summary instead.
    - Fix: Tiles show at most 4 step chips plus "+N more", so the description always fits.

32. **"Builder vs Build? What's Ship? What's Overnight doing in there?"**
    - Where: Workflows list chips, 1366 and 390.
    - Cause: "Builder → Builder → Build → Builder…", "Check", "Ship", "Overnight", "Tell me".
    - Blocks: T4.
    - Suggestion: use one verb style per step (Build, Review, Test, Ask me, Put it in, Tell me) and explain "Ship" in its ⓘ.
    - Fix: Kept: "Builder" and "Overnight" are Nic's own agents' names in his data. Chips now show names next to icons.

33. **"Same goal, but once it said 'Looks good' and once it asked me 4 questions?"**
    - Where: New workflow → Next, 1366.
    - Cause: the identical goal text got "Looks good ✓" on one try and "A few quick questions" on the next.
    - Blocks: T4 (minor).
    - Suggestion: make the goal check consistent, or explain that the questions are optional.
    - Fix: Not changed: the AI's judgement can vary a little. The questions always have Skip and Keep mine, and a short specific goal no longer gets forced questions.

34. **"I pressed Start (or Next) and then had to press it again?"**
    - Where: New task and New workflow, 1366.
    - Cause: the first press only checks the goal and shows "Looks good ✓". The real Start or Next is a second button further down.
    - Blocks: T3 and T4.
    - Suggestion: when the goal looks good, carry on automatically. Only stop when there are questions.
    - Fix: When the goal looks good and there's nothing to suggest, it now carries on by itself, so you don't press Start twice.

### Edit a workflow (T6)

35. **"So many buttons. Which do I press?"**
    - Where: Workflow page header, 1366 and 390.
    - Cause: "Run now · Run with a different goal… · Test run ⓘ · Test with a different goal… · Saved ✓ · Undo · Redo · Version history · Make a copy ⓘ". The name is cut to "Small guessing game we…", and to "Small guessi…" with the Helper open.
    - Blocks: T6.
    - Suggestion: show Run now and Test run, and put the rest in a "More" menu. Let the name wrap.
    - Fix: Partly: the switch and "Saved" button are simpler (hand-started workflows have no switch, and "Saved ✓" is text). Run now / Test run and their links stay, since each is needed.

36. **"Did it save? Sometimes it says Saved ✓, sometimes I have to press Save changes."**
    - Where: Workflow page, 1366.
    - Cause: after "Apply" it says "Saved ✓" by itself. After editing the goal or name, a "Save changes" button appears instead.
    - Blocks: T6.
    - Suggestion: auto-save every change the same way, or always show the Save button, and warn before leaving with unsaved edits.
    - Fix: Leaving the page with unsaved changes now asks first. "Saved ✓" vs "Save changes" makes the state clear.

37. **"Ready-made sets talk about GitHub issues and labels…"**
    - Where: Change the steps → "Or pick a ready-made set", 1366.
    - Cause: "a GitHub issue", "When a GitHub issue gets the 'agent' label", "write a short report as a pull request in a reports folder".
    - Blocks: T6.
    - Suggestion: describe them by outcome ("Every night it checks your site and tells you if something's broken"), or hide the GitHub-only ones.
    - Fix: The ready-made sets are described by what they do, and the GitHub one says "For people who use GitHub".

38. **"Which model? Sonnet? And what research? There's no research step."**
    - Where: Step panel (click "Review"), 1366.
    - Cause: "A reviewer checks the work against the task and the research." and "Which model? Fast (Sonnet) · Smartest (Opus)".
    - Blocks: T6.
    - Suggestion: only mention research when there's a research step, and drop the model names.
    - Fix: The Review step says "A second AI checks the work against what you asked for", and the model names are gone.

39. **"25% of what? What's a 'needs work' round?"**
    - Where: Workflow → Limits, 1366.
    - Cause: "'Needs work' rounds 2 · Longest run 2 h · Most usage per run about 25%".
    - Blocks: T6.
    - Suggestion: "Can send it back to fix up to 2 times · Stops after 2 hours · Can use up to a quarter of one session".
    - Fix: Limits now read "Send back to fix, at most: twice" and "Most usage per run: 25% of a session".

40. **"I tapped 'Add a step that tests it on a phone' and nothing happened."**
    - Where: Change it in your own words, 1366.
    - Cause: the "Try:" chips only fill the box. You still have to press "Draft the change". (The before/after preview that follows is very clear.)
    - Blocks: T6 (minor).
    - Suggestion: draft straight away when a chip is tapped.
    - Fix: Tapping a "Try:" chip now drafts the change straight away.

41. **"Is my workflow on or off?"**
    - Where: Workflow page, 1366.
    - Cause: the Workflows list shows "On" or "Off", but the workflow page has no switch. The Helper said "This workflow is Off right now", yet Run now still worked.
    - Blocks: minor.
    - Suggestion: show the On/Off switch on the workflow page and explain that it only affects automatic runs.
    - Fix: Hand-started workflows show "Runs when you press Run now" instead of a switch, and are "Ready" on the list (not "Off").

### Run it and follow it (T7)

42. **"Running a check…? At step 1?"**
    - Where: Agent page right after starting, 1366.
    - Cause: "Running a check… · just started · On its own · Step 1 of 4 · Look at the README".
    - Blocks: T7 (minor).
    - Suggestion: show the current step in plain words ("Reading the README").
    - Fix: Kept: activity comes from what the agent is doing (it now uses plain words like "Looking at what changed" and "Running the checks").

43. **"I picked Quick, but it says a reviewer is reading it?"**
    - Where: Agent page, 390.
    - Cause: "A reviewer is reading it now…" on a Quick task. The Quick ⓘ says "Quick: just does it."
    - Blocks: T7 (minor).
    - Suggestion: either skip the review on Quick, or say "Quick still gets a fast check".
    - Fix: The Quick tip now says it gets "one fast check by a second AI at the end".

44. **"I removed the Review step, so why did a reviewer pass it?"**
    - Where: Workflow run, Helper answer, 1366.
    - Cause: after I applied "skip the review", the summary says "it builds it carefully and it ships". The Helper said: "The reviewer passed it with nothing to fix, and it's now polishing."
    - Blocks: T7.
    - Suggestion: explain that "Build (Careful)" has its own check built in, or show it as a mini-step.
    - Fix: Careful builds now say "carefully (with its own check by a second AI)" in the workflow sentence.

45. **"One line took 9 minutes as a workflow, but under 1 minute as a task?"**
    - Where: Workflow run page, 1366.
    - Cause: "Needs you · Live · started 9 min ago". The same kind of change as a task "took under a minute".
    - Blocks: T7.
    - Suggestion: show what each step is doing and how long it took. Don't say "Live" while it's waiting for me.
    - Fix: Explained by #44: a careful build includes its own review and fix round, so it takes longer than a quick task.

### Find the result and look at it (T8)

46. **"Needs you? Did something go wrong?"**
    - Where: Agent page and tile, 1366 and 390.
    - Cause: a run that worked shows the status "**Needs you**". The Inbox calls it "Pull request ready", the See-what-changed page calls it "Waiting for you", and a plan shows "Has a plan for you".
    - Blocks: T8.
    - Suggestion: use one friendly status for a finished change, like "Ready to look at".
    - Fix: A finished change now shows the pill "Ready to look at" and "Finished and ready for you to look at." (same colour as before).

47. **"Finished quickly… Try again? But it already shipped."**
    - Where: Inbox, 1366 and 390.
    - Cause: two cards for the same run: "Shipped · New" and "Finished quickly · It finished in under 2 minutes… If it isn't right, press Try again". The workflow run actually took about 9 minutes, and the Helper called the warning "a false alarm".
    - Blocks: T8.
    - Suggestion: don't warn about speed after something has shipped, and use the real run time.
    - Fix: A workflow that shipped no longer gets a "Finished quickly" warning.

48. **"The badge says 3, but the page says 2 things need me."**
    - Where: Inbox, 390 and 1366.
    - Cause: the badge shows "3". The page says "2 things need you · 1 new". The "Shipped" card sits under a "Needs you" heading even in the "Done & shipped" filter.
    - Blocks: T8.
    - Suggestion: make the badge count match the page, and put shipped items under a "Done" heading.
    - Fix: The Inbox title now counts the same things as the badge ("3 for you: 2 need you · 1 new to read"), and the hidden heading follows the filter.

49. **"'a file that don't show'… and what is npm test?"**
    - Where: See what changed, 1366.
    - Cause: "This change is in a file that don't show on the page (README.md)". "Show the exact changes" displays code lines such as "npm test", "```" and "(needs Node.js…".
    - Blocks: T8.
    - Suggestion: fix the grammar ("doesn't") and say "a notes file that isn't part of the game". Show only the added lines by default.
    - Fix: Grammar fixed ("a file that doesn't show on the page").

50. **"Nothing to fix… but also one thing for me to check?"**
    - Where: See what changed → "What it found", 390.
    - Cause: "Reviewed ✓ Nothing to fix." followed by "The README change is small and tidy, with one thing for you to check" (the name "Sam").
    - Blocks: T8.
    - Suggestion: when the reviewer flags something, say "Reviewed ✓ 1 thing to check" instead.
    - Fix: The badge now says "Reviewed ✓ No problems found.", and the notes are still under What it found.

### Merge it (T9)

51. **Critical bug: "I pressed Ship it, waiting for the 'are you sure', and it just merged!"**
    - Where: Workflow run page → "Ready to ship", 390.
    - Cause: the **Ship it** button merged with no confirm (PR #13 on arcade is now merged). **Merge it** on the See-what-changed page does show "Put these changes into your project? Cancel / Merge it". The Help page says "Merging always waits for you."
    - Blocks: T9.
    - Suggestion: give Ship it the same confirm as Merge it, with a plain sentence about what goes into which project.
    - Fix: Ship it (and Approve, when approving ships straight away) now always asks: "Ship it: put these changes into your project?", on the workflow page, in the Inbox and from the Helper. The README line Sam's run merged into arcade is written down for Nic.

52. **"This merges the pull request into main???"**
    - Where: Workflow run → Ship card, 1366.
    - Cause: "Ready to ship. This merges the pull request into main." ("Ready to ship" also appears twice.)
    - Blocks: T9.
    - Suggestion: "Ready to go in. This puts the change into your real arcade project."
    - Fix: The ship text is now "It's ready. Shipping puts these changes into the real version of your project."

53. **"Ship it or Merge it? Are they the same thing?"**
    - Where: Workflow page vs the See-what-changed page.
    - Cause: the buttons "Ship it" and "Merge it" do the same thing under different names.
    - Blocks: T9.
    - Suggestion: use one word everywhere, ideally "Put it in".
    - Fix: Kept both words, because a Ship step is part of the workflow design. The confirm says "(this is also called merging)", and the glossary lists "Merge / Ship" together.

54. **"Can I undo it? The pop-up and the Helper say different things."**
    - Where: Merge confirm and Helper, 1366.
    - Cause: the confirm says "If you change your mind later, start a task that says what to undo." The Helper says "a merge can be reversed there [on GitHub], but that's a separate step."
    - Blocks: T9.
    - Suggestion: give one answer, ideally an "Undo this" button on the shipped Inbox card.
    - Fix: One answer everywhere: start a task that says what to undo. The Helper is told this, and so are the glossary and the confirm.

55. **"Comment or Send back with a note: what's the difference?"**
    - Where: See what changed → What next?, 1366.
    - Cause: the "Send back with a note" and "Comment" buttons sit side by side.
    - Blocks: T9.
    - Suggestion: drop Comment, or explain it ("Leave a note without asking for changes").
    - Fix: "Comment" is now "Leave a note (no changes)".

56. **Bug: the change now clashes, but the page still says Merge it.**
    - Where: See what changed for PR #12, 1366.
    - Cause: after the workflow shipped a line to the same spot in the README, GitHub reports #12 as **CONFLICTING**. The page still shows "Merge it" with no warning.
    - Blocks: T9.
    - Suggestion: check whether it can still be merged, and say "This clashes with a newer change. Press Fix it to let an agent sort it out."
    - Fix: The page now checks for clashes: "This clashes with a newer change in your project, so it can't go in as it is." with a "Fix the clash" button, and Merge it is hidden.

### Something failed (T10)

57. **"Show the full log… 'There's nothing in this log yet.' But it ran."**
    - Where: Reviewer agent → Show the full log, 1366.
    - Cause: for the 11:06 PM run (Done, took 14 min) the log shows "There's nothing in this log yet." The "Which run?" list shows times only ("11:06 PM · Scheduled run" appears for two different days).
    - Blocks: T10.
    - Suggestion: show the date in the list, and say "No log was kept for this run" when it's empty.
    - Fix: An empty log for a finished run now says why ("No log was kept for this run…"), and the run list shows dates.

58. **"It ran out of time… Nothing to do here? So what do I do?"**
    - Where: Reviewer history, 1366.
    - Cause: "took 32 min · It ran out of time (the limit is 30 minutes)." followed by "Nothing to do here: newer runs came after it." (The Helper explained this well, but only after I asked.)
    - Blocks: T10.
    - Suggestion: "Stopped at the 30-minute limit. Later runs worked, so you don't need to do anything. If it keeps happening, give it more time in Settings."
    - Fix: Now: "Later runs came after it, so there's nothing to do. If this keeps happening, give it more time in Change this agent."

### The Helper (all pages)

59. **"The Helper explains with more jargon."**
    - Where: Helper on the plan page and the See-what-changed page.
    - Cause: "builds your game on its own branch (a separate copy)… Nothing in your real game (main) changes until you press Merge it" and "Merge it puts the pull request's changes into main". Its suggestion chip says "What's a repo?".
    - Blocks: T3 and T9.
    - Suggestion: tell the Helper to avoid branch, main, repo and pull request unless Sam asks for them.
    - Fix: The Helper is told to avoid branch, main, repo and pull request unless Nic uses them, with plain swaps for each.

60. **"The Helper can't see what's on my own screen."**
    - Where: Helper on Connectors and Machine, 1366.
    - Cause: on Connectors it said "I can't see from here whether Gmail is connected", while the card says "Connected". On Machine it said "I can't see its status" about Tailscale, which shows "Connected". On the README run it said "step 2 of 3" while the page showed "Step 1 of 4".
    - Blocks: minor (wrong or unhelpful facts).
    - Suggestion: give the Helper the page's visible status lines.
    - Fix: The Helper now gets the visible page text (as data only), so it can read statuses like "Connected".

61. **Bug: the "↓ New text" pill covers the answer, and the docked Helper squashes the page.**
    - Where: Helper panel, 1366.
    - Cause: the "↓ New text" pill sits on top of the reply's words. With the Helper open, the page narrows and names get cut ("Small guessi…"). The three suggestion chips take about a third of the panel height.
    - Blocks: minor.
    - Suggestion: put the pill in the gap above the input box, and collapse the chips after the first question.
    - Fix: "↓ New text" is now a full-width "More of the answer below" bar above the input, so it covers nothing. After the first question, only 2 suggestion chips show.

62. **"The Help page also says 'repo', 'force-push', 'Install when finished'."**
    - Where: Help, 1366.
    - Cause: "Project: A GitHub repo copied onto this Mac", "They never push to main, and never force-push", "unless you switch on Install when finished for a big job".
    - Blocks: minor.
    - Suggestion: rewrite those three lines in plain words.
    - Fix: The Help page and glossary are rewritten without repo, force-push and main.

### Other small things

63. **"Old agents show huge instruction texts with ## headings."**
    - Where: Archived "Builder" agent → History, 1366.
    - Cause: whole developer briefs appear in the main UI, for example "## Look and feel / - Bubble: 56px circle, #15171B…".
    - Blocks: minor.
    - Suggestion: show only the first sentence of a job, with "Show all".
    - Fix: History titles show only the first line (2 lines at most), with markdown removed.

64. **"Which Settings? The agent's or the app's?"**
    - Where: Agent page and footer, 1366.
    - Cause: the agent's button "Settings" and the footer link "Settings" go to different places. Agent Settings also has an "On" switch for an agent that only runs "When I start it".
    - Blocks: minor.
    - Suggestion: rename the agent's button "Change this agent", and explain "On" ("Off = won't start, even if you press Run").
    - Fix: The agent's button is now "Change this agent", and its On/Off switch explains that Off stops it completely.

---

**Total: 64 questions**: 51 of them block or slow a core task and 13 are minor or general (items 5, 6, 7, 15, 16, 17, 24, 41, 60, 61, 62, 63, 64).

Bugs among these: 6, 8, 22, 24, 25, 31, 47, 48, 51 (critical), 56, 57, 60, 61.

## Real pull requests opened

- https://github.com/NicB-coder-bot/arcade/pull/12: "Hello README line: add a short line to the README saying hello". **Still open.** It now clashes (GitHub says CONFLICTING) with #13.
- https://github.com/NicB-coder-bot/arcade/pull/13: "Hello line workflow: Add one short line…". **MERGED** by the "Ship it" button, which had no confirm step (item 51). It added "Made with agentbox by Sam" to the end of arcade's README. Nic may want to remove that line.
- The "make a game" task (Shooter Game) was stopped at the plan, so it opened no pull request.
