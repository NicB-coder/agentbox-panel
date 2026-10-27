# Beginner review, round 1 (Sam)

**Who:** Sam, 15. Has used ChatGPT a little. Has never used Claude Code, a terminal, GitHub or any agent tool, and doesn't know words like repo, branch, pull request, worktree, model, prompt, workflow, merge, commit or token. Smart but impatient: anything that makes Sam stop for more than a few seconds counts.

**Date:** 2026-10-25
**Where:** the test copy at http://127.0.0.1:3253, driven with Playwright. The welcome tour was reset first.
**Widths tested:** laptop 1366×900 and phone 390×844. I took screenshots of every page and pop-up, read the text of each, clicked every ⓘ bubble, and asked the Helper a question on every page and in every panel or pop-up I opened.
**Core tasks done:** 1 tour · 2 add a project · 3 vague task ("make a game") · 4 workflow from an idea · 5 attach a brief · 6 edit a workflow (including "Change it in your own words") · 7 run it and follow along · 8 find and look at the result · 9 merge, up to the final confirm (cancelled) · 10 work out what to do when something fails.

Tags: **[T1]…[T10]** = the core task it gets in the way of; **[minor]** = slows Sam down but doesn't block a task.

---

## Questions and moments of hesitation

### First visit and home page

1. **"What's a pull request?"** Welcome tour step 4 of 4 (laptop and phone): "Anything that needs you (an OK, a pull request to look at, something that went wrong)…". This is the first piece of jargon Sam meets, and nothing explains it. **[T1]**
   Suggestion: say "a finished change to look at" in the tour, or link it to the Help glossary.
   Fix: The tour now says "a finished change to look at" instead of "a pull request".

