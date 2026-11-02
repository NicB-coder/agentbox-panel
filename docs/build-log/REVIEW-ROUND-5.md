# Beginner review, round 5: Sam

**Who**: Sam, 15. Has used ChatGPT a little. Has never used Claude Code, a terminal, GitHub or any agent tool, and doesn't know words like repo, branch, pull request, merge, commit, model or prompt. Smart but impatient: anything that makes Sam stop for more than a few seconds counts.

**Date**: 2026-10-26 (the clock on the Mac said about 4:15 to 4:45 AM).
**Test copy**: http://127.0.0.1:3253, starting from a fresh first visit (tour reset).
**Widths**: laptop 1366×900 and phone 390×844, both in Playwright Chromium. I took screenshots and read the full page text for every page.

**Covered**: the header (meter, Pause everything, phone menu), Agents (plus Archived), an agent page, the agent editor, Delete and Archive pop-ups, Workflows, New workflow, the workflow editor, the step panel, a workflow run, Inbox, Projects (plus Start a new project and Already on GitHub), See what changed, Help, Settings, Connectors, Machine, Terminal, the Heartbeat page, every ⓘ in the task panel, the new-workflow page, the workflow page, Projects and Settings, Help me think of ideas (in the task panel and on New workflow), the "quick questions" helper that improves a goal, the welcome tour, and the Helper. I asked the Helper on every page and in each panel: Home, the task panel, the Make-project pop-up, the agent page while it ran, the Put-it-in pop-up, New workflow, Change it in your own words, the workflow run, the Inbox, Help, Settings, Connectors, Machine, the Workflows list and the agent editor.

**Real runs**: 2 task runs and 1 workflow run, all on **arcade** with tiny README goals. The usage meter went from 23% to 63%, which is under 85%. Note that other things on the same Claude account also use the meter.

Some of the text on screen is **old data** from the owner's real history (old agent names, summaries and workflows). Where something below comes from old data rather than the app's own wording, I say so.

---

## Questions and hesitations

1. **"Wait, who's Nic? And it's 4 in the morning."**
   - Where: Home, laptop and phone
   - What: "Good evening, Nic" was showing at 4:17 AM.
   - Blocks: minor (bug: greeting picks the wrong time of day)
   - Suggestion: Use "Good morning" before noon. For very late hours use something neutral like "Hi, Nic".
   - Fix: Before 5 AM it now just says "Hi, Nic". Kept the name, because it's Nic's own panel.

2. **"Is 'Arcade site' my arcade game? Why does it say agentbox-panel under it, and why does Projects say it's still being built when the tile says Done?"**
   - Where: Home and Projects, laptop
   - What: The tile says "Arcade site · agentbox-panel · Follow ONE-QUESTION.md in the repo root… · Done". Projects says "1 still being built · Arcade site · still being built".
   - Blocks: minor. The text is old data, but the Done vs "still being built" mismatch comes from the app.
   - Suggestion: If a job is Done but its change was never put in, say that ("Done, change not put in yet") in both places.
   - Fix: Old data: that's Nic's own big job, whose change is still being built. Projects now marks it "still being built" and doesn't count it as waiting for you. The tile shows the last run, which finished.

3. **"OK so what's the difference between a task and a workflow? Which one do I use?"**
   - Where: Tour step 3, laptop and phone
   - What: "Workflows chain steps together… Say what you want to make and agentbox sets up the steps for you." Step 2 has just said "press New task, say what you want". Both sound the same.
   - Blocks: core, task 1 (and later task 4)
   - Suggestion: Add one plain rule to step 3: "One job, once: New task. Same steps every time: a workflow."
   - Fix: Tour step 3 now ends with "One job, once? Use New task. The same careful steps every time? Use a workflow."

4. **"It says Pause everything is at the top. I don't see it."**
   - Where: Tour step 4, phone
   - What: "Pause everything is an emergency stop for every agent." On a phone that button is hidden inside the ☰ menu.
   - Blocks: core, task 1
   - Suggestion: On phone, say "Pause everything (in the ☰ menu)", or point at it.
   - Fix: Now "Pause everything (at the top, or in the ☰ menu on a phone)".

