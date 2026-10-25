// Fast checks for v3 pieces that don't need Claude or a running panel. Run with: npm test
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentbox-v3-test-"));
process.env.AGENTBOX_DATA_DIR = tmp;

const job = await import("../lib/job");
const { readNew } = await import("../lib/proc");
const { carefulLine } = await import("../lib/runner");
const { parseTaskInput } = await import("../lib/tasks");

describe("job names", () => {
  test("named after the job, not the verb", () => {
    assert.equal(job.jobName("Make an arcade website with 4 games"), "Arcade website");
    assert.equal(job.jobName("Fix the helper replies"), "Helper replies fixes");
    assert.match(job.jobName("What are the best free hosts for a portfolio?", "research"), /research/i);
    assert.equal(job.jobName("Add a short comment at the top of index.html"), "Short comment");
    assert.equal(job.jobName(""), "New task");
  });
});

describe("Freedom", () => {
  test("maps to the runner's settings and back", () => {
    for (const f of ["look", "check", "auto"] as const) assert.equal(job.freedomOf(job.modeFor(f, false)), f);
    assert.deepEqual(job.modeFor("auto", true), { mode: "ask", allowed: "suggest" });
    assert.deepEqual(job.modeFor("look", true), { mode: "look", allowed: "look" });
  });
  test("sensible default time limits", () => {
    assert.equal(job.defaultMinutes("research", true, "look"), 60);
    assert.ok(job.defaultMinutes("build", true, "auto") > job.defaultMinutes("build", false, "auto"));
  });
});

describe("the Start a task panel's input", () => {
  test("rejects a missing task and keeps big-job options in range", () => {
    assert.equal(parseTaskInput({ task: "", project: "x" }, ["x"]).ok, false);
    const big = parseTaskInput({ task: "Build it all", project: "x", big: true, budgetPct: 30 }, ["x"]);
    assert.ok(big.ok && big.t.big && big.t.budgetPct === 30 && big.t.maxMinutes === 240);
    assert.equal(parseTaskInput({ task: "Build it all", project: "x", big: true, budgetPct: 500 }, ["x"]).ok, false);
    const research = parseTaskInput({ kind: "research", task: "Why is the sky blue?", project: "" }, ["x"]);
    assert.ok(research.ok && research.t.freedom === "look" && research.t.model === "opus");
    // "Install when finished" only for big jobs on the panel itself.
    const inst = parseTaskInput({ task: "Change things", project: "x", big: true, autoInstall: true }, ["x"]);
    assert.ok(inst.ok && !inst.t.autoInstall);
  });
});

describe("Careful mode", () => {
  test("the Inbox line", () => {
    const base = { careful: true, stage: "final" as const, round: 1, fixes: 2, polished: true, workSession: null };
    assert.equal(carefulLine({ ...base, reviews: [{ kind: "final", verdict: "passed", text: "", at: 0, model: "opus" }] }), "Reviewed ✓ · 2 fixes made · optimized");
    assert.equal(carefulLine({ ...base, reviews: [] }), null);
    assert.equal(carefulLine(undefined), null);
  });
});

describe("reading a session's output after a restart", () => {
  test("only whole lines, and picks up from the saved offset", () => {
    const f = path.join(tmp, "out.jsonl");
    fs.writeFileSync(f, '{"a":1}\n{"b":2}\n{"c"');
    const first = readNew(f, 0);
    assert.deepEqual(first.lines, ['{"a":1}', '{"b":2}']);
    fs.appendFileSync(f, ':3}\n');
    const second = readNew(f, first.offset);
    assert.deepEqual(second.lines, ['{"c":3}']);
    assert.deepEqual(readNew(f, second.offset).lines, []);
  });
});
