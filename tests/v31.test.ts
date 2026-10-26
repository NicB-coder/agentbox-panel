// v3.1: the Lookout "did nothing" fix and no-silent-failure Inbox items. Run with: npm test
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentbox-v31-test-"));
process.env.AGENTBOX_DATA_DIR = tmp;

const wf = await import("../lib/wf");
const quiet = await import("../lib/quiet");
const db = await import("../lib/db");
const { inboxItems } = await import("../lib/inbox");
const { context } = await import("../lib/workflowRunner");
import type { WfStep, WorkflowRun } from "../lib/types";

const LOOKOUT_GOAL = "# Lookout — v0.1 beta\n\nAn app that watches the web and pings you." + " More detail.".repeat(1000); // ~13,000 characters
const steps = (task: string): WfStep[] => [
  { id: "s0", type: "start", trigger: "manual", task },
  { id: "s1", type: "agent", prompt: "Build it", agentId: null, freedom: "auto" },
  { id: "s2", type: "ship", shipMode: "ask" },
];

describe("what a workflow run's agents are told (the Lookout bug)", () => {
  test("a line typed for this run is added to the saved goal, never instead of it", () => {
    const told = wf.runTaskText(LOOKOUT_GOAL, 'Follow the details under: "What should this workflow make?"');
    assert.ok(told.includes(LOOKOUT_GOAL), "the whole saved goal reaches the agents");
    assert.ok(told.includes("For this run, Nic adds:\nFollow the details under"));
  });
  test("the goal alone, the typed line alone, the same text once, or nothing", () => {
    assert.equal(wf.runTaskText("Make a game", ""), "The task for this run:\nMake a game");
    assert.equal(wf.runTaskText("", "Fix the menu"), "The task for this run:\nFix the menu");
    assert.equal(wf.runTaskText("Make a game", "Make a game"), "The task for this run:\nMake a game");
    assert.match(wf.runTaskText("", ""), /no extra task/);
  });
  test("each step's prompt has the goal and a way to say it's stuck", () => {
    const wr = { input: "Follow the details", steps: steps(LOOKOUT_GOAL), prUrl: null, feedback: null } as unknown as WorkflowRun;
    const w = { name: "Build → Review → Ship", steps: steps(LOOKOUT_GOAL), limits: wf.DEFAULT_LIMITS } as never;
    const told = context(wr, w, steps(LOOKOUT_GOAL)[1]);
    assert.ok(told.includes(LOOKOUT_GOAL));
    assert.match(told, /STUCK:/);
  });
  test("long goals are kept whole, and too-long ones are refused out loud", () => {
    const kept = wf.cleanSteps(steps(LOOKOUT_GOAL), []);
    assert.equal(kept[0].task, LOOKOUT_GOAL);
    assert.equal(wf.goalTooLong(steps(LOOKOUT_GOAL)), null);
    assert.match(wf.goalTooLong(steps("x".repeat(wf.GOAL_MAX + 1))) ?? "", /too long/);
    assert.ok(wf.workflowProblems({ name: "x", project: "p", steps: steps("x".repeat(wf.GOAL_MAX + 1)), limits: wf.DEFAULT_LIMITS }, [], ["p"]).some((p) => /too long/.test(p)));
  });
});

describe("when a finished run counts as 'didn't do anything'", () => {
  test("task runs", () => {
    assert.ok(quiet.quietTaskRun({ changed: false }));
    assert.equal(quiet.quietTaskRun({ changed: true }), null);
    assert.ok(quiet.quietLookRun({ report: "  " }));
    assert.equal(quiet.quietLookRun({ report: "All good." }), null);
  });
  test("workflow runs: no pull request, or under 2 minutes", () => {
    const base = { steps: steps("x"), startedAt: 0, waitedMs: 0 };
    const makes = quiet.workflowMakesChanges(base.steps);
    assert.ok(makes);
    assert.match(quiet.quietWfRun({ ...base, prUrl: null }, { makesChanges: makes, now: 10 * 60_000 })!.why, /without changing anything/);
    assert.match(quiet.quietWfRun({ ...base, prUrl: "https://x/pr/1" }, { makesChanges: makes, now: 60_000 })!.why, /under 2 minutes/);
    assert.equal(quiet.quietWfRun({ ...base, prUrl: "https://x/pr/1" }, { makesChanges: makes, now: 10 * 60_000 }), null);
    // Time spent waiting for Nic doesn't count as work.
    assert.ok(quiet.quietWfRun({ ...base, prUrl: "https://x/pr/1", waitedMs: 9 * 60_000 }, { makesChanges: makes, now: 10 * 60_000 }));
  });
  test("Look only workflows just report, so they're never flagged", () => {
    const look: WfStep[] = [{ id: "s0", type: "start", trigger: "manual" }, { id: "s1", type: "agent", agentId: 7, freedom: "auto" }, { id: "s2", type: "tell", tellWhen: "always" }];
    assert.equal(quiet.workflowMakesChanges(look, new Set([7])), false);
    assert.equal(quiet.workflowMakesChanges([look[0], { id: "s1", type: "agent", agentId: null, freedom: "look", prompt: "Check it" }]), false);
  });
});