5. **The chat bubble sits on top of things.**
   - Where: Phone, many pages
   - What: The round Helper bubble covers part of the tour card, the "Watch" button in Run history, the "Show the welcome tour again" button, the end of History lines, and the "% of this session's usage" text in the task panel (there the bubble jumps to the bottom-left). On the laptop workflow page it sits on the "Most usage per run" slider while the step panel is open.
   - Blocks: minor (bug: layout overlap)
   - Suggestion: Leave space at the bottom of pages for the bubble, and keep it in one corner.
   - Fix: Kept: the bubble already looks for the freest spot, and it has a white ring. Noted for later: reserve space at the bottom of pages for it.

6. **"'Freedom'? Freedom to do what? Does 'On its own' mean it changes my game without asking?"**
   - Where: Start a task panel, laptop and phone
   - What: The label "Freedom" with "Look only · Check with me first · On its own" ("On its own" is picked already).
   - Blocks: core, task 3. The ⓘ explains it, but the label alone made me stop.
   - Suggestion: Rename it to "How much can it do alone?" and add a line under "On its own": "you still check it before it goes in".
   - Fix: The label is now "How much can it do on its own?" (and the tip explains each choice).

7. **"What's a 'session'? Is 23% a lot?"**
   - Where: Start a task panel footer, laptop and phone
   - What: "23% of this session's usage used so far."
   - Blocks: minor
   - Suggestion: "You've used 23% of your Claude allowance until 9:00 AM." Say the time, not "session".
   - Fix: Kept "session", which the usage pop-up explains. The footer now turns amber with "It may wait for the reset" above 80%.

8. **The brief box looks a bit broken.**
   - Where: Start a task and New workflow, laptop and phone
   - What: "Drag a text file (.md or .txt) here, or Upload a file ·" has a lonely dot at the end. "Pick a file from the project" drops onto its own line. On the phone the sentence turns into "A text file (.md or .txt): Upload a file".
   - Blocks: minor (task 5 still worked)
   - Suggestion: Use two clear buttons ("Upload from my computer" and "Pick from the project") and no dot.
   - Fix: Kept: the phone layout already drops the dot and says "A text file (.md or .txt): Upload a file". The laptop dot only joins the two links.

9. **"I pressed Start and… the Start button disappeared? Did it start?"**
   - Where: Start a task with the goal "make a game", laptop
   - What: After Start, the footer only shows "Cancel". The "A few quick questions" box appears below the goal box, mostly off-screen, and nothing scrolls me to it.
   - Blocks: core, task 3
   - Suggestion: Scroll to the questions and put a line in the footer: "Answer a few quick questions first ↓".
   - Fix: The questions now show right under the goal box and scroll into view as each part appears. The footer says "Answer the quick questions above first ↑" instead of going blank.

10. **"It says I can leave any blank, but the button's grey."**
    - Where: Quick questions, phone
    - What: "Tap an answer for each, then press Improve my goal. You can leave any blank." "Improve my goal" stays disabled until at least one chip is ticked.
    - Blocks: core, task 3
    - Suggestion: Either allow it with nothing ticked, or say "Pick at least one answer".
    - Fix: "Improve my goal" now works with nothing ticked (it improves the goal from what you typed).

11. **"'Turn it on'? Turn what on? How much more does Smartest use?"**
    - Where: "Here's an improved version" box, phone
    - What: "Settings I'd suggest: Use the Smartest AI (uses more usage) · Games have rules and tricky logic… Turn it on".
    - Blocks: core, task 3
    - Suggestion: Label the button "Use Smartest for this task", and give a rough cost like "about 2× the usage".
    - Fix: The button is now "Use this setting", and Smartest says "(uses more usage)".

12. **The Helper told me wrong things about my own form.**
    - Where: Helper in the Start a task panel, phone
    - What: I asked "is this goal good enough? how long will it take?" The Helper said "Look only means it only reads and never builds, so switch Freedom…", but Freedom was set to **On its own**. It said "Your limit is 30 min", but Careful starts at **1 h**. It also wrote its own "Suggested goal" (a Pong game), which clashes with the improved goal the panel had just made (a dodge game).
    - Blocks: core, task 3 (bug: wrong facts)
    - Suggestion: The Helper must read the panel's current choices. Inside the task panel it should build on the improved goal rather than invent a different game.
    - Fix: The Helper is told that the open panel's choices are the truth, and to build on the improved goal instead of inventing a different one.

