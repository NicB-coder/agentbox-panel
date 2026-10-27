# Helper test set: 35 of 35 pass

Run 10/25/2026, 3:14:55 AM against http://127.0.0.1:3253. Facts read from the dev copy: session 46% used, Inbox 0, running: nothing, heartbeat 4 of 4.

## ✓ running · /
**Nic:** What's running?

**Helper** (37 words, 3s): Nothing is running right now. Arcade site finished its last run, Builder is done, and the Build → Review → Ship run was stopped. Overnight is paused and Site Checker is switched off. Nothing in the Inbox needs you.
Buttons: Set up this task

## ✓ needs-me · /
**Nic:** What needs me right now?

**Helper** (36 words, 3s): Nothing needs you right now. Your Inbox is empty, and no agent is waiting on an OK. ⏎ Two things are off if you want them back on: Overnight is paused, and Site Checker is switched off.
Buttons: Open the Inbox

## ✓ usage-left · /
**Nic:** How much usage is left?

**Helper** (62 words, 3s): This session is at 46% used, so about 54% is left. It resets today at 8:00 AM. This week is only at 4% used, and it resets Sun, Nov 1 at 2:00 AM. ⏎ All of today's usage so far is from my own replies (115 of them). You have no usage limit set, so agents only wait if usage runs completely out.

## ✓ usage-reset · /
**Nic:** When does my usage reset?

**Helper** (30 words, 3s): Your session (the 5-hour window) resets today at 8:00 AM, and it's at 46% used. Your weekly meter resets Sunday, Nov 1 at 2:00 AM, and it's at 4% used.

## ✓ heartbeat · /
**Nic:** Is the heartbeat checking in on time today?

**Helper** (35 words, 3s): Yes. Heartbeat is switched on and has checked in on time 4 of 4 times today. The last check-in was at 3:00 AM (14 min ago): "Alive and running. Today is Sunday, October 25, 2026."

## ✓ count-workflows · /
**Nic:** How many workflows do I have?

**Helper** (22 words, 3s): You have 4 workflows. 3 are switched on: Build → Review → Ship, Background Lookout Builder and Calorie Tracker App. Research report is off.
Buttons: Open Workflows

## ✓ workflows-on · /
**Nic:** Which of my workflows are switched on?

**Helper** (32 words, 3s): Three workflows are On: ⏎ - Build → Review → Ship (lookout): last ran 28 hours ago and was stopped. ⏎ - Background Lookout Builder (lookout): never run. ⏎ - Calorie Tracker App (agentbox-panel): never run. ⏎ Research report is Off.

## ✓ last-wf-run · /
**Nic:** How did my last workflow run go?

**Helper** (77 words, 3s): Your last run of Build → Review → Ship (Follow the details…) was **stopped**. You stopped it at the Ask me step. ⏎ Research, Builder and both Reviews passed, but only because the task details were missing. They just left notes saying so, and no real thing was built. The Check was skipped because the project has no tests. ⏎ The run before that, the arcade site, shipped fine. ⏎ Next time, fill in what the workflow should make, then try again.
Buttons: Start a test run

## ✓ reviewer-stop · /
**Nic:** Why did the Reviewer stop last time?

**Helper** (66 words, 8s): The Reviewer didn't stop. Its last run, on Wed, Oct 21 at 11:06 PM, finished with status Done. It found #10 and the other two open pull requests already had full review comments and no new changes, so it added nothing new. ⏎ You may be thinking of the Build → Review → Ship run, which did stop. It stopped because "You stopped it." at the Ask me step.
Buttons: Open Reviewer

## ✓ projects · /projects
**Nic:** What projects do I have?

**Helper** (54 words, 4s): You have three projects: ⏎ - **agentbox-panel**: one open draft pull request, pull request #12 ("Arcade site (in progress)"). Its last change was "Add files via upload". ⏎ - **arcade**: no open pull requests. You can play it from here. ⏎ - **lookout**: one open draft pull request, pull request #1. It's the notes saying the task details were missing.

## ✓ lookout-stop · /workflows/1
**Nic:** Why did Lookout stop?

**Helper** (66 words, 4s): Your Build → Review → Ship workflow, which works on the lookout project, stopped at its **Ask me** step. The reason it shows is "You stopped it." ⏎ The task never said what to make: the goal was "What should this workflow make?" and nothing was filled in. The builder only added notes saying so. Add the real goal in the box on this page and run it again.
Buttons: Start a test run

## ✓ wf-what · /workflows/1
**Nic:** What does this workflow do?

