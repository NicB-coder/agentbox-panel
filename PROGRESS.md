# v3.1 progress

Plan: ONE-QUESTION.md. Built on the agent branch (not `build/v3.1`). Test on your own dev copy (see NOTES.md, not port 3100).

- [x] 1. Find why Lookout did nothing, add failure Inbox items
- [x] 2. Ask for the goal once, Run now without pop-up
- [x] 3. Briefs: attach, pick, copy into run, missing-file check
- [ ] 4. Prompt coach with quick questions and idea help
- [ ] 5. Easy workflow editing: in-words changes, duplicate, undo, history
- [ ] 6. Clearer usage limit wording and Big job defaults
- [ ] 7. Helper everywhere, replay bug fixed, personal and precise
- [ ] 8. Full check of every button, page and real run
- [ ] 9. Three or more fresh beginner review rounds as Sam
- [ ] 10. Test migration on database copy, update notes, open PR

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
