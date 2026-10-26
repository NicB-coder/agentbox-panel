# v3.1 progress

Plan: ONE-QUESTION.md. Built on the agent branch (not `build/v3.1`). Test on your own dev copy (see NOTES.md, not port 3100).

- [x] 1. Find why Lookout did nothing, add failure Inbox items
- [x] 2. Ask for the goal once, Run now without pop-up
- [x] 3. Briefs: attach, pick, copy into run, missing-file check
- [x] 4. Prompt coach with quick questions and idea help
- [x] 5. Easy workflow editing: in-words changes, duplicate, undo, history
- [x] 6. Clearer usage limit wording and Big job defaults
- [x] 7. Helper everywhere, replay bug fixed, personal and precise
- [x] 8. Full check of every button, page and real run
- [x] 9. Three or more fresh beginner review rounds as Sam (6 rounds: 58 → 64 → 58 → 50 → 50 → 37 questions; core 41 → 16)
- [ ] 10. Test migration on database copy, update notes, open PR

## Handoff (after milestone 9)

- Six fresh Sam review rounds are in `REVIEW-ROUND-1.md` … `REVIEW-ROUND-6.md`, each question with its fix (or why it
  was kept). Counts and decisions are in NOTES.md under "Milestone 9". No round reached zero core questions (16 left).
- Big renames: every button that puts a change in is "Put it in my project"; the workflow Ship step is now titled
  "Put it in" (the step type is still `ship` in data and code); a finished change is "Ready to look at".
- Needs Nic: delete NicB-coder-bot/sam-hello-test and `~/projects/sam-hello-test` if unwanted; arcade#13 added one
  README line ("Made with agentbox by Sam") in round 2, before Ship asked first.
- Each review used a test copy on port 3253 (`.agentbox/dev`), refreshed from the live database read-only before
  each round. dev-copy.sh fresh now also clears old test logs.

## Handoff (after milestone 8)

- `QA-CHECKLIST.md` is complete (every control ticked, 8 real end-to-end runs). Check scripts: `scripts/qa/sweep.mjs`,
  `click-all.mjs`, `tour.mjs`, `labels.mjs`, `e2e.mjs` (see the top of each for usage; `e2e.mjs` uses real Claude and
  opens real pull requests on PROJECT, default arcade: close them afterwards).
- New: Inbox kind `wf_done` (finished workflow run with an open pull request), column `workflow_runs.pr_waiting`
  (migration in lib/db.ts), cleared by `checkPullRequests()` when merged/closed or by the dismiss route. Quiet workflow
  items carry `prUrl` and show Look at it.
- `click-all.mjs` really changes the dev copy (pauses, turns workflows off, makes copies, adds ideas). Start a fresh
  copy before Sam's review rounds.
- Two dev copies were used: port 3253 (`.agentbox/dev`) for clicking, 3254 (`.agentbox/dev2`) for real runs, so a
  clicked Pause everything couldn't stop them. `scripts/dev-copy.sh fresh` still can't find the live database from a
  worktree: copy it read-only with `sqlite3 "file:$HOME/projects/agentbox-panel/data/agentbox.db?mode=ro" ".backup …"`.
- Next: milestone 9, the beginner review rounds as Sam.

## Handoff (after milestone 7)

- Replay fix: `useCalmReveal(id, text, writing)` in `components/helper/HelperMessageView.tsx` keeps typed length per
  message id in a module-level map. Send guard + `clientId` (deduped by `sentBefore()` in `lib/helper.ts`, looked up
  with `findByClientId()` in `lib/helperDb.ts`). Partial replies saved every second; `meta.cutOff` + `meta.resume`;
  `POST /api/helper/continue` → `continueReply()` carries on the same message.
- Follows everywhere: `components/helper/helperSpot.ts` finds the top modal `<dialog>`; `HelperBubble` portals into it
  and places the bubble where it covers no control. Non-modal panels mark themselves `data-helper-avoid` (StepPanel).
- Context: `useHelperContext(ctx | null, fill?)` in `helperStore.ts` is now a stack of layers; panels use `panels: [...]`,
  pages use `editing`, `fill` names the goal box. `[[fill:goal|…]]` → `fill_goal` action (`FillCard`, Use this).
  Suggestions: `GET /api/helper?only=suggestions&ctx=…`.
- Tests: `npm test` (83), `node scripts/helper-replay-test.mjs <url> [shots] [real]`, `node helper-eval/run.mjs <url> <db>`
  (35/35, uses real usage). Dev copy for this branch was port 3253 with `.agentbox/dev`.
- Next: milestone 8 (full check-over, QA-CHECKLIST.md).

## Handoff (after milestone 5)