**Helper** (59 words, 4s): Build → Review → Ship takes a task, builds it in the lookout project, and ships it to main after you say yes. ⏎ Research → Builder → Review → Review → Check → Ask me → Ship → Tell me ⏎ Its last run (Follow the details…) stopped on Fri, Oct 23 at Ask me because "You stopped it." The task details were missing, so it only added notes.

## ✓ wf-pr · /workflows/1
**Nic:** Where's the pull request from its last run?

**Helper** (67 words, 6s): It's pull request #1 in lookout. It's still open as a draft and can be merged. It only adds two notes saying the task details were missing, so there's nothing real to ship. The run, Build → Review → Ship, stopped at Ask me because you stopped it. ⏎ To get something real, fill in the "What do you want to make?" box on this workflow and run it again.
Buttons: Open Build → Review → Ship

## ✓ wf-change · /workflows/1
**Nic:** Add a step that tests it on a phone

**Helper** (40 words, 5s): I'll add a look-only step after the two reviews, before the tests. It opens the page in a real browser at phone width and reports what's broken, such as buttons that are too small or content that is cut off.
Buttons: Draft this change to Build → Review → Ship

## ✓ wf-step · /workflows/1
**Nic:** What does this step do?

**Helper** (64 words, 3s): A Review step is a reviewer that checks the work against the task and the research. It either passes it or says it needs work. ⏎ In your Build → Review → Ship workflow, if it needs work, the work goes back to Builder (up to twice). There are two Review steps in a row, so the work gets checked twice. In the last run, both passed.

## ✓ agent-doing · /agents/12
**Nic:** What is this agent doing?

**Helper** (79 words, 5s): Nothing right now. Arcade site is **Done**. Its last run made the usage limits clearer, greyed out the time limit for Big jobs, set new Big jobs to about 75%, and fixed a bug where waiting for usage counted against a workflow's time limit. ⏎ The step list still shows "Helper everywhere…" as the current step. The last five steps, from the full check through to sending the pull request, never got ticked. Its pull request is pull request #12.
Buttons: Set up a follow-up for Arcade site

## ✓ freedom · /
**Nic:** What does Freedom mean?

**Helper** (55 words, 3s): Freedom is how much an agent may do on its own. ⏎ - **Look only:** It reads and reports back. It never changes anything. ⏎ - **Check with me first:** It writes a short plan and waits for your OK. ⏎ - **On its own:** It works by itself. A safety checker approves each step, and you get a pull request.

## ✓ careful · /
**Nic:** What does Careful mean?

**Helper** (73 words, 4s): Careful is the "How thorough?" setting on a task, and it's the default. ⏎ - **Careful:** after it builds, a second AI reviews the work. It fixes what it finds (up to 2 rounds), polishes, then does a final check before anything reaches your Inbox. ⏎ - **Quick:** it just does the job. A reviewer still reads the pull request and lists what it finds. ⏎ Careful takes longer but catches more. Quick is good for small changes.

## ✓ pr-word · /inbox
**Nic:** What is a pull request?

**Helper** (70 words, 3s): A pull request is a proposed change to a project. An agent does its work on a separate copy, then sends it as a pull request so you can look it over first. Nothing touches your real project (called "main") until you press Merge it. ⏎ Your Inbox has nothing waiting right now. Next time one shows up, press Look at it to see what changed, with before and after pictures.

## ✓ howto-workflow · /workflows
**Nic:** How do I make a workflow?

**Helper** (48 words, 3s): 1. Open New workflow. ⏎ 2. Type what you want to make, pick a project. ⏎ 3. Optional: attach a brief. ⏎ 4. Leave the steps as they are, or press "Change the steps". ⏎ 5. Press Next and answer the coach's quick questions. ⏎ 6. Check the editor, then press Test run.
Buttons: Open New workflow

## ✓ usage-guard · /settings
**Nic:** What does the usage limit setting do right now?

**Helper** (56 words, 3s): Right now it does nothing extra. No usage limit is set, so new runs only wait when your usage is completely out. ⏎ Your session is at 50% (resets 8:00 AM) and your week is at 4%. If you set a limit, new runs would wait once usage reached it. Runs that are already going carry on.
Buttons: Open Settings

## ✓ panel-detailed · Start a task panel
**Nic:** Is my goal detailed enough?

**Helper** (45 words, 5s): No, "make a game" is too short. It doesn't say what kind of game, who it's for, or what "done" looks like. I wrote a fuller version for the agentbox-panel project: ⏎ If you'd rather pick the game yourself, I can help you think of ideas.
Buttons: Use this · Help me think of ideas

## ✓ panel-better · Start a task panel
**Nic:** Make my goal better

**Helper** (55 words, 7s): I made it specific: one simple game that runs in the browser, with clear controls and a clear finish. I picked a snake game as a placeholder, so change it if you want something else. ⏎ Your project is set to agentbox-panel, which is the panel itself. A game would fit better in your **arcade** project.
Buttons: Use this

