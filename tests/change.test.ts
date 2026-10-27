// v3.1 milestone 5: change a workflow in your own words, make a copy, version history. Run with: npm test
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentbox-change-test-"));
process.env.AGENTBOX_DATA_DIR = tmp;
process.env.AGENTBOX_HELPER_SECRET = "";

const dbm = await import("../lib/db");
const cv = await import("../lib/changeView");
const change = await import("../lib/change");
const helper = await import("../lib/helper");
const wf = await import("../lib/wf");

const brief = { hash: "a".repeat(64), name: "CLAUDE.md", lines: 142, bytes: 4000 };
const def = () => {
  const d = wf.defaultWorkflow("An arcade website with 4 small games", "arcade");
  d.steps[0].brief = brief as never;
  return d;
};

describe("change it in your own words", () => {
  test("kept steps stay exactly as they were, and the goal and brief always stay Nic's", () => {
    const before = def();
    const build = before.steps.find((s) => s.type === "agent")!;
    build.connectors = ["figma"];
    // Claude sends the steps back, leaves out fields it doesn't know about, and tries to change the goal.
    const raw = {
      steps: [
        { id: before.steps[0].id, type: "start", trigger: "manual", task: "something else" },
        { id: build.id, type: "agent", agentId: null, prompt: build.prompt },
        { id: "n1", type: "check", checks: ["page"], pagePath: "/", onFail: build.id },
        ...before.steps.filter((s) => s.type !== "start" && s.type !== "agent"),
      ],
      summary: "Added a check that opens the site after Build.",
    };
    const d = cv.mergeChange(before, raw, []);
    assert.equal(d.steps[0].task, before.steps[0].task, "the goal is never changed by a change in words");
    assert.deepEqual(d.steps[0].brief, brief);
    assert.deepEqual(d.steps.find((s) => s.id === build.id)!.connectors, ["figma"], "settings Claude left out are kept");
    assert.equal(d.summary, "Added a check that opens the site after Build.");
    const diff = cv.diffSteps(before.steps, d.steps, []);
    assert.equal(diff.changed, true);
    assert.deepEqual(diff.after.map((c) => c.mark).filter((m) => m !== "same"), ["new"], "only the new step is marked");
    assert.ok(diff.before.every((c) => c.mark === "same"));
  });

  test("removed, changed and moved steps are each marked", () => {
    const before = def();
    const [start, ...rest] = before.steps;
    const ship = rest.find((s) => s.type === "ship")!;
    const review = rest.find((s) => s.type === "review");
    const raw = {
      steps: [start, ...rest.filter((s) => s.type !== "ship").map((s) => (s.id === review?.id ? { ...s, prompt: "Be strict: check every page on a phone." } : s)), { id: "t1", type: "tell", tellWhen: "always" }],
      summary: "Took out shipping; it tells you instead.",
    };
    const d = cv.mergeChange(before, raw, []);
    const diff = cv.diffSteps(before.steps, d.steps, []);
    assert.equal(diff.before.find((c) => c.id === ship.id)!.mark, "gone");
    if (review) assert.equal(diff.after.find((c) => c.id === review.id)!.mark, "changed");
    assert.equal(diff.after.at(-1)!.mark, "new");
    assert.equal(cv.markWord("gone"), "removed");
  });

  test("no change at all says so", () => {
    const before = def();
    const d = cv.mergeChange(before, { steps: before.steps, summary: "" }, []);
    assert.equal(cv.diffSteps(before.steps, d.steps, []).changed, false);
    assert.deepEqual(d.limits, before.limits);
  });

  test("the prompt sends the steps and the change, not the goal or the brief", () => {
    const p = change.changePrompt(def(), "Make the review stricter");
    assert.match(p, /Make the review stricter/);
    assert.doesNotMatch(p, /small games/, "the goal stays out (the name may echo it)");
    assert.doesNotMatch(p, /CLAUDE\.md/);
  });
});

describe("make a copy and version history", () => {
  test("copy names count up", () => {
    assert.equal(cv.copyName("Lookout"), "Lookout (copy)");
    assert.equal(cv.copyName("Lookout (copy)"), "Lookout (copy 2)");
    assert.equal(cv.copyName("Lookout (copy 2)"), "Lookout (copy 3)");
    assert.ok(cv.copyName("x".repeat(80)).length <= 60);
  });

  test("every save keeps a version, newest first, and a save with nothing new adds none", () => {
    const w = dbm.createWorkflow(def(), "Made from the start screen");
    const changed = { ...def(), steps: def().steps.filter((s) => s.type !== "ship") };
    dbm.updateWorkflow(w.id, changed, "Changed in your own words: Don't ship");
    dbm.updateWorkflow(w.id, changed, "Saved");
    const v = dbm.listVersions(w.id);
    assert.equal(v.length, 2);
    assert.equal(v[0].note, "Changed in your own words: Don't ship");
    assert.equal(v[1].def.steps.length, def().steps.length, "the old version can be restored");
  });
});

describe("the Helper drafts a change", () => {
  test("[[change:ID|…]] becomes a Draft this change button for a real workflow only", () => {
    const w = dbm.createWorkflow({ ...def(), name: "Arcade" }, "test");
    const out = helper.finalize(`Sure.\n[[change:${w.id}|Add a step that tests it on a phone]]\n[[change:999999|Ghost]]`, {});
    assert.equal(out.meta.actions!.length, 1);
    const a = out.meta.actions![0];
    assert.equal(a.kind, "change_workflow");
    assert.equal(a.ref, String(w.id));
    assert.equal(a.label, "Draft this change to Arcade");
    assert.equal(a.task, "Add a step that tests it on a phone");
    assert.doesNotMatch(out.text, /\[\[/);
  });
});
