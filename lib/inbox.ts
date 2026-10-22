import {
  getAgent, getRun, getWfRun, getWorkflow, listIdeas, pendingApprovals, recentStoppedRuns, recentStoppedWfRuns, runsWithStatus, wfRunsWithStatus,
} from "./db";
import type { Agent, Idea, InboxItem, Run } from "./types";
import { OUT_OF_TIME, OVER_BUDGET, PAUSED_ALL, canContinue, carefulLine } from "./runner";

// Everything that needs Nic, newest first.

const WEEK = 7 * 86400_000;

function who(run: Run): { who: string; color: string; icon: string; link: string } {
  const a = getAgent(run.agentId);
  if (run.workflowRunId) {
    const wr = getWorkflowFromRun(run);
    return { who: wr ? `${wr.name} · ${run.extra.label ?? a?.name ?? "a step"}` : run.extra.label ?? "Workflow step", color: "#7048C8", icon: "flow", link: wr ? `/workflows/${wr.id}` : "/workflows" };
  }
  return { who: a?.name ?? "An agent", color: a?.color ?? "#555A63", icon: a?.icon ?? "sparkle", link: `/agents/${run.agentId}` };
}

function getWorkflowFromRun(run: Run) {
  const wfRun = run.workflowRunId ? getWfRun(run.workflowRunId) : null;
  return wfRun ? getWorkflow(wfRun.workflowId) : null;
}

const userStopped = (reason: string | null) => reason === "You stopped it." || reason === PAUSED_ALL;

export function inboxItems(): InboxItem[] {
  const items: InboxItem[] = [];

  for (const ap of pendingApprovals()) {
    const run = getRun(ap.runId);
    if (!run) continue;
    items.push({ key: `ap${ap.id}`, kind: "approval", at: ap.createdAt, title: run.task, ...who(run), approvalId: ap.id, text: ap.summary, detail: ap.detail });
  }

  for (const run of runsWithStatus("waiting")) {
    if (!run.plan) continue;
    items.push({ key: `plan${run.id}`, kind: "plan", at: run.startedAt, title: run.task, ...who(run), runId: run.id, text: run.plan });
  }

  const seenPr = new Set<string>();
  for (const run of runsWithStatus("review").reverse()) {
    if (!run.prUrl || seenPr.has(run.prUrl)) continue; // follow-ups share one pull request: show it once
    seenPr.add(run.prUrl);
    items.push({
      key: `pr${run.id}`, kind: "pr", at: run.endedAt ?? run.startedAt, title: run.task, ...who(run), runId: run.id, prUrl: run.prUrl,
      text: run.result ?? "It finished and opened a pull request.", careful: carefulLine(run.extra.flow), reviewedHere: !!run.extra.flow?.reviews.length,
      review: run.extra.review ?? null,
    });
  }

  const since = Date.now() - WEEK;
  for (const run of recentStoppedRuns(since)) {
    if (userStopped(run.stopReason) || run.stopReason === "The pull request was closed without merging." || run.extra.prReview) continue;
    const a = getAgent(run.agentId) as Agent | null;
    const stopKind = run.extra.signIn ? "signin" : run.stopReason === OUT_OF_TIME ? "time" : run.stopReason === OVER_BUDGET ? "budget" : "error";
    items.push({
      key: `fail${run.id}`, kind: "failed", at: run.endedAt ?? run.startedAt, title: run.task, ...who(run), runId: run.id, agentId: run.agentId,
      text: stopKind === "time" ? "It hit its time limit before finishing. Its work so far is kept." : stopKind === "budget" ? "It used its usage budget. Its work so far is kept." : run.stopReason ?? "It stopped before finishing.",
      canRetry: !!a && a.kind === "claude" && a.enabled, canContinue: canContinue(run), stopKind, signIn: run.extra.signIn,
    });
  }

  for (const wr of wfRunsWithStatus("needs")) {
    const wf = getWorkflow(wr.workflowId);
    if (!wf || !wr.waiting || (wr.waiting.kind !== "ask" && wr.waiting.kind !== "ship")) continue;
    items.push({
      key: `wf${wr.id}`, kind: wr.waiting.kind === "ask" ? "wf_ask" : "wf_ship", at: wr.stepRuns[wr.steps[wr.current]?.id]?.startedAt ?? wr.startedAt,
      title: wr.input || wf.name, who: wf.name, color: "#7048C8", icon: "flow", wfRunId: wr.id, text: wr.waiting.text, prUrl: wr.prUrl,
      link: `/workflows/${wf.id}?run=${wr.id}`, test: wr.test,
    });
  }

  for (const wr of recentStoppedWfRuns(since)) {
    if (userStopped(wr.stopReason)) continue;
    const wf = getWorkflow(wr.workflowId);
    if (!wf) continue;
    items.push({
      key: `wff${wr.id}`, kind: "wf_failed", at: wr.endedAt ?? wr.startedAt, title: wr.input || wf.name, who: wf.name, color: "#7048C8", icon: "flow",
      wfRunId: wr.id, workflowId: wf.id, text: wr.stopReason ?? "It stopped before finishing.", link: `/workflows/${wf.id}?run=${wr.id}`,
    });
  }

  return items.sort((a, b) => b.at - a.at);
}

export function inboxCount(): number {
  return inboxItems().length;
}

export type InboxState = { items: InboxItem[]; ideas: Idea[] };

export function inboxState(): InboxState {
  return { items: inboxItems(), ideas: listIdeas() };
}