## ✓ panel-settings · Start a task panel
**Nic:** Which settings should I pick?

**Helper** (95 words, 7s): Your goal is the weak spot: "make a game" is too vague, and the project is **agentbox-panel**, which is the panel itself. If the game is for your arcade, switch the project to **arcade**. ⏎ - **Freedom: On its own** is fine. You still get a pull request to check before anything changes. ⏎ - **Careful** is right. A second AI reviews the game before you see it. ⏎ - **Model:** switch to Smartest. Games have more tricky parts than Fast handles well. ⏎ - **Time limit:** 60 min is OK for one small game. Raise it if you want a bigger one.
Buttons: Improve it with the coach · Help me think of ideas

## ✓ panel-freedom · Start a task panel
**Nic:** What does Freedom mean?

**Helper** (83 words, 3s): Freedom is how much your agent may do on its own. ⏎ - **Look only:** it reads and reports back. It never changes anything. ⏎ - **Check with me first:** it writes a short plan and waits for your OK. ⏎ - **On its own:** it works by itself. A safety checker approves each step, and you get the result as a pull request. ⏎ Right now it's set to **On its own**. Your goal says just "make a game", so the agent will have to guess what to build.
Buttons: Improve it with the coach

## ✓ newwf-detailed · /workflows/new
**Nic:** Is my goal detailed enough?

**Helper** (51 words, 5s): Not yet. "a website" doesn't say what the site is for, who it's for, or what done looks like. Your last Build → Review → Ship run on lookout only wrote notes because the task details were missing. ⏎ Tell me what the site is about, or press this and answer 2–4 quick questions:
Buttons: Improve it with the coach · Help me think of ideas

## ✓ start-task · /
**Nic:** Start a task that fixes the footer on the agentbox panel

**Helper** (27 words, 3s): Here's a task ready for your agentbox-panel project. Your goal is short, so the coach will ask a few quick questions about what's wrong with the footer.
Buttons: Improve it with the coach

## ✓ no-idea · /
**Nic:** I don't know what to build

**Helper** (27 words, 2s): Totally fine. Pick what you're into and I'll suggest ideas sized for one overnight run. Your Inbox ideas list is empty, so this is a fresh start.
Buttons: Help me think of ideas

## ✓ pause · /
**Nic:** Pause everything

**Helper** (30 words, 3s): Nothing is running right now, but this will hold every schedule, including your Overnight job at 3:00 AM. It also stops anything that's running. It asks "Are you sure?" first.
Buttons: Pause everything

## ✓ nightly-agent · /
**Nic:** Make me an agent that checks my lookout site every night and tells me what's broken

**Helper** (43 words, 5s): Here's a nightly checker for your lookout project. It only looks and never changes anything. It messages you when it finds a problem. ⏎ Heads up: your lookout project is nearly empty right now, so the checker may have little to look at yet.

## ✓ ghost-agent · /
**Nic:** Why did my Weather Bot agent stop?

**Helper** (48 words, 7s): I can't find an agent called Weather Bot. Your agents are Builder, Reviewer, Site Checker, Overnight, Arcade site and Heartbeat. ⏎ The only thing that stopped recently is the Build → Review → Ship run, which was stopped at "Ask me" with "You stopped it." Is that the one you mean?
Buttons: Open Agents

## ✓ ghost-workflow · /
**Nic:** Run my Pizza Tracker workflow

**Helper** (33 words, 3s): I can't find a workflow called Pizza Tracker. Your workflows are Build → Review → Ship, Research report, Background Lookout Builder and Calorie Tracker App. ⏎ Want me to set up a Pizza Tracker task instead?
Buttons: Set up this task · Open New workflow

## ✓ offtopic-capital · /
**Nic:** What's the capital of France?

**Helper** (15 words, 3s): Paris. ⏎ Nothing needs you right now. Want me to turn an idea into a task?
Buttons: Set up this task

## ✓ offtopic-essay · /
**Nic:** Write me a 500-word essay about World War 2

**Helper** (44 words, 3s): I can't write essays here, since I'm just your agentbox helper. If it's for school, that's one to write yourself. ⏎ If you'd like an agent to research World War 2 and give you a sourced report to learn from, I can set that up:
Buttons: Set up this task

## ✓ offtopic-weather · /
**Nic:** What's the weather like today?

**Helper** (37 words, 3s): I can't see the weather. That's not something agentbox tracks, so a weather app will tell you faster. ⏎ Nothing needs you right now, and it's 3:14 AM. Want me to turn something into a task for tonight?
Buttons: Set up this task
