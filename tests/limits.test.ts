// v3.1 milestone 6: clear limits and Big job defaults. Run with: npm test
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "agentbox-limits-test-"));
process.env.HOME = home;
process.env.AGENTBOX_DATA_DIR = path.join(home, "data");
fs.mkdirSync(process.env.AGENTBOX_DATA_DIR, { recursive: true });

const job = await import("../lib/job");
const db = await import("../lib/db");
const { countUsageWait } = await import("../lib/workflowRunner");
import type { WfStep } from "../lib/types";

describe("Big job defaults", () => {
  test("a new Big job may use about 75% of the week", () => {
    assert.equal(job.DEFAULT_JOB.budgetPct, 75);
    assert.equal(job.jobOf({ big: true }).budgetPct, 75);
  });

  test("a Big job someone already saved keeps its own budget", () => {
    assert.equal(job.jobOf({ big: true, budgetPct: 40 }).budgetPct, 40);
  });

  test("the words say what's measured and what happens", () => {
    assert.match(job.BIG_USAGE_TIP, /This week/);
    assert.match(job.BIG_USAGE_TIP, /weekly reset/);
    assert.match(job.BIG_USAGE_TIP, /Raise the budget/);
    assert.match(job.BIG_TIME_NOTE, /no time limit/);
    assert.match(job.WF_USAGE_TIP, /This session/);
    assert.match(job.WF_USAGE_TIP, /across resets/);
    assert.match(job.WF_USAGE_TIP, /Pick up where it stopped/);
  });
});

describe("Longest run doesn't count waiting for usage", () => {
  const steps: WfStep[] = [
    { id: "s0", type: "start", trigger: "manual", task: "Build it" },
    { id: "s1", type: "agent", agentId: null, prompt: "Build it" },
  ];
  const wf = db.createWorkflow({ name: "Waits", project: "lookout", steps, limits: { maxLoops: 2, maxMinutes: 60, maxUsagePct: 50 } }, "test");

  test("time spent waiting for usage is added to the waiting time", () => {
    const wr = db.createWfRun({ workflowId: wf.id, status: "running", test: false, input: "", trigger: "manual", triggerRef: null, steps, stepRuns: {} });
    db.updateWfRun(wr.id, { current: 1, waiting: { kind: "usage", text: "Waiting for usage to reset", until: Date.now() } });
    const t0 = 1_000_000;
    countUsageWait(db.getWfRun(wr.id)!, t0);
    const after = countUsageWait(db.getWfRun(wr.id)!, t0 + 3 * 3600_000);
    assert.equal(after.waitedMs, 3 * 3600_000);
    assert.equal(db.getWfRun(wr.id)!.waitedMs, 3 * 3600_000);
  });

  test("normal working time still counts", () => {
    const wr = db.createWfRun({ workflowId: wf.id, status: "running", test: false, input: "", trigger: "manual", triggerRef: null, steps, stepRuns: {} });
    db.updateWfRun(wr.id, { current: 1 });
    countUsageWait(db.getWfRun(wr.id)!, 1_000_000);
    const after = countUsageWait(db.getWfRun(wr.id)!, 1_000_000 + 3600_000);
    assert.equal(after.waitedMs, 0);
  });
});
