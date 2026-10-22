import { activeRun, listAgents, listRuns, pendingApprovalForRun, getAgent, runsWithStatus } from "./db";
import { readHeartbeat } from "./heartbeat";
import { lowDisk } from "./machine";
import { inboxCount } from "./inbox";
import { usageState } from "./usage";
import { bigUsage, canContinue, carefulLine } from "./runner";
import type { Agent, AgentView, HeartbeatInfo, Run } from "./types";
import { ago, clock, clockOf, duration, inWords, nextRunAfter, scheduleWords } from "./words";

// "Step 3 of 6 · Final check"
export function progressOf(run: Run): { step: number; of: number; label: string } | null {
  if (!run.steps.length) return null;
  const i = run.steps.findIndex((s) => s.state === "now");
  const at = i >= 0 ? i : run.steps.filter((s) => s.state === "done").length;
  if (at >= run.steps.length) return null;
  return { step: at + 1, of: run.steps.length, label: run.steps[at].label };
}

function firstSentence(s: string) {
  const m = s.match(/^[^.!?]*[.!?]/);
  return (m ? m[0] : s).trim();
}

export function nextRunFor(a: Agent): number | null {
  if (!a.enabled || a.paused) return null;
  return a.nextRunAt ?? nextRunAfter(a.scheduleKind, a.scheduleDays, a.scheduleTime);
}

function heartbeatView(a: Agent, hb: HeartbeatInfo): AgentView {
  const last = hb.recent[0];
  const now = Date.now();
  const overdue = !last || now - last.at > 75 * 60 * 1000;
  let status: AgentView["status"] = "done";
  if (!hb.loaded) status = "off";
  else if (hb.running) status = "working";
  else if (overdue || (hb.lastExitCode !== null && hb.lastExitCode !== 0)) status = "stopped";

  const summary = !hb.loaded
    ? "The hourly job isn't switched on."
    : last
      ? `Last check-in at ${clockOf(last.at)}${last.reply ? `: “${last.reply}”` : "."}`
      : "No check-ins yet.";
  return {
    agent: a,
    status,
    task: status === "stopped" && overdue ? "Missed its last check-in" : "Hourly check-in",
    summary,
    waitingForOk: false,
    timeLabel: `${hb.onTimeToday} of ${hb.expectedToday} on time`,
    activeRun: null,
    pendingApproval: null,
  };
}

export function agentView(a: Agent, hb?: HeartbeatInfo): AgentView {
  if (a.kind === "heartbeat") return heartbeatView(a, hb ?? readHeartbeat());

  const run = activeRun(a.id);
  const pending = run ? pendingApprovalForRun(run.id) : null;
  const recent = listRuns(a.id, 20);
  const last: Run | undefined = recent[0];
  // An open pull request shows, unless a newer run of the same job stopped (that's what Nic needs to see first).
  const review = recent[0]?.status === "stopped" ? undefined : recent.find((r) => r.status === "review");
  const now = Date.now();

  const base = { agent: a, activeRun: run, pendingApproval: pending, waitingForOk: false };

  if (run && run.status === "queued") {
    return {
      ...base,
      status: "queued",
      pillLabel: "Waiting",
      task: run.task,
      summary: run.activity ?? "Waiting for usage to reset",
      timeLabel: run.extra.resume ? `back at ${clockOf(run.extra.resume.until)}` : `asked ${ago(run.startedAt, now)}`,
      progress: progressOf(run),
      elapsedMs: run.extra.activeMs ?? 0,
    };
  }
  if (run && (pending || run.status === "waiting")) {
    return {
      ...base,
      status: "needs",
      task: run.task,
      summary: pending?.kind === "plan" || run.plan ? "Waiting for your OK on its plan." : `Waiting for your OK: ${pending?.summary ?? "it has a question"}`,
      waitingForOk: true,
      timeLabel: `started ${ago(run.startedAt, now)}`,
    };
  }
  if (run) {
    const elapsedMs = run.extra.activeMs ?? now - run.startedAt;
    return {
      ...base,
      status: "working",
      task: run.task,
      summary: run.activity ?? "Working on it.",
      timeLabel: duration(elapsedMs) === "under a minute" ? "just started" : `${duration(elapsedMs)} so far`,
      progress: progressOf(run),
      elapsedMs,
    };
  }
  if (review) {
    const careful = carefulLine(review.extra.flow);
    return {
      ...base,
      status: "needs",
      task: review.task,
      summary: careful ? `Ready to merge. ${careful}.` : "Its pull request is ready for you to look at.",
      timeLabel: ago(review.endedAt ?? review.startedAt, now),
    };
  }
  if (!a.enabled || a.paused) {
    return {
      ...base,
      status: a.enabled ? "paused" : "off",
      task: a.enabled ? "Paused" : "Switched off",
      summary: firstSentence(a.prompt),
      timeLabel: last ? ago(last.endedAt ?? last.startedAt, now) : "",
    };
  }
  if (last?.status === "stopped" && (last.extra.outOfTime || last.extra.overBudget) && last.stopReason !== "You stopped it.") {
    return {
      ...base,
      status: "timeout",
      pillLabel: last.extra.overBudget ? "Used its budget" : "Ran out of time",
      task: last.task,
      summary: last.extra.overBudget ? "It used its usage budget. Raise the budget to let it carry on." : "It hit its time limit. Press Keep going to give it 30 more minutes.",
      timeLabel: ago(last.endedAt ?? last.startedAt, now),
    };
  }
  if (last?.status === "stopped") {
    return {
      ...base,
      status: "stopped",
      task: last.task,
      summary: last.stopReason ?? "It stopped before finishing.",
      timeLabel: ago(last.endedAt ?? last.startedAt, now),
    };
  }
  const next = nextRunFor(a);
  if (next) {
    return {
      ...base,
      status: "scheduled",
      task: `Next run ${dayWord(next)} at ${clockOf(next)}`,
      summary: last?.result ? firstSentence(last.result) : firstSentence(a.prompt),
      timeLabel: inWords(next, now),
    };
  }
  if (last) {
    return {
      ...base,
      status: "done",
      task: last.task,
      summary: last.result ? firstSentence(last.result) : "Finished.",
      timeLabel: ago(last.endedAt ?? last.startedAt, now),
    };
  }
  return {
    ...base,
    status: "ready",
    task: "Ready for a task",
    summary: firstSentence(a.prompt),
    timeLabel: "",
  };
}