describe("the Inbox never stays silent", () => {
  test("a quiet task run and a quiet workflow run each get an item, until dismissed", () => {
    const agent = db.listAgents().find((a) => a.kind === "claude")!;
    const run = db.createRun({ agentId: agent.id, task: "Make a game", mode: "auto", trigger: "manual", steps: [], extra: { quiet: quiet.quietTaskRun({ changed: false })! } });
    db.updateRun(run.id, { status: "done", result: "The task was unclear, so I changed nothing.", endedAt: Date.now() });

    const w = db.createWorkflow({ name: "Lookout builder", project: "lookout", steps: steps(LOOKOUT_GOAL), limits: wf.DEFAULT_LIMITS }, "First");
    const wr = db.createWfRun({ workflowId: w.id, status: "running", test: false, input: "", trigger: "manual", triggerRef: null, steps: w.steps, stepRuns: {} });
    db.updateWfRun(wr.id, { status: "done", endedAt: Date.now(), quiet: quiet.quietWfRun({ ...wr, prUrl: null }, { makesChanges: true })! });

    const items = inboxItems().filter((i) => i.kind === "quiet");
    const t = items.find((i) => i.kind === "quiet" && i.runId === run.id);
    const f = items.find((i) => i.kind === "quiet" && i.wfRunId === wr.id);
    assert.ok(t && t.kind === "quiet" && /without changing anything/.test(t.text) && t.said === "The task was unclear, so I changed nothing." && t.next.length > 0);
    assert.ok(f && f.kind === "quiet" && f.title === "Lookout builder" && /no pull request/.test(f.text));

    db.dismissRun(run.id);
    db.updateWfRun(wr.id, { quiet: null });
    assert.equal(inboxItems().filter((i) => i.kind === "quiet").length, 0);
  });
});

describe("a workflow that finishes with a pull request lands in the Inbox", () => {
  test("it shows as Finished with its pull request, until dismissed; quiet or merged runs don't", async () => {
    const w = db.createWorkflow({ name: "Joke page", project: "arcade", steps: steps("Make a joke page"), limits: wf.DEFAULT_LIMITS }, "First");
    const wr = db.createWfRun({ workflowId: w.id, status: "running", test: true, input: "", trigger: "test", triggerRef: null, steps: w.steps, stepRuns: {} });
    db.updateWfRun(wr.id, { status: "done", endedAt: Date.now(), prUrl: "https://github.com/x/arcade/pull/9", summary: "Test run finished. It stopped before shipping.", prWaiting: true });
    const quietOne = db.createWfRun({ workflowId: w.id, status: "running", test: false, input: "", trigger: "manual", triggerRef: null, steps: w.steps, stepRuns: {} });
    db.updateWfRun(quietOne.id, { status: "done", endedAt: Date.now(), prWaiting: false });

    const done = inboxItems().filter((i) => i.kind === "wf_done");
    assert.equal(done.length, 1);
    const it = done[0];
    assert.ok(it.kind === "wf_done" && it.wfRunId === wr.id && it.test && it.prUrl.endsWith("/pull/9") && /stopped before shipping/.test(it.text));

    const { POST } = await import("../app/api/workflow-runs/[id]/dismiss/route");
    await POST(new Request("http://x"), { params: Promise.resolve({ id: String(wr.id) }) });
    assert.equal(inboxItems().filter((i) => i.kind === "wf_done").length, 0);
    assert.equal(db.getWfRun(wr.id)!.status, "done");
  });
});

describe("drafted steps are tidied for beginners", () => {
  test("two build steps in a row become one, and an Ask right before a Ship that asks is dropped", async () => {
    const { tidySteps } = await import("../lib/draft");
    const steps = tidySteps([
      { id: "s0", type: "start", trigger: "manual", task: "" },
      { id: "s1", type: "agent", agentId: null, prompt: "Build it" },
      { id: "s2", type: "agent", agentId: null, prompt: "Build it again" },
      { id: "s3", type: "check", checks: ["page"], onFail: "s2" },
      { id: "s4", type: "ask", question: "Ship it?" },
      { id: "s5", type: "ship", shipMode: "ask" },
    ] as WfStep[]);
    assert.deepEqual(steps.map((s) => s.id), ["s0", "s1", "s3", "s5"]);
    assert.equal(steps[2].onFail, "s1");
  });
});