2. **"OK… so where do I start? Do I need a project first?"** Tour step 2: "Press New task, say what you want, and press Start." The tour never mentions Projects. The New task box then picks "agentbox-panel" for you (see #17). **[T1][T3]**
   Suggestion: add one tour line: "Your work goes into a project. Pick one, or make a new one, on Projects."
   Fix: Tour step 2 now starts with projects: "Your work lives in a project (a folder for one app or game). Make one on the Projects page…"

3. **"Where's the New task button?"** (phone 390) Tour step 2 says "Press New task", but on a phone that button is hidden inside the ☰ menu. The bottom bar has Agents / Workflows / Inbox / Projects and no New task. **[T1][T3]**
   Suggestion: show a New task button on phone (in the header, or as the first item in the bottom bar).
   Fix: The New task button now shows in the header on phones too.

4. **"Is 44% how much I have left, or how much I've used?"** The tour says the meter "shows how much of your Claude usage is left", but clicking the meter says "This session: 47% used". **[T1]**
   Suggestion: use "used" in both places, and put "used" next to the number in the header too ("44% used").
   Fix: The meter says "44% used" in the header, and the tour says "how much you've used so far".

5. **"What's a 'session'? How can I have used 47% of the session but only 12% of the week? And did the Helper use 100% of everything?"** Usage pop-up (laptop): "This session: 47% used … This week: 12% used … Today, by agent: Helper 100% · 1 chat reply". It also says "Numbers come from Claude Code's own usage check". **[minor]**
   Suggestion: "Session = the next few hours (resets at 1:00 PM)". Change "Helper 100%" to "Helper used all of today's share so far". Drop "Claude Code".
   Fix: The pop-up explains a session ("a set amount every few hours") and the week. The per-agent lines say "% of today", the heading says "share of today's total", and "Claude Code" is gone.

6. **"What's ONE-QUESTION.md? What's a repo root?"** Home tile "Arcade site": "Follow ONE-QUESTION.md in the repo root, milestone by milestone." This comes from the copied data, but it's the first tile Sam sees. **[minor]**
   Suggestion: tiles could show the plain-English summary line rather than the raw job text when the job mentions files.
   Fix: Kept: that tile is Nic's own job text from the copied data, and Sam would only see his own words there.

7. **"Who is the Helper talking to? I never asked about that."** Opening the Helper for the first time shows someone else's old conversation, and the first answer goes on with "I also got something wrong earlier. Your Build → Review → Ship run is Stopped…". **[T1]** (affects every page)
   Suggestion: start a new chat on a first visit (or after the tour), or after a long gap.
   Fix: After a break of 3 hours or more, the Helper opens on a clean page instead of an old chat. Old chats are still under Earlier chats.

8. **"Did it answer? I can't see anything."** Every Helper answer (laptop and phone) lands below the visible area. A floating "↓ New text" pill sits over the conversation, so Sam has to spot it and click it every time. On a phone the Helper opens scrolled to an old answer from another page. **[T1–T10]**
   Suggestion: scroll once to the start of the new answer when it begins, and only hold still while it's typing.
   Fix: New answers now stay in view. The chat follows a new reply until your question reaches the top, then holds still, and only then shows "↓ New text".

### Adding a project (Projects page)

9. **"Which of these three boxes do I use? What's a repo?"** "Add a project" has "Paste a GitHub repo", "Pick one of the bot's repos" and "Make a new repo", with labels "Repo (owner/name)". Sam wants "start a new project for my game", and that option comes last and is written in jargon. **[T2]**
   Suggestion: put "Start a new empty project" first, call the rest "Already have one on GitHub?", and avoid "repo".
   Fix: Add a project now starts with "Start a new project", then "Already on GitHub?" and "Or pick one from GitHub". The word "repo" is gone, and the page intro explains what a project and GitHub are.

10. **"Who's 'the bot'?"** "Pick one of the bot's repos", "makes … on GitHub under the bot account", and the ⓘ: "Repos the bot account owns or was invited to". **[T2]**
    Suggestion: "the agentbox GitHub account" plus a one-line explanation, or hide it from beginners.
    Fix: "The bot" is now "the agentbox GitHub account (NicB-coder-bot)", explained in the ⓘ.

11. **"Public? Anyone can see my code? Is that bad? Can I make it private?"** Confirm pop-up: "Make a public repo? … It's public, so anyone can see the code. Never put passwords or keys in it." This is scary for a 15-year-old, and there's no private option and no reassurance. **[T2]**
    Suggestion: say why it's public and that it's fine for games, or offer a "Private" choice.
    Fix: The confirm now says it's public "like most school and hobby projects. That's fine for games and sites. Just never put passwords or private info in it."

12. **"I typed 'My Game!' and it asked me to confirm. Will it really be called that?"** The Name field accepts spaces and "!" and goes straight to the "Make a public repo?" confirm with "My Game!" in it. Sam would end up with a strangely changed name, or an error after confirming. **[T2]**
    Suggestion: check the name as Sam types and show the real name it will get ("my-game").
    Fix: Under the name box it now shows the real name as you type ("It will be called “my-game”"), and the confirm uses that name.

13. **"Did anything happen?"** Pressing "Add it" with an empty box does nothing at all. With a bad value, the error "Type it like owner/name…" appears at the very top of the page, out of view, while Sam is at the bottom by the button. The success message "Made sam-hello-test on GitHub and copied it here." also appears at the top, out of view. **[T2]**
    Suggestion: show errors and success next to the box that was used, and disable or explain an empty "Add it".
    Fix: Errors and success messages now show inside the card you used. An empty Add it is greyed out, and an empty Make it says what to type.

14. **"'Ask Claude to fix this'? Fix what? Who's Claude?"** This button sits next to a simple typing mistake ("Type it like owner/name"). **[T2]**
    Suggestion: hide that button for "you typed it wrong" errors.
    Fix: Typing-mistake errors no longer show the fix button. Everywhere else it's now "Ask an agent to fix this".

15. **"What's 'draft'? What's 'Initial commit'?"** Project cards: "1 open pull request · #12 Arcade site (in progress) draft", "Last change … 'Initial commit'". **[minor]**
    Suggestion: "1 change waiting for you", "Just created".
    Fix: Cards say "N changes waiting for you to look at", "not finished yet" instead of "draft", and the "Initial commit" message is no longer shown.

16. **"I just want to add a file. Why do I have to merge something?"** "Add a file" ⓘ: "Puts a file from your computer (like a CLAUDE.md brief) into this project. It opens a pull request; merge it from the Inbox with one click…". **[T5][minor]**
    Suggestion: "It shows up in your Inbox. Press Merge it there to finish adding it."
    Fix: The ⓘ now says "It shows up in your Inbox first: press Merge it there to finish adding it."

### Starting a task with a vague goal (New task)

17. **"Is that where my game will go?"** In "Start a task", Project defaults to **agentbox-panel**, which is the panel itself. If Sam just types "make a game" and presses Start, the game is built inside agentbox. The Helper even says "Don't use agentbox-panel, because that's the panel itself." **[T3]**, risky
    Suggestion: default to the last project used, or make Sam choose (no default), and label agentbox-panel "this app itself".
    Fix: New task now picks the project you used last, or else the first project that isn't the panel. agentbox-panel is labelled "(this app itself)".

18. **"What's a brief? Did I attach that?"** With agentbox-panel selected, the box says "This project has a brief ✓ (CLAUDE.md · 103 lines) View". Sam didn't attach anything. **[T3][T5]**
    Suggestion: "This project already has instructions for agents (View)". Hide the file name.
    Fix: Now reads "This project already has a brief ✓ (agents read it by themselves)", and a line under the heading explains what a brief is.

19. **"What's a .md file? How do I make one?"** "Drag a .md file here, or Upload a file · Pick a file from the project". The ⓘ says "A longer file that says exactly what to do, like a CLAUDE.md." **[T5]**
    Suggestion: "a text file with your instructions (.md or .txt)", plus a "Write one here" option.
    Fix: Says "Drag a text file (.md or .txt) here". The new line under the heading explains a brief is "a text file with longer instructions… Skip this if your goal says it all."

20. **"Why would my game need my Gmail? And what's Discord?"** More options: "Connectors: Gmail, Google Calendar, Google Drive, Google Sheets, Claude Docs". "Tell me when" has "Finished", "Needs my OK" and "Only if something goes wrong" all ticked at once (those contradict each other), and the ⓘ says "When it sends you a Discord message". **[minor]**
    Suggestion: hide Connectors for Build tasks unless asked. Make "Tell me when" a single choice. Say where the messages go.
    Fix: The Tell me when ⓘ explains Discord ("a chat app") and "Tick as many as you like", and "Only if something goes wrong" is now "Something goes wrong", so the ticks don't contradict each other. Connectors stay under More options, where they're empty unless connected.

21. **"Where did the Start button go? Did it break?"** After pressing Start with "make a game", the "A few quick questions" box appears at the very bottom of the panel, mostly off-screen, and the footer now shows only "Cancel". **[T3]**
    Suggestion: scroll the questions into view (or show them in place of the form), and keep a clear "Skip and start" in the footer.
    Fix: When the quick questions appear, the panel scrolls them into view. They have their own buttons (Improve my goal / Skip the questions / Keep mine and start).

22. **"I already said exactly what I want, why the quiz?"** The coach also stopped "Add a short line to the README saying hello." to ask "What should the hello sound like? / Where should it go? / Anything to add?". **[T3][minor]**
    Suggestion: skip the questions for short, specific tasks, or make "Start anyway" the main button.
    Fix: The coach is told that small, specific changes are detailed enough. It only forces questions for goals of under 5 words (it used to be under 8).

23. **"Which 'Use this' uses my new goal?"** In "Here's an improved version" there's a small "Use this" next to "Settings I'd suggest: Careful mode", plus "Use this and start". Sam pressed "Use this", it turned into "✓ Done", and the goal box still said "make a game". **[T3][minor]**
    Suggestion: rename it "Use these settings".
    Fix: The settings button now says "Turn it on" ("✓ Turned on"), so it's not confused with Use this.

24. **"Why is my agent called 'Make Make'? And now it's 'Arcade dodge game'… which one is mine?"** The new agent first appeared as "Make Make", then renamed itself "Arcade dodge game". It then planned a tap game called "Pop", and in the end only added a README line, but the name stayed. **[T7]**
    Suggestion: name it from the goal once (e.g. "Phone action game") and keep that name. Never use doubled words.
    Fix: Names skip the coach's "What to make:" label and never repeat a word, so this one becomes "Phone action game".

### Following a run, plans and Change it (agent page)

25. **"What is all this? Is it broken?"** The plan shown under "Here's its plan. Is this OK?" is raw agent text: "I can't start building yet because plan mode is on… The plan is saved at `/Users/agent/.claude/plans/your-job-in-nic-s-greedy-milner.md`. I also don't have a way to formally submit it for approval here", with literal `**asterisks**`, `js/common.js`, `css/style.css`, `npm test`, and "commit on this branch without pushing". This breaks the "never show file paths or commands" rule. **[T7]**, major
    Suggestion: ask the agent for a plain-English plan (3–5 bullets, no file names), show markdown properly, and remove the file path and plan-mode remarks.
    Fix: In planning, agents are told to write 3–6 plain bullet points with no file names, commands or plan-mode talk. The page also strips markdown and any plan-file or plan-mode lines.

26. **"Which setting is 'plan mode'?"** The form says "Check with me first", but the Helper says "It's set to 'Plan first'" and "Plan mode is the 'Plan first' setting", and the plan itself says "plan mode is on". **[T7]**
    Suggestion: use one name everywhere ("Check with me first").
    Fix: "Plan first" is now "Check with me first" everywhere, including what the Helper sees.

27. **"I changed it to just a README line, so why does it still say 'Build the game'?"** After "Change it" → "Too big. Just add one short line to the README…", the steps still read "Build the game → Test it in a browser". "Right now" and "The job" still describe the action game. The reviewer then judged the work against the old game goal ("the new game is missing"). **[T7][T8]**, major
    Suggestion: when a plan is changed, update the shown task and steps, and give the reviewer the changed request.
    Fix: "Change it" is now saved with the run. The page shows "You changed it: …" under the task. The agent is asked for a fresh step list after approval, and the reviewer is told the change wins.

28. **"What should I type here?"** The "Change it" box ("What should it change?") has no example text, unlike the other boxes. **[minor]**
    Suggestion: placeholder "For example: Make it smaller, only one game".
    Fix: Added an example: "For example: Make it smaller, just one game."

29. **"What's a branch commit? What's a diff?"** Live progress text while running: "Reviewing: Show branch commits, diff, and status…", "Reviewing: Run the project tests…", step "Commit it", "Sending a pull request…". Workflow step results say "committed a research.md…", "The branch adds only two notes…". **[T7]**
    Suggestion: turn tool activity into plain words ("Checking the changes", "Saving the work").
    Fix: Live activity is now in plain words ("Looking at what changed", "Saving the work", "Running the checks"), and "Sending a pull request…" is now "Getting it ready for you to look at…". Agents are told not to use code words in steps and summaries.

30. **"…coming faster and — and what?"** The "Right now" headline cuts the task off mid-sentence with no "…" ("…things that keep coming faster and"). The "See what changed" subtitle is cut off at "…quick to start and ex". **[minor]**
    Suggestion: cut at a word boundary with "…", or use the agent's one-line summary.
    Fix: Long tasks are now cut at a whole word with "…".

31. **"This log is about something completely different."** On "Arcade dodge game", "Show the full log" (run "8:56 AM · What to make…") shows "[03:25:02] Run started by Nic · task: Review: pull request #12 · … /Users/agent/agents/worktrees/agentbox-panel/review-10054 …". That's the wrong run's log (probably reused run numbers in the test copy). **[T7][T10]**, bug
    Suggestion: make sure each run's log belongs to that run, and clear old logs when copying the database.
    Fix: A test-copy leftover: old logs from an earlier copy shared the same run numbers. A new run now always starts its log fresh, and dev-copy.sh fresh clears old logs.

### Finding and looking at the result

32. **"Reviewed ✓ Nothing to fix… but it also says it isn't ready to ship? Which is it?"** The Inbox card and "See what changed" show a green "Reviewed ✓ Nothing to fix." Opening "What it found" shows "Review result: the new game is missing, so this isn't ready to ship." **[T8]**, major
    Suggestion: the badge must follow what the review actually says ("Reviewer: not ready, see why").
    Fix: Root cause: the reviewer forgot its VERDICT line, and a missing line counted as "passed". Now its words decide ("isn't ready", "is missing" and so on mean needs work), using the same rule everywhere.

33. **"What's agent/make-make-what-to-make-make-10054? What's main?"** "What it found" text: "This branch (agent/make-make-what-to-make-make-10054) has only one change compared to main: README.md…", "The arcade already has Ski (js/ski.js)…". **[T8]**
    Suggestion: rewrite review reports in plain words, with no branch names or file paths.
    Fix: Reviewers are told not to mention branch names, file paths, commands or code words.

34. **"The before and after pictures look exactly the same. Did it do anything? Where's my hello?"** For a README change, both pictures and "Try the new version" show the same arcade page. Nothing says the change isn't visible on the website. **[T8]**
    Suggestion: when no page changed, say so ("This change is in a text file, not on the page") and show the changed text instead.
    Fix: When only files that don't show on the page changed, the pictures are replaced by: "This change is in a file that doesn't show on the page (README.md), so the site looks the same…"

35. **"Look at it, Open, More, What it found… which one do I press?"** An Inbox card has "What it found" (link), "Look at it", "Merge it", "More" and "Open". Open goes to the agent page, Look at it goes to the changes page, and More hides "Get a second opinion". **[T8]**
    Suggestion: keep two buttons (Look at it, Merge it) and put the rest under one "More".
    Fix: Pull request cards now show Look at it, Merge it and "More options" (Get a second opinion, See its whole history). The extra Open link is gone.

36. **"The Helper says don't merge, the page says nothing to fix. Who do I believe?"** On the changes page and in the Inbox, the Helper says "the reviewer said the build needs to run again. So don't merge it. Use Send back to fix…". The page says "Reviewed ✓ Nothing to fix." and the button is called "Send back with a note", not "Send back to fix". **[T8][T9]**
    Suggestion: fix #32, and make the Helper use the exact button names on screen.
    Fix: Fixed by #32. The Helper is also told to use only the exact buttons that are on screen, and to go by the findings text.

37. **"Did I do something wrong? It was supposed to be quick."** "It finished in under 2 minutes. That's very quick for real work, so check it did the whole job." appears on purposely tiny tasks (the README hello task, and the workflow test run as an Inbox card "Finished very fast"). **[minor]**
    Suggestion: only warn when the task looked big, or soften it ("Quick job. Have a look to be sure").
    Fix: Softened to: "It finished in under 2 minutes. That's fine for a small job. For a bigger one, look before you merge…". The Inbox label is now "Finished quickly".

38. **"diff --git a/README.md b/README.md index f969461..979cf28 @@ -3,6 +3,8 @@ — what?"** "Show the code changes" shows the raw diff header. **[minor]**
    Suggestion: hide the header lines and show just the green/red lines with the file name.
    Fix: Renamed "Show the exact changes". The technical header lines are hidden, the file name is shown in bold, and a note says green lines were added and red taken out.

### Merging (stopped at the confirm, then cancelled)

39. **"What's main? If I can't undo it from here, where can I? Is this safe?"** Confirm pop-up (laptop and phone): "Merge this pull request? Its changes go into main, the real version of your project. You can't undo this from here." **[T9]**
    Suggestion: "Put these changes into your real project? If you change your mind later, ask an agent to undo it." Say what changes ("1 line added to the README").
    Fix: The confirm is now "Put these changes into your project?… (this is called merging). If you change your mind later, start a task that says what to undo."

40. **"The Helper doesn't even know which button I mean."** With the merge confirm open, asking the Helper "what happens if I press this? can I undo it?" got "I'm not sure which button you mean." The Helper header shows the raw page address "on /changes". **[T9]**
    Suggestion: tell the Helper when a confirm pop-up is open, and show the page title instead of the URL.
    Fix: Every "Are you sure?" pop-up now tells the Helper its title, text and buttons. The chat shows page names ("What changed") instead of addresses.

### Workflows: make from an idea, attach a brief, edit

41. **"What do all these little icons mean? Who's 'Builder'? What's Discord?"** Workflows list: rows of unlabelled icons, and descriptions such as "…a reviewer checks it (back to Builder if it needs work, up to twice), a reviewer checks it (back to Builder…)…" (said twice), "Builder works on it, Builder works on it…", "Research report: …it builds it…", "it tells you on Discord". **[T4]**
    Suggestion: label the icons (or drop them on the list), merge repeated steps ("reviewed twice"), and explain who Builder is.
    Fix: Workflow tiles show each step's name next to its icon. Repeated steps are said once ("(twice)"), "back to Builder" is now "goes back to the “Build” step", Discord is now "sends you a message", and the page intro explains what a workflow is.

42. **"That's not the idea I picked."** Picking the idea "Guess the Song Game" put "…at least 30 questions, a score counter, and a hint button" in the goal box. After Next, the saved workflow's goal had been rewritten to "…pick the right song from four choices. Include at least 20 questions… 'play again' button", with no "Use this / Keep mine" choice. **[T4]**
    Suggestion: never change the goal without showing it and asking ("Keep mine").
    Fix: Couldn't reproduce: version history shows the first saved goal was exactly what was in the box (the idea list makes new ideas each time it opens). Nothing changes the goal without a click.

43. **"What's my workflow called?"** The name field cuts the title off: "Small guessing game wek" (laptop) and "Small guessing game websit" (phone). It isn't obvious it can be edited, and the name didn't change when the goal became a README line. **[minor]**
    Suggestion: let the name wrap or shrink, and add a pencil/"Rename" hint.
    Fix: The label is now "Name (click it to change it)" with a visible border, and the font is smaller so more of the name fits.

44. **"Why is it Off? Why can't I just run it?"** A new workflow starts **Off**, with only "Test run" and the note "Turn it on when you're happy, and Run now appears." The ⓘ on Off says "starts by itself (on its schedule or from GitHub)". **[T4][T7]**
    Suggestion: show "Run now" all the time, and explain Off as "won't start by itself".
    Fix: Workflows that you start yourself have no On/Off switch any more and always show Run now. On/Off only shows for scheduled or GitHub-started ones.

45. **"Did it save my change?"** The top-right button shows a grey "Saved" that looks disabled. After Sam edits the goal it turns into "Save", easy to miss far from the text box. **[T6]**
    Suggestion: show "Saved ✓" as text, not a button, and save goal edits automatically (or put Save next to the box).
    Fix: When nothing is unsaved, it shows "Saved ✓" as text. When something is, it shows a "Save changes" button.

46. **"Where did my goal and steps go?"** After a run finishes, the workflow page shows "Done · A past run · test run" with the run view. The goal box, "Change it in your own words" and the step editor are hidden until Sam finds "Edit". **[T6][T8]**
    Suggestion: keep the editor below the last run, or add a clear "Back to editing" button.
    Fix: "Edit" is now "Back to editing".

47. **"It says press Look at it or Try again, but there's no Look at it button here."** On the workflow page after the test run: "Press Look at it to see what it changed. If it isn't right, press Try again, or ask the Helper why." The buttons there are only "Pull request" (opens GitHub and leaves the app) and "See it". **[T8]**, bug
    Suggestion: add the same Look at it / Try again buttons as the Inbox card, and send "Pull request" to the in-app "See what changed".
    Fix: After a run, the header shows Look at it (in the app, not GitHub) and Try again. Run history also says Look at it and "See its steps".

48. **"Why would 'Arcade dodge game' do a step in my song workflow?"** Step panel "Build": "Who does it? A fresh agent / Arcade site / Arcade dodge game". The step's instructions say "…test that it really works (run the tests, or open the page in a browser), and commit." **[T6]**
    Suggestion: explain "A fresh agent (recommended)" vs "an agent you already have, with its memory of past work", and drop "commit".
    Fix: "A fresh agent (recommended)" and "<name> (one of your agents)", with an ⓘ explaining the difference. The default instructions no longer say "commit".

49. **"The Helper doesn't see the change I'm drafting."** While "Change it in your own words" was drafting "skip the review…", asking the Helper "what will this change do?" got "I'm guessing you mean this workflow… a reviewer checks it…", which describes the old steps. **[T6]**
    Suggestion: pass the open draft (before and after) to the Helper.
    Fix: The drafted change (its before and after steps) is now passed to the Helper.

50. **"My brief says one thing and my goal says another. Which wins?"** The attached brief ("Only change the README") contradicted the goal ("Make a small guessing game website…"), and nothing warned about it. The goal check said "Looks good ✓". **[T5][minor]**
    Suggestion: let the goal check read the brief and flag conflicts.
    Fix: With a brief attached, the coach is told to flag a brief that disagrees with the goal, and the heading then says "One thing to check" instead of "Looks good ✓".

51. **"That's a lot of words."** The ⓘ on "Most usage per run" is about 90 words, about sessions, resets, "Pick up where it stopped" and meter failures. **[minor]**
    Suggestion: one sentence, with a "More" link to Help.
    Fix: Both usage tips are now two short sentences.

### When something fails

52. **"It says 'Stopped, ran out of time.' Now what?"** On an agent page, stopped runs ("It ran out of time (the limit is 30 minutes)." and "The panel restarted while it was working.") show only a red "Stopped" pill: no Keep going, no Try again, and no "what to do". They're also buried about 6,000px down a long history with no paging. The Helper and the Time limit ⓘ both mention a "Keep going" button that doesn't appear there. **[T10]**
    Suggestion: give every stopped run a plain "What happened / What you can do" line with Keep going / Try again buttons, and collapse long history.
    Fix: History shows 8 runs, then "Show older runs". Each stopped run says what to do ("see Right now at the top" for the newest, "Nothing to do here: newer runs came after it" for older ones).

53. **"The Helper says nothing ran out of time, but I can see two that did."** On Reviewer's page, the Helper said "None of your agents or runs shows Ran out of time right now." Two runs on that same page say "It ran out of time". **[T10]**
    Suggestion: let the Helper read the history of the agent that's open, including archived ones.
    Fix: The Helper now gets the open agent's last 15 runs, with why each one stopped.

54. **"Should I press 'Pick up where it stopped' or not? And I didn't stop it."** On a stopped workflow run, the page offers "Pick up where it stopped", but the Helper says "Don't pick up the old run". The reason shown is "You stopped it.", which is confusing for whoever didn't. **[T10]**
    Suggestion: when picking up makes no sense (e.g. nothing was built), say so on the page. Word it as "Stopped by hand".
    Fix: A manual stop now reads "Stopped with the Stop button." The Helper is told to recommend only buttons that make sense.

### Other pages and layout

55. **"Should I be in here?"** The footer links to "Terminal" ("A command line on this Mac… Everything you type runs on agentbox for real"). There's no warning beyond the ⓘ. **[minor]**
    Suggestion: hide Terminal behind Settings → "Advanced", or add a clear "for grown-up fixes only" note.
    Fix: The menu and footer now say "Terminal (advanced)", and the page says "For advanced fixes only… You never need it for normal use."

56. **"What's Tailscale? What's 0638b9a? What's @here?"** Machine page: "Tailscale", "Version 0638b9a · branch agent/follow-one-question-md-…". Settings: "Discord messages", "Adds @here", and messages with a raw "https://github.com/NicB-coder-bot…" link. **[minor]**
    Suggestion: hide version and branch under a "Details" toggle, and explain Discord in one line.
    Fix: The Machine page shows "From Oct 25", with the version and branch under Details, and the Tailscale card is called "Private network (Tailscale)". Discord is explained in Tell me when.

57. **"The chat window is covering the button I need."** The open Helper panel covers controls at laptop width: on Projects it hides the "Make it" button and most of the "Make a new repo" card. On the agent page it hides "Add a follow-up / Stop / Settings" and the Schedule box. In the New task panel it overlaps the right edge (the "Help me think of ideas" link and the Project dropdown arrow). On a phone, the closed bubble sits on top of "Pick a file from the project" in the New task panel. **[T2][T3][T7]**, bug
    Suggestion: on wide screens, push the page left when the Helper opens (or dock it). Keep the bubble clear of the panel footer and links.
    Fix: On a laptop, the open Helper now docks on the right: the page and its pop-ups move over so it covers nothing. On a phone, the bubble tries more spots along the row to stay off links.

58. **"'Now' or 'When I start it'? Are they the same?"** New task says "When does it run? Now / Every hour…", but the agent's Settings page says "When I start it / Every hour…", while its ⓘ still says "Now starts it straight away, once." **[minor]**
    Suggestion: use one label everywhere.
    Fix: The ⓘ now follows the label ("When I start it: it only runs when you press Run now").

---

**Total: 58 questions**
**In the core tasks: 41** (they block or slow down one of tasks 1–10). The other **17 are minor**: #5, 6, 15, 16, 20, 22, 23, 28, 30, 37, 38, 43, 50, 51, 55, 56, 58. Four of those (#16, 22, 23, 50) also touch a core task, but only lightly.

## Bugs (also in the list above)

- **"Reviewed ✓ Nothing to fix" while the review says "isn't ready to ship"** (#32). The badge contradicts the report.
- **The full log shows another run's log** (#31): the "Arcade dodge game" log is a "Review: pull request #12" run from 03:25.
- **"Change it" doesn't update the task, steps or review target** (#27). The reviewer checked the old goal.
- **The workflow result text points at buttons that aren't there** ("Look at it", "Try again") (#47).
- **The Helper covers buttons** at laptop width, and the bubble overlaps a link in the phone New task panel (#57).
- **The Helper misses what's on screen**: the open merge confirm (#40), the drafted workflow change (#49), and the ran-out-of-time runs (#53). It also contradicts the page (#36).
- **The goal was silently rewritten** after picking an idea in New workflow (#42).
- **Projects page**: an empty "Add it" does nothing; errors and success messages show off-screen at the top; an invalid name ("My Game!") reaches the confirm step (#12, #13).
- **The test server went down mid-session** (about 08:50; connection refused, with no error at the end of `.agentbox/dev/server.log`). I restarted it with `scripts/dev-copy.sh` (not `fresh`, so the data was kept) on port 3253. It may have been stopped from outside rather than crashing.
- No sideways scrolling at 390px on any page I checked.

## Real things created during this session

- **Pull requests opened (please close):**
  - https://github.com/NicB-coder-bot/arcade/pull/9 (task "Arcade dodge game", plan changed to a "Hello from Sam!" README line)
  - https://github.com/NicB-coder-bot/arcade/pull/10 (workflow "Small guessing game website", test run, "Sam was here." README line)
  - https://github.com/NicB-coder-bot/arcade/pull/11 (task "README hello note", README hello line)
- **New GitHub repo:** https://github.com/NicB-coder-bot/sam-hello-test (made with "Make a new repo"; public and empty, delete if not wanted). It was also added as a project in the test copy.
- Runs used: 2 task runs and 1 workflow test run, all on arcade. No merges were confirmed. No Settings or Discord changes.