13. **"Why is 'Add a follow-up' grey?"**
    - Where: Agent page while running or waiting for plan OK, laptop and phone
    - What: The grey "Add a follow-up" button gives no reason. The Helper said "I can't see a reason… My guess is…".
    - Blocks: core, task 7
    - Suggestion: Hide it while running, or show "You can add a follow-up when this one's finished."
    - Fix: While it works, the follow-up button and box are hidden instead of greyed out.

14. **"Welcome page? I said README. Is it changing my website?"**
    - Where: Plan to approve, agent page and Inbox, laptop and phone
    - What: "I'll add one short, friendly line to the project's welcome page…"
    - Blocks: core, task 7
    - Suggestion: Plans should use the user's own word, or say plainly "the README (the project's info file, not a page on your site)".
    - Fix: Kept: the agent called the README "the project's welcome page" in its plan. Agents are told to use plain words. Noted that using the user's own word would be better.

15. **"It said 4 steps, now it says 5?"**
    - Where: Agent page, laptop
    - What: "Step 1 of 4" became "Step 3 of 5" about 10 seconds later, when a "Save the change" step appeared.
    - Blocks: core, task 7
    - Suggestion: Keep the step list fixed once the plan is approved, or say "(added a step)".
    - Fix: Kept: the default steps are replaced by the agent's own steps once it writes them. It happens once, in the first seconds.

16. **"Should I wait for the second AI before I put it in?"**
    - Where: Agent page after the task finished, laptop
    - What: "A second AI is double-checking this change. Its notes appear here in a few minutes." The "Put it in my project" button is already active underneath.
    - Blocks: core, task 9
    - Suggestion: Say "Wait for its notes (about 2 min) or put it in now", or hold the button until the check is done.
    - Fix: While the second AI checks, it now says "You can put it in now, or wait a few minutes for the second AI's notes."

17. **"Merged? What's merged?"**
    - Where: Agent page, Inbox, Helper; laptop and phone
    - What: The app's own words: "When it's merged, this turns to Done by itself." (agent page) and "For a bigger one, look before you merge to check it did everything." (Inbox). The Helper also offers a suggested question "What does Merge it do?".
    - Blocks: core, task 9
    - Suggestion: Use "put in your project" everywhere and remove "merge" from the main UI.
    - Fix: "merged" is gone from these lines ("Once it's in your project, this turns to Done by itself", "look at it first"), and the Helper's chip asks "What does Put it in my project do?".

18. **"Ship? Like a boat?"**
    - Where: Workflows, New workflow, workflow page, Put-it-in pop-up; laptop and phone
    - What: "Build carefully → Review → Ship (recommended)", "Ship (asks you first)", "it ships after you say yes", and in the pop-up "(this is called merging, or shipping)". The task flow says "Put it in my project" for the same thing.
    - Blocks: core, tasks 4, 6 and 9
    - Suggestion: Call the step "Put it in (asks you first)" so it matches the button, or explain "Ship" once inline.
    - Fix: The Ship step is now called "Put it in" everywhere: step names, sentences ("it puts it in your project after you say yes"), its settings ("How should it go in?") and the ready-made names.

19. **"Is 'Ready to look at' the same as 'Needs you' and 'Ready to go in'?"**
    - Where: Agent page, workflow page, Inbox, laptop
    - What: The same kind of finished change shows as "Ready to look at" (task), "Needs you · Waiting for your OK to ship" (workflow) and "Ready to go in" (Inbox card). On the See-what-changed page the workflow change says "Ready to look at" again. The Inbox buttons also come in a different order on each card ("Look at it / Put it in my project / More options" vs "Put it in my project / Look at it / Don't put it in / Open").
    - Blocks: core, task 8
    - Suggestion: Use one name and one button order for "a finished change waiting for you".
    - Fix: A finished change waiting for you is "Ready to look at" everywhere (task, workflow, Inbox, changes page). Workflow Inbox cards now show Look at it first, like task cards.

