import { shipsOnOk } from "./wf";
import {
  getAgent, getRun, getWfRun, getWorkflow, listIdeas, pendingApprovals, recentQuietRuns, recentQuietWfRuns, recentStoppedRuns, recentStoppedWfRuns, runsWithStatus,
  wfRunsWithPrWaiting, wfRunsWithStatus,
} from "./db";
import type { Agent, Idea, InboxItem, Run } from "./types";
import { listNotices, unopenedNotices, type Notice } from "./notices";
import { listOpenFilePrs } from "./projectFiles";
import { OUT_OF_TIME, OVER_BUDGET, PAUSED_ALL, canContinue, carefulLine, firstLine } from "./runner";
import { plainText, userStop } from "./words";

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

const userStopped = (reason: string | null) => userStop(reason) || reason === PAUSED_ALL;


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
      review: run.extra.review ?? null, quick: !!run.extra.quick,
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
      link: `/workflows/${wf.id}?run=${wr.id}`, test: wr.test, ships: shipsOnOk(wr), project: wf.project,
    });
  }

  // Finished with a pull request: like a task's "Pull request ready", until it's merged, closed or dismissed.
  for (const wr of wfRunsWithPrWaiting()) {
    const wf = getWorkflow(wr.workflowId);
    if (!wf || !wr.prUrl) continue;
    items.push({
      key: `wfd${wr.id}`, kind: "wf_done", at: wr.endedAt ?? wr.startedAt, title: wr.input || wf.name, who: wf.name, color: "#7048C8", icon: "flow",
      wfRunId: wr.id, text: wr.summary ?? "Finished. The pull request has everything.", prUrl: wr.prUrl, link: `/workflows/${wf.id}?run=${wr.id}`, test: wr.test,
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

  // Finished, but didn't really do anything: never just end without saying so.
  for (const run of recentQuietRuns(since)) {
    const a = getAgent(run.agentId) as Agent | null;
    items.push({
      key: `quiet${run.id}`, kind: "quiet", at: run.endedAt ?? run.startedAt, title: run.task, ...who(run), runId: run.id,
      text: run.extra.quiet!.why, next: run.extra.quiet!.next, said: run.result ? firstLine(plainText(run.result)) : null, canRetry: !!a && a.kind === "claude" && a.enabled,
    });
  }
  for (const wr of recentQuietWfRuns(since)) {
    const wf = getWorkflow(wr.workflowId);
    if (!wf) continue;
    const said = [...wr.steps].reverse().map((s) => (["agent", "research", "review"].includes(s.type) ? wr.stepRuns[s.id]?.note : null)).find(Boolean) ?? null;
    items.push({
      key: `wfq${wr.id}`, kind: "quiet", at: wr.endedAt ?? wr.startedAt, title: wr.input || wf.name, who: wf.name, color: "#7048C8", icon: "flow",
      wfRunId: wr.id, text: wr.quiet!.why, next: wr.quiet!.next, said, link: `/workflows/${wf.id}?run=${wr.id}`, canRetry: true, prUrl: wr.prUrl ?? undefined,
    });
  }

  // Files added on the Projects page: one click to merge them in.
  for (const f of listOpenFilePrs()) {
    items.push({
      key: `file${f.id}`, kind: "file_pr", at: f.createdAt, title: f.replaces ? `Update ${f.file} in ${f.project}` : `Add ${f.file} to ${f.project}`, who: f.project, color: "#555A63", icon: "folder",
      fileId: f.id, project: f.project, file: f.file, prUrl: f.prUrl, link: "/projects",
      text: `This puts ${f.file} in ${f.project}, so every agent and workflow can read it. Press Merge it to finish.`,
    });
  }

  return items.sort((a, b) => b.at - a.at);
}

export function inboxCount(): number {
  return inboxItems().length + unopenedNotices();
}

export type InboxState = { items: InboxItem[]; ideas: Idea[]; notices: Notice[] };

export function inboxState(): InboxState {
  return { items: inboxItems(), ideas: listIdeas(), notices: listNotices() };
}
