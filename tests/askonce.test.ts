// v3.1 milestone 2: the goal is asked for once. Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

const wf = await import("../lib/wf");
const { draftPrompt } = await import("../lib/draft");

describe("the start screen asks only for the goal", () => {
  test("the default steps are Build (Careful) → Review → Ship that asks first, with the goal saved", () => {
    const w = wf.defaultWorkflow("  An arcade website with 4 small games  ", "arcade");
    assert.deepEqual(w.steps.map((s) => s.type), ["start", "agent", "review", "ship"]);
    assert.equal(w.steps[0].trigger, "manual");
    assert.equal(w.steps[0].task, "An arcade website with 4 small games");
    assert.equal(w.steps[1].careful, true);
    assert.equal(w.steps[2].onFail, w.steps[1].id, "a review that needs work goes back to the build");
    assert.equal(w.steps[3].shipMode, "ask");
    assert.deepEqual(wf.workflowProblems(w, [], ["arcade"]), [], "it can run as soon as it's made");
  });
  test("the workflow gets a short name from the goal", () => {
    assert.equal(wf.nameFromGoal("Make an arcade website with 4 small games that work on phones."), "Arcade website with 4 small");
    assert.equal(wf.nameFromGoal("# Lookout — v0.1 beta\n\nAn app that watches the web"), "Lookout — v0.1 beta");
    assert.equal(wf.nameFromGoal("I want you to build me a dark mode."), "Dark mode");
    assert.equal(wf.nameFromGoal("   "), "New workflow");
    assert.ok(wf.nameFromGoal("x".repeat(200)).length <= 60);
  });
  test("changing the steps in words treats the goal as context, not as steps", () => {
    const p = draftPrompt("Research first, then build, then ask me before shipping.", "A game about cats");
    assert.match(p, /^Turn this description of the steps into a workflow:/);
    assert.match(p, /<goal>\nA game about cats\n<\/goal>/);
    assert.doesNotMatch(draftPrompt("Research first, then build.", ""), /<goal>/);
  });
});

describe("Run now uses the saved goal; a different goal is for one run only", () => {
  const saved = wf.defaultWorkflow("Make a snake game", "arcade").steps;
  test("no different goal: the run gets the saved steps as they are", () => {
    assert.equal(wf.stepsWithGoal(saved), saved);
    assert.equal(wf.stepsWithGoal(saved, "   "), saved);
  });
  test("a different goal replaces the goal in the run's copy only", () => {
    const run = wf.stepsWithGoal(saved, " Make a snake game with levels ");
    assert.equal(run[0].task, "Make a snake game with levels");
    assert.equal(saved[0].task, "Make a snake game", "the saved goal doesn't change");
    assert.deepEqual(run.slice(1), saved.slice(1));
    assert.equal(wf.runTaskText(run[0].task ?? "", ""), "The task for this run:\nMake a snake game with levels");
  });
});

test("names stop before a 'that…' part and never end on a joining word", () => {
  assert.equal(wf.nameFromGoal("Make a tiny test page that says hello."), "Tiny test page");
  assert.equal(wf.nameFromGoal("Build a snake game with"), "Snake game");
});
