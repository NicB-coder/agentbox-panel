# v3.1 progress

Plan: ONE-QUESTION.md. Built on the agent branch (not `build/v3.1`). Test on your own dev copy (see NOTES.md, not port 3100).

- [x] 1. Find why Lookout did nothing, add failure Inbox items
- [ ] 2. Ask for the goal once, Run now without pop-up
- [ ] 3. Briefs: attach, pick, copy into run, missing-file check
- [ ] 4. Prompt coach with quick questions and idea help
- [ ] 5. Easy workflow editing: in-words changes, duplicate, undo, history
- [ ] 6. Clearer usage limit wording and Big job defaults
- [ ] 7. Helper everywhere, replay bug fixed, personal and precise
- [ ] 8. Full check of every button, page and real run
- [ ] 9. Three or more fresh beginner review rounds as Sam
- [ ] 10. Test migration on database copy, update notes, open PR

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
