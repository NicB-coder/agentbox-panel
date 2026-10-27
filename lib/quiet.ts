import type { Quiet, WfStep, WorkflowRun } from "./types";

// No silent failures: a run that finishes without really doing anything gets an Inbox item that says so,
// in plain words, with what to do next. These decide when; the runners store the answer and lib/inbox.ts shows it.

export const QUICK_MS = 2 * 60_000;

const NO_CHANGES: Quiet = {
  why: "It finished without changing anything, so there's nothing to look at.",
  next: "Usually the task needs more detail: say what to make, who it's for and what done looks like. Then press Try again, or ask the Helper why.",
};

// A task run that may change things just finished.
export function quietTaskRun(o: { changed: boolean }): Quiet | null {
  return o.changed ? null : NO_CHANGES;
}

// A Look only task run just finished.
export function quietLookRun(o: { report: string }): Quiet | null {
  if (o.report.trim()) return null;
  return { why: "It finished without writing anything back.", next: "Press Try again. If it happens again, ask the Helper why." };
}

// Does this workflow make changes (so a run without any is a problem)? Look only workflows just report.
export function workflowMakesChanges(steps: WfStep[], lookAgentIds: Set<number> = new Set()): boolean {
  return steps.some((s) => {
    if (s.type === "ship" || s.type === "research") return true;
    if (s.type !== "agent") return false;
    if (s.agentId != null && lookAgentIds.has(s.agentId)) return false;
    return (s.freedom ?? (s.mode === "look" ? "look" : "auto")) !== "look";
  });
}

// A workflow run just finished (not stopped: stopped runs already get their own Inbox item).
export function quietWfRun(wr: Pick<WorkflowRun, "prUrl" | "startedAt" | "waitedMs" | "steps">, o: { makesChanges: boolean; now?: number }): Quiet | null {
  if (!o.makesChanges) return null;
  if (!wr.prUrl) return { ...NO_CHANGES, why: "It finished without changing anything, so there's no pull request to look at." };
  const ms = (o.now ?? Date.now()) - wr.startedAt - wr.waitedMs;
  if (ms < QUICK_MS) {
    return {
      why: "It finished in under 2 minutes. That's fine for a small job, but for a bigger one it's worth checking it did everything.",
      next: "Press Look at it to see what it changed. If it isn't right, press Try again, or ask the Helper why.",
    };
  }
  return null;
}