- Server: `lib/change.ts` (`changeWorkflow`, `changePrompt`; reuses `SCHEMA` and `stepRules` now exported from
  `lib/draft.ts`) and client-safe `lib/changeView.ts` (`mergeChange`, `diffSteps`, `copyName`). Route
  `POST /api/workflows/[id]/change { text, def }` → `{ steps, limits, summary, before }`; never saves.
  `POST /api/workflows/[id]/duplicate` now takes `{ def }` (what's on screen).
- Client: `components/workflow/ChangeBox.tsx`, wired into WorkflowEditor.tsx above the Steps canvas. Apply and
  Restore save at once (`save(note, what, flash)`), Undo still works. Edit tools toolbar under the name. Live run
  view has an **Edit** button; editing while a run is active shows "changes apply to the next run".
- Helper: `[[change:WORKFLOW_ID|…]]` → action `change_workflow` → `/workflows/ID?run=0&change=…` (drafted, never
  applied). Milestone 7 may want this to work from the Helper on any page (it does: it navigates).
- Tests: `tests/change.test.ts` (72 passing in total). Browser check: `.agentbox/qa/change.mjs` (not committed;
  add `real` for real Claude at laptop width). It sets tourDone first via /api/settings if the DB is fresh.
- The dev-copy script copies `data/agentbox.db` from the folder it runs in; an agent worktree has none, so I made a
  fresh seeded DB in `.agentbox/dev/data` instead of reading the live one.

## Handoff (after milestone 4)

- Server: `lib/coach.ts` (check / improve / ideas prompts, `cleanCheck`, `cleanSuggestions`, `looksDetailed`),
  `/api/coach` (`{ step, goal, where: workflow|build|research, brief: {name,hash}, answers, interests, current }`;
  answers `{ skip }` when paused or out of usage). Shared Claude call: `lib/claudeJson.ts` (draft.ts uses it too).
- Client: `components/Coach.tsx` (`CoachBox`, `IdeaHelp`, `SUGGESTION_LABEL`). Wired into `next()` in
  NewWorkflow.tsx and TaskPanel.tsx (`coached` flag = coach already ran; Start/Next hidden while it's open).
  `openTaskPanel({ task, coach: true })` / `{ ideas: true }` open the panel coaching / with idea help.
- Helper: `[[coach:new|…]]` → action `coach_goal`; `[[button:idea_help:x|…]]` → `idea_help` (helper.ts, guide text,
  HelperMessageView). Milestone 7 should make these fill the form that's open (e.g. the new workflow screen)
  instead of always opening Start a task.
- Milestone 5 (edit in words) can reuse `claudeJson` for its before → after draft.
- Tests: `tests/coach.test.ts` (65 passing in total). Browser check: `.agentbox/qa/coach.mjs` (not committed;
  `node coach.mjs <shots dir> real` uses real Claude at laptop width, canned replies otherwise; it fakes /api/tasks).

## Handoff (after milestone 3)

- One brief picker everywhere: `components/BriefPicker.tsx` (upload, drag, pick from project, chip with View/Remove,
  "This project has a brief ✓", plus `MissingFileBox` and `TextViewer`). Used in NewWorkflow, WorkflowEditor (under
  the goal box) and TaskPanel.
- Server side: `lib/briefs.ts` (store by hash, `placeBrief` into the run's copy as CLAUDE.md/BRIEF.md, `addAllArgs`
  keeps it out of the panel's commits, `missingFile` check, `projectBrief`). A workflow's brief is `steps[0].brief`
  (`BriefRef`: name, lines, hash). APIs: `/api/briefs`, `/api/briefs/<hash>`, `/api/projects/<name>/briefs?root=1`,
  `/api/agents/<id>/brief`.
- Missing files: workflow run API and tasks API answer 409 with `{ error, missing }`; `missingOf(e)` reads it on the
  client (`post()` in bits.tsx now attaches the reply as `e.data`). `MissingFileError` in workflowRunner.ts.
- Projects → Add a file: `lib/projectFiles.ts` (table `file_prs`), `/api/projects/<name>/files`,
  `/api/file-prs/<id>/merge|close`; Inbox kind `file_pr`.
- Milestone 4's prompt coach: an attached brief should count as "detailed" (skip the questions), and treat the
  brief text as data. The brief is in `brief` state in NewWorkflow.tsx and TaskPanel.tsx; text via `/api/briefs/<hash>`.
- Tests: `tests/briefs.test.ts` (59 passing in total). Browser check: `.agentbox/qa/briefs.mjs` (not committed;
  it only lets run requests through when the goal names a file that doesn't exist).

## Handoff (after milestone 2)

- New start screen: `components/NewWorkflow.tsx` (goal, project, step row, "Change the steps"). Default steps come
  from `defaultWorkflow()` in lib/wf.ts; names from `nameFromGoal()`. `/api/workflows/draft` takes `preview: true`
  (returns steps, makes nothing) and `goal` (context only, see `draftPrompt` in lib/draft.ts).
- Milestone 3 should add **Attach a brief (optional)** to the start screen under the goal box (left out on purpose).
- Milestone 4 (prompt coach) hooks into the start screen's **Next** button (`make()` in NewWorkflow.tsx).
- Run now/Test run: `runNow()` in WorkflowEditor.tsx; the "different goal" box is `GoalDialog`. The API takes
  `goal` (one run only) via `StartWfOpts.goal` → `stepsWithGoal()`.
- Tests: `tests/askonce.test.ts` added; `npm test` = 45 passing. Browser check script used: `.agentbox/qa/askonce.mjs`
  (not committed; it mocks the run request so no real run starts).

## Handoff (after milestone 1)

- Cause and fixes are in NOTES.md under "Why Lookout did nothing".
- Workflow runs: `wr.input` now holds ONLY what was typed for that run; the goal is `wr.steps[0].task`. Use
  `runTaskText(goal, input)` (lib/wf.ts) whenever you build what an agent is told. Milestone 2 removes the Run now
  pop-up, so `input` will usually be empty.
- New: `lib/quiet.ts` (when a finished run counts as "didn't do anything"), column `workflow_runs.quiet`
  (added by the migration in lib/db.ts), `RunExtra.quiet` / `RunExtra.quick`, Inbox kind `quiet`.
- Steps can end with `STUCK: <why>` to stop the workflow (workflowRunner `onStepRunEnded`).
- "What it was told" on the workflow run view should also show the brief name once milestone 3 adds briefs.
- Tests: `tests/v31.test.ts`. `npm test` = 39 passing.
