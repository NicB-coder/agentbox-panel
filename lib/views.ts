import { activeRun, listAgents, listRuns, pendingApprovalForRun, getAgent } from "./db";
import { readHeartbeat } from "./heartbeat";
import type { Agent, AgentView, HeartbeatInfo, Run } from "./types";
import { ago, clock, clockOf, inWords, nextRunAfter, scheduleWords } from "./words";

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
  const review = recent.find((r) => r.status === "review");
  const now = Date.now();

  const base = { agent: a, activeRun: run, pendingApproval: pending, waitingForOk: false };

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
    return {
      ...base,
      status: "working",
      task: run.task,
      summary: run.activity ?? "Working on it.",
      timeLabel: `started ${ago(run.startedAt, now)}`,
    };
  }
  if (review) {
    return {
      ...base,
      status: "needs",
      task: review.task,
      summary: "Its pull request is ready for you to look at.",
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
  views: AgentView[];
};

export function homeState(): HomeState {
  const hb = readHeartbeat();
  const views = listAgents().map((a) => agentView(a, hb));
  const working = views.filter((v) => v.status === "working").length;
  const needs = views.filter((v) => v.status === "needs").length;
  const h = new Date().getHours();
  const greeting = `Good ${h < 5 ? "evening" : h < 12 ? "morning" : h < 18 ? "afternoon" : "evening"}, Nic`;
  const parts = [
    `${working} agent${working === 1 ? "" : "s"} working`,
    needs ? `${needs} thing${needs === 1 ? "" : "s"} need${needs === 1 ? "s" : ""} you` : "nothing needs you",
  ];
  return { greeting, summary: parts.join(" · "), views };
}

export type AgentPageState = {
  view: AgentView;
  schedule: string;
  runs: Run[];
  heartbeat: HeartbeatInfo | null;
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
  return { view, schedule, runs: a.kind === "heartbeat" ? [] : listRuns(a.id, 30), heartbeat: hb };
}

export { clock };