function dayWord(ms: number) {
  const d = new Date(ms);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return d.getHours() >= 18 || d.getHours() < 5 ? "tonight" : "today";
  if (d.toDateString() === tomorrow.toDateString()) return d.getHours() < 5 && today.getHours() >= 17 ? "tonight" : "tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

export type HomeState = {
  greeting: string;
  summary: string;
  needs: number;
  usageNote: string | null;
  views: AgentView[];
  archived: AgentView[];
};

// Running agents and anything that needs Nic first, then the rest (newest first).
const RANK: Partial<Record<AgentView["status"], number>> = { needs: 0, working: 1, queued: 2 };
function sortViews(views: AgentView[]): AgentView[] {
  return [...views].sort((a, b) => {
    const ra = RANK[a.status] ?? 9;
    const rb = RANK[b.status] ?? 9;
    if (ra !== rb) return ra - rb;
    if (a.agent.kind === "heartbeat" || b.agent.kind === "heartbeat") return a.agent.kind === "heartbeat" ? 1 : -1;
    return lastTouch(b) - lastTouch(a);
  });
}
function lastTouch(v: AgentView) {
  const r = v.activeRun ?? listRuns(v.agent.id, 1)[0];
  return Math.max(v.agent.createdAt, r ? r.endedAt ?? r.startedAt : 0);
}

export function homeState(): HomeState {
  const hb = readHeartbeat();
  const all = listAgents();
  const views = sortViews(all.filter((a) => !a.archived).map((a) => agentView(a, hb)));
  const archived = sortViews(all.filter((a) => a.archived).map((a) => agentView(a, hb)));
  const working = views.filter((v) => v.status === "working").length;
  const needs = inboxCount();
  const h = new Date().getHours();
  const greeting = `Good ${h < 5 ? "evening" : h < 12 ? "morning" : h < 18 ? "afternoon" : "evening"}, Nic`;
  const parts = [
    `${working} agent${working === 1 ? "" : "s"} working`,
    needs ? `${needs} thing${needs === 1 ? "" : "s"} need${needs === 1 ? "s" : ""} you` : "nothing needs you",
  ];
  const u = usageState();
  const queued = views.filter((v) => v.status === "queued").length;
  const disk = lowDisk();
  const usageNote = disk?.low
    ? `Disk space is running low (${disk.freeGb} GB left). See the Machine page.`
    : u.limited
    ? `You're out of Claude usage${u.limitedUntil ? ` until ${clockOf(u.limitedUntil)}` : " for now"}. New runs wait and start by themselves after that.`
    : queued
      ? `${queued} ${queued === 1 ? "run is" : "runs are"} waiting for usage to reset.`
      : null;
  return { greeting, summary: parts.join(" · "), needs, usageNote, views, archived };
}

export type AgentPageState = {
  view: AgentView;
  schedule: string;
  runs: Run[];
  heartbeat: HeartbeatInfo | null;
  bigUsed: number | null; // big jobs: points of the weekly meter used so far
  held: { id: number; name: string; task: string }[]; // small runs waiting for this big job
  canContinue: Record<number, boolean>;
};

export function agentPageState(id: number): AgentPageState | null {
  const a = getAgent(id);
  if (!a) return null;
  const hb = a.kind === "heartbeat" ? readHeartbeat() : null;
  const view = agentView(a, hb ?? undefined);
  let schedule = scheduleWords(a.scheduleKind, a.scheduleDays, a.scheduleTime);
  if (a.kind === "heartbeat") {
    const n = new Date();
    n.setMinutes(0, 0, 0);
    n.setHours(n.getHours() + 1);
    schedule += ` · next ${inWords(n.getTime())}`;
  } else if (!a.enabled) schedule += " · switched off";
  else if (a.paused) schedule += a.scheduleKind === "manual" ? " · paused" : " · paused, so it won't run";
  else {
    const next = nextRunFor(a);
    if (next) schedule += ` · next ${inWords(next)}`;
  }
  const runs = a.kind === "heartbeat" ? [] : listRuns(a.id, 30);
  const active = view.activeRun;
  const held = active?.extra.flow?.big
    ? runsWithStatus("queued").filter((r) => r.extra.held).map((r) => ({ id: r.id, name: getAgent(r.agentId)?.name ?? "An agent", task: r.task }))
    : [];
  const canContinueMap: Record<number, boolean> = {};
  for (const r of runs.slice(0, 5)) if (r.status === "stopped") canContinueMap[r.id] = canContinue(r);
  return { view, schedule, runs, heartbeat: hb, bigUsed: active?.extra.flow?.big ? bigUsage(active) : null, held, canContinue: canContinueMap };
}

export { clock };