20. **"'Next'? Next what?"**
    - Where: Add a follow-up box, agent page, laptop
    - What: The button under "What should it do next?" is labelled "Next".
    - Blocks: minor
    - Suggestion: "Start the follow-up".
    - Fix: Now "Check and start" (it opens the panel to check the choices first).

21. **"Send back with a note vs Leave a note (no changes): which one do I want?"**
    - Where: See what changed, laptop and phone
    - What: Two buttons with almost the same words.
    - Blocks: core, task 8
    - Suggestion: "Ask it to change something" vs "Just write myself a note". Or drop the second one.
    - Fix: Renamed "Ask it to change something" and "Just write myself a note".

22. **"2 lines added? I asked for one."**
    - Where: See what changed, laptop and phone
    - What: "1 file changed · 2 lines added, 0 taken out". The second line is a blank line.
    - Blocks: minor
    - Suggestion: Don't count blank lines, or say "1 line (plus a blank line)".
    - Fix: Kept (minor): GitHub counts the blank line too.

23. **"What's Node.js? And the line is cut off."**
    - Where: Show the exact changes, phone
    - What: A gray context line "(needs Node.js; it only runs the rule chec…" runs off the right edge, above the green "+Hello from Sam!".
    - Blocks: minor (the words come from the project's README)
    - Suggestion: Wrap long lines on the phone, and dim or hide old context lines more.
    - Fix: Kept (minor): it's the project's own text shown as context.

24. **"If I put it in and hate it, there's no undo button?"**
    - Where: Put-it-in pop-up (task and workflow), laptop and phone
    - What: "If you change your mind later, start a task that says what to undo."
    - Blocks: core, task 9. It made Sam nervous about pressing it at all.
    - Suggestion: Add a real "Take it back out" on the Done change, or at least reassure: "It's easy to undo: we'll help."
    - Fix: Every confirm now says "Changed your mind later? It's easy to undo: start a task that says what to take out, and an agent does it."

25. **"If I press 'Don't put it in', is my work gone?"**
    - Where: Workflow run, waiting for OK, laptop and phone
    - What: The "Don't put it in" button has no explanation. The Helper said "I can't see in my data whether the saved copy is kept or removed, so I won't promise either way."
    - Blocks: core, task 9
    - Suggestion: Add a line under the button ("It's kept as a draft. You can still put it in later" or "It's thrown away"), and teach the Helper which one is true.
    - Fix: A line under the buttons now says "Don't put it in ends this run: nothing goes into your project, and the change stays in Run history." The Helper knows this too.

26. **"Public? Can other people see my game? Does it cost money? Can I make it private?"**
    - Where: Projects → Start a new project → Make it pop-up, laptop
    - What: "Its code is saved on GitHub as a public project… other people could read the code." It says nothing about cost or a private option. The Helper said "I can't see a price anywhere in your data", which is not reassuring.
    - Blocks: core, task 2
    - Suggestion: Add "It's free" and, if possible, a "Keep the code private" choice. Teach the Helper that it's free.
    - Fix: The pop-up now says "and it's free", and the Helper knows it's free. Kept public (the original brief asks for public projects).

27. **"Why does a file I add go to my Inbox first?"**
    - Where: Projects → Add a file ⓘ, laptop
    - What: "It shows up in your Inbox first: press Add it to my project there to finish."
    - Blocks: minor
    - Suggestion: Say why in a few words ("so you can check it first"), or add it right away since it's Sam's own file.
    - Fix: Kept: the tip says it shows up in the Inbox first so you can add it with one click.

28. **"What's 'lookout' and why is it 'still being built'?"**
    - Where: Projects, laptop
    - What: "Build → Review → Ship: Follow the details under: "What s…" still being built" is shown under lookout.
    - Blocks: minor (old data)
    - Suggestion: Let finished or stuck old jobs be tidied away from the Projects card.
    - Fix: Old data: Nic's own earlier workflow, still being built. It's listed as "still being built", not as waiting for you.

29. **"Ideas to pull requests? Labels?"**
    - Where: New workflow → Change the steps → ready-made sets, laptop
    - What: "Ideas to pull requests: For people who use GitHub: when an idea there gets the "agent" label…"
    - Blocks: minor
    - Suggestion: Hide it behind "More for GitHub users", or rename it to "Build ideas from GitHub".
    - Fix: Kept: labelled "For people who use GitHub".

30. **"'One short line at'? That's not a name."**
    - Where: Workflow page after Next, laptop and phone
    - What: The workflow was auto-named "One short line at", which is cut off mid-sentence.
    - Blocks: core, task 6
    - Suggestion: Make whole short names ("Sam was here line"), or ask for a name at Next.
    - Fix: Names no longer end on small words like "at", "by" or "from" ("One short line").

31. **"It says click to change the name, but I can't."**
    - Where: Workflow page while a run is going, laptop and phone
    - What: "Name (click it to change it)", but the field is locked (disabled) during a run, with no message. The other run buttons are also greyed with no reason.
    - Blocks: core, task 6
    - Suggestion: While running, show "You can edit it when this run finishes."
    - Fix: While a run is shown, the label says "Name (to change it, press Back to editing)". The banner explains the greyed run buttons.

32. **"Run now, Run with a different goal…, Test run, Test with a different goal…: which one?"**
    - Where: Workflow page header, laptop and phone
    - What: Four ways to start it, side by side.
    - Blocks: core, task 7
    - Suggestion: Show only "Run now" and "Try it safely first". Put the "different goal" options under a "More" link.
    - Fix: Kept: the spec asks for "Run with a different goal…" under both. They're small links under the two main buttons.

33. **"'Send back to fix at most twice': there's no review step. And what does '25% of a session… added up across resets' mean?"**
    - Where: Workflow page → Limits, laptop
    - What: The "Send back to fix, at most · twice" slider was shown even when the steps were only Start → Build → Ship. The "Most usage per run" ⓘ says "…added up across resets, so 100% is one full session."
    - Blocks: core, task 6
    - Suggestion: Hide "Send back" when there's no check step. Explain usage simply: "This run may use up to a quarter of your allowance."
    - Fix: "Send back to fix" now only shows when the workflow has a Review or Check step.

34. **"Why would I pick an old task to do this step?"**
    - Where: Step panel ("Build"), laptop
    - What: "Who does it? A fresh agent (recommended) / Arcade site (one of your agents) / Hello from Sam task (one of your agents)".
    - Blocks: minor
    - Suggestion: Say what picking an existing agent changes ("it remembers its earlier work"), or hide this choice by default.
    - Fix: Kept: "A fresh agent (recommended)" comes first. The tip explains what an existing agent adds.

35. **The page jumps around when the Helper is open.**
    - Where: Workflow page with Helper open, laptop
    - What: The Project dropdown overlaps the "Run with a different goal…" link. The step panel also covers the Ship step while it's open.
    - Blocks: minor (bug: layout overlap)
    - Suggestion: Let the header row wrap when the Helper takes space.
    - Fix: The top row only goes side by side on very wide screens now, so nothing overlaps with the Helper open. The step panel moves beside the Helper.

36. **"Where did my change go?"**
    - Where: Workflow page → Change it in your own words, laptop
    - What: I drafted a change ("Added a check step before shipping…" with Apply / Cancel), left the page, and came back. The draft was gone, and nothing had warned me it would be.
    - Blocks: core, task 6
    - Suggestion: Keep the drafted change until Apply or Cancel, or warn before leaving.
    - Fix: Not done: a drafted change is still lost if you leave the page before Apply. Noted for later.

37. **"Where's the button to say yes?"**
    - Where: Workflow run page, phone
    - What: The whole editing header (name, project, four run buttons, summary) comes first. "Needs you" is at the very bottom of the first screen, and "Put it in my project" is about two screens further down.
    - Blocks: core, tasks 7 and 9
    - Suggestion: While a run needs you, put the "Ready to go in" box at the top on the phone.
    - Fix: On a phone, a "It's waiting for you · Jump to it ↓" bar now shows at the top of the workflow page.

38. **"'Watch'? It's waiting for me, not doing anything."**
    - Where: Workflow page → Run history, laptop and phone
    - What: The row says "Needs you · Look at it · Watch".
    - Blocks: minor
    - Suggestion: Call it "Open" or "See this run".
    - Fix: Kept (minor): "Watch" opens the run.

39. **The Helper was behind the page.**
    - Where: Helper on the workflow run, laptop
    - What: The Helper said "workflow is on step 2 of 4, Build… now running a check". The page already said "Needs you · Waiting for your OK to ship". The page also never shows step numbers, so "step 2 of 4" didn't match anything.
    - Blocks: core, task 7 (bug: out-of-date answer)
    - Suggestion: Re-read the run state just before answering, and use the page's own words.
    - Fix: The Helper reads the live data each time. It's now also told the real waiting reason. Couldn't reproduce the step numbers.

40. **"It's waiting for usage, but the meter says I've only used 54%?"**
    - Where: Home, agent page, laptop and phone (after a simulated usage limit)
    - What: A red banner "1 run is waiting for usage to reset." and "Waiting · back at 4:30 AM. It carries on by itself", while the meter shows "54% used". It also still said "Waiting · back at 4:30 AM" after 4:30 had passed. The Helper admitted "the meter and Claude's own count can differ a little."
    - Blocks: core, task 10
    - Suggestion: Explain the gap ("Claude said stop even though the meter shows room left: this happens sometimes"). After the time passes, change it to "Trying again now…". Make the banner amber instead of red, since nothing is broken.
    - Fix: The banner is now amber: "…waiting for Claude's usage to free up. It carries on by itself. Nothing is broken." It explains that Claude's limit can kick in before the meter shows 100%, and after the wait time it says "Trying again now…".

41. **"10 hours?! It started 3 minutes ago."**
    - Where: Agent page after a simulated time limit, laptop and phone
    - What: "It ran out of time after 10 h of work." Then, after Keep going: "Picking up where it stopped… · 10 h so far". The limit was 30 min and the run had been going for minutes. This may come from the simulate tool, but Sam would believe it.
    - Blocks: core, task 10 (bug if it isn't just the simulation)
    - Suggestion: Check the time math for stopped and resumed runs, and show the real limit ("hit its 30 min limit").
    - Fix: Test-only: the test switch pretends 10 hours of work on purpose. Real runs count their real time.

42. **"Does it carry on by itself, or do I have to press something?"**
    - Where: Agent page, "Ran out of time", laptop and phone
    - What: "Its work so far is kept. It carries on right where it stopped." This sits right above a "Keep going (+30 min)" button.
    - Blocks: core, task 10
    - Suggestion: "Press Keep going to give it 30 more minutes. It'll carry on where it stopped."
    - Fix: Now "Its work so far is kept. Press the button below to give it more and it carries on right where it stopped."

43. **The Helper said the order doesn't matter. Does it?**
    - Where: Helper in the Inbox, phone
    - What: "All three change the README, so the order doesn't matter much." All three changes add a line at the very end of the same file, so after the first goes in the others may clash.
    - Blocks: core, task 9 (bug: risky wrong fact)
    - Suggestion: The Helper should warn when several waiting changes touch the same file ("put in one, then check the others").
    - Fix: The Helper is told to warn when several changes touch the same file ("put in one, then look at the others"). The changes page also shows a clash warning with "Fix the clash".

44. **"How do I make it do the job again?"**
    - Where: Agent page of a finished task, laptop
    - What: "Each time you start it, Hello from Sam task will work on arcade…", but the page has no Run / Start again button, only "Add a follow-up · Change this agent · Archive".
    - Blocks: minor
    - Suggestion: Add a "Run it again" button, or change the sentence.
    - Fix: Kept: Add a follow-up is how a task runs again (it carries on the same job).

45. **"Now, When I start it, Only when you ask: are these the same?"**
    - Where: Task panel, agent editor, agent page
    - What: Three names for the same schedule choice.
    - Blocks: minor
    - Suggestion: Pick one, such as "Only when I start it".
    - Fix: Kept: "Now" (a one-off task) and "When I start it" (a saved agent) mean slightly different things.

46. **"'On'? What's on?"**
    - Where: Agent editor, bottom, laptop
    - What: A switch labelled only "On" with an ⓘ, on a one-off task.
    - Blocks: minor
    - Suggestion: "Switched on (it can run)" / "Switched off (it won't run)".
    - Fix: Now "On (it can run)" / "Off (it won't run)".

47. **"Drafting workflows used 53% of today?"**
    - Where: Usage pop-up (click the meter), laptop
    - What: "Drafting workflows 53% of today · 16 runs" and "Workflow step 10% of today · 2 runs". It's not clear what "drafting" is or why it costs that much. Other tests on the same account may be included.
    - Blocks: minor
    - Suggestion: Name the rows in plain words ("Making new workflows", "One short line at (workflow)") and link to them.
    - Fix: Kept: the rows name what used the usage, and other tests on the same account were included.

48. **"I just asked a question, why does it say 'Set up this task'?"**
    - Where: Helper on Home, laptop
    - What: I asked "what's the difference between a task and a workflow…". The answer ended with a "Set up this task" button.
    - Blocks: minor
    - Suggestion: Only offer action buttons when the user asked for something to be done.
    - Fix: Kept (minor): the Helper offers a task button when it fits.

49. **"If I delete it, what happens to the change that's waiting?"**
    - Where: Agent editor → Delete agent pop-up, laptop
    - What: "Delete Hello from Sam task? Its history goes too. This can't be undone." The change waiting in the Inbox isn't mentioned.
    - Blocks: minor
    - Suggestion: Say what happens to a waiting change ("It stays in your Inbox" or "It's thrown away").
    - Fix: The Delete pop-up now says what happens to a waiting change.

50. **"Where are Settings and Help on my phone?"**
    - Where: Phone ☰ menu
    - What: The ☰ menu only holds "Pause everything". Settings, Help, Connectors and the rest are only in the footer, under long pages.
    - Blocks: minor
    - Suggestion: Put Help and Settings in the ☰ menu too.
    - Fix: Already there: the phone ☰ menu has Connectors, Machine, Terminal, Settings and Help below Pause everything (scroll the menu).

**Total: 50 questions**, **29 in the core tasks** (numbers 3, 4, 6, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 24, 25, 26, 30, 31, 32, 33, 36, 37, 39, 40, 41, 42 and 43) and 21 minor.

## Bugs in short
- **Helper gave wrong facts**: the task form's Freedom and time limit (#12), out-of-date run state (#39), and "order doesn't matter" for three changes to the end of the same file (#43).
- **"10 h" time shown** for a run that took minutes, after a simulated time limit (#41).
- **"Waiting · back at 4:30 AM"** still showing after 4:30, with a red banner while the meter shows 54% (#40).
- **Layout**: the Helper bubble covers buttons and text on the phone (#5). With the Helper open, the Project dropdown overlaps "Run with a different goal…" (#35).
- **Greeting** says "Good evening" at 4 AM (#1).
- **Start button disappears** with no hint after a vague goal (#9).
- "Improve my goal" is disabled when no answers are picked, although the text says any can be left blank (#10).
- **No critical bug**: every "put it in" button I tried (task Put it in my project from the agent page and from See what changed, workflow Put it in my project) showed an "are you sure" pop-up first, and Cancel left the change waiting. Make it (new project), Pause everything, Archive and Delete agent also asked first. I cancelled all of them.

## Real pull requests opened (all on NicB-coder-bot/arcade, none put in)
- https://github.com/NicB-coder-bot/arcade/pull/19 (task "Hello from Sam task")
- https://github.com/NicB-coder-bot/arcade/pull/20 (workflow "One short line at", draft, waiting at Ship)
- https://github.com/NicB-coder-bot/arcade/pull/21 (task "Adding thanks line", recovered with Keep going after the simulated failures)

No new project was created (I cancelled the "Make "my-cool-game"?" pop-up). The test copy stayed up the whole time.
