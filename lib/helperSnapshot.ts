import { getAgent, getSetting, getWorkflow, listAgents, listIdeas, listRuns, listWfRuns, listWorkflows, pendingApprovalForRun, readRecentRuns, recentWfRuns } from "./db";
import { readHeartbeat } from "./heartbeat";
import { inboxItems } from "./inbox";
import { listProjects } from "./projects";
import { readLog } from "./runner";
import type { Run, WorkflowRun } from "./types";
import { usageView } from "./usage";
import { agentView, nextRunFor } from "./views";
import { STEP_INFO, flowSentence, stepTitle } from "./wf";
import { agentRefs } from "./workflowViews";
import { ALLOWED_WORDS, MODE_WORDS, ago, clockOf, duration, plainText, scheduleWords } from "./words";
import { helperUsageToday } from "./draftUsage";

// A fresh, plain-text picture of everything on the panel, sent with each Helper message.
// Ids are in [brackets] so the Helper can link to things and look them up.

const RUN_STATUS: Record<Run["status"], string> = {
  queued: "Waiting for usage to reset",
  working: "Working",
  waiting: "Waiting for Nic's OK",
  review: "Finished, pull request open and waiting for Nic",
  done: "Done",
  stopped: "Stopped",
};

const WF_STATUS: Record<WorkflowRun["status"], string> = {
  queued: "Waiting to start",
  running: "Running",
  needs: "Waiting for Nic",
  done: "Done",
  stopped: "Stopped",
};

const cut = (s: string | null | undefined, n: number) => {
  const t = plainText(String(s ?? "")).replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

export function when(ms: number) {
  const d = new Date(ms);
  const today = new Date().toDateString() === d.toDateString();
  return `${today ? "today" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ${clockOf(ms)} (${ago(ms)})`;
}

// The end of a run's log, without the noisy lines.
export function cleanLog(text: string): string[] {
  return text
    .split("\n")
    .filter((l) => l.trim() && !/system\/thinking_tokens|system\/status|^\[[\d:]+\] (stream_event|rate_limit)/.test(l));
}

export function logTail(runId: number, lines = 25, width = 300): string {
  const all = cleanLog(readLog(runId));
  return all
    .slice(-lines)
    .map((l) => (l.length > width ? `${l.slice(0, width)}…` : l))
    .join("\n");
}

export function stepsLine(steps: Run["steps"]) {
  return steps.map((s) => `${s.state === "done" ? "✓" : s.state === "now" ? "●" : "○"} ${s.label}`).join(" → ");
}

export function runLine(r: Run): string {
  const a = getAgent(r.agentId);
  const who = r.workflowRunId ? `${r.extra.label ?? a?.name ?? "Workflow step"} (step of workflow run [wfrun ${r.workflowRunId}])` : a?.name ?? "A deleted agent";
  const took = r.endedAt ? ` after ${duration(r.endedAt - r.startedAt)}` : "";
  const parts = [
    `[run ${r.id}] ${who} · task: "${cut(r.task, 160)}" · ${RUN_STATUS[r.status]} · started ${when(r.startedAt)}${took} · mode: ${MODE_WORDS[r.mode].label}`,
  ];
  if (r.status === "working" && r.activity) parts.push(`right now: ${cut(r.activity, 160)}`);
  if (r.status === "queued" && r.activity) parts.push(cut(r.activity, 120));
  if (r.stopReason) parts.push(`why it stopped: ${cut(r.stopReason, 300)}`);
  if (r.prUrl) parts.push(`pull request: ${r.prUrl}`);
  if (r.steps.length) parts.push(`steps: ${stepsLine(r.steps)}`);
  if (r.plan && r.status === "waiting") parts.push(`its plan (waiting for OK): ${cut(r.plan, 500)}`);
  const ap = pendingApprovalForRun(r.id);
  if (ap) parts.push(`asking Nic: [approval ${ap.id}] ${cut(ap.summary, 200)}`);
  if (r.result) parts.push(`result: ${cut(r.result, 300)}`);
  return parts.join("\n    ");
}

export function wfRunLine(wr: WorkflowRun): string {
  const wf = getWorkflow(wr.workflowId);
  const agents = agentRefs();
  const parts = [
    `[wfrun ${wr.id}] of [workflow ${wr.workflowId}] ${wf?.name ?? "a deleted workflow"}${wr.test ? " (test run)" : ""} · ${WF_STATUS[wr.status]} · started ${when(wr.startedAt)}${wr.input ? ` · task: "${cut(wr.input, 160)}"` : ""}`,
  ];
  if (wr.waiting) parts.push(`waiting: ${cut(wr.waiting.text, 200)}`);
  if (wr.stopReason) parts.push(`why it stopped: ${cut(wr.stopReason, 300)}`);
  if (wr.prUrl) parts.push(`pull request: ${wr.prUrl}`);
  const steps = wr.steps.map((s) => {
    const sr = wr.stepRuns[s.id];
    const mark = !sr || sr.state === "todo" ? "○" : sr.state === "now" || sr.state === "waiting" ? "●" : sr.state === "failed" || sr.state === "needs_work" ? "✗" : "✓";
    const runs = sr?.runIds.length ? ` (runs ${sr.runIds.map((id) => `[run ${id}]`).join(", ")})` : "";
    return `${mark} ${stepTitle(s, agents)}${sr?.state && sr.state !== "todo" ? ` ${sr.state.replace("_", " ")}` : ""}${sr?.note ? `: ${cut(sr.note, 140)}` : ""}${runs}`;
  });
  parts.push(`steps: ${steps.join(" → ")}`);
  if (wr.summary && wr.summary !== "dismissed") parts.push(`summary: ${cut(wr.summary, 300)}`);
  return parts.join("\n    ");
}

export function buildSnapshot(): string {
  const out: string[] = [];
  const now = Date.now();
  out.push(`Now: ${new Date(now).toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`);
  const pausedAll = getSetting<boolean>("pausedAll", false);
  out.push(pausedAll ? "EVERYTHING IS PAUSED (Pause everything is on): nothing runs until Nic presses Resume everything." : "Pause everything: off.");

  // Usage
  const u = usageView();
  const s = u.state;
  const about = s.exact ? "" : "about ";
  const usage = [
    s.limited ? `OUT OF USAGE until ${s.limitedUntil ? when(s.limitedUntil) : "it resets"}.` : null,
    s.session ? `This session (5-hour window): ${about}${s.session.pct}% used${s.session.resetsAt ? `, resets ${when(s.session.resetsAt)}` : ""}.` : "Session usage not checked yet.",
    s.week ? `This week: ${about}${s.week.pct}% used${s.week.resetsAt ? `, resets ${when(s.week.resetsAt)}` : ""}.` : null,
    u.guardPct ? `Settings: new runs wait when usage passes ${u.guardPct}%.` : "Settings: no usage limit set (new runs only wait when usage is completely out).",
    u.blocked ? "New runs are waiting for usage right now." : null,
    u.queued ? `${u.queued} run(s) queued, waiting for usage.` : null,
    u.byAgent.length ? `Today's share by agent: ${u.byAgent.map((b) => `${b.name} ${b.share}% (${b.runs} runs)`).join(", ")}.` : "No agent runs yet today.",
    u.byWorkflow.length ? `Today's share by workflow: ${u.byWorkflow.map((b) => `${b.name} ${b.share}% (${b.runs} runs)`).join(", ")}.` : null,
    `Helper chats today: ${helperUsageToday().count} replies.`,
  ].filter(Boolean);
  out.push("", "## Claude usage", ...usage.map((l) => `- ${l}`));

  // Agents
  const hb = readHeartbeat();
  out.push("", "## Agents");
  for (const a of listAgents()) {
    const v = agentView(a, hb);
    if (a.kind === "heartbeat") {
      out.push(`- [agent ${a.id}] ${a.name} (the existing hourly check-in job, read-only in the panel) · status ${pill(v.status)} · ${v.timeLabel} today · ${cut(v.summary, 200)}`);
      continue;
    }
    const next = nextRunFor(a);
    out.push(
      `- [agent ${a.id}] ${a.name} · status ${pill(v.status)} · project ${a.project || "none"} · ${scheduleWords(a.scheduleKind, a.scheduleDays, a.scheduleTime)}${next ? ` (next ${when(next)})` : ""} · ${ALLOWED_WORDS[a.allowed].label} · works: ${MODE_WORDS[a.mode].label} · ${a.model === "opus" ? "Smartest (Opus)" : "Fast (Sonnet)"} · ${a.enabled ? (a.paused ? "paused" : "on") : "switched off"}`,
      `    tile says: "${cut(v.task, 120)}" — ${cut(v.summary, 200)}`,
      `    its job: ${cut(a.prompt, 220)}`,
    );
  }

  // Runs: everything active, plus the most recent ones.
  const runs = readRecentRuns(14);
  out.push("", "## Agent runs (newest first)");
  if (!runs.length) out.push("- None yet.");
  let logs = 0;
  for (const r of runs) {
    out.push(`- ${runLine(r)}`);
    const interesting = ["working", "waiting", "stopped"].includes(r.status);
    if (interesting && logs < 3) {
      const t = logTail(r.id, 18, 240);
      if (t) {
        out.push(`    last lines of its log:\n${t.split("\n").map((l) => `      ${l}`).join("\n")}`);
        logs++;
      }
    }
  }

  // Workflows
  const agents = agentRefs();
  const wfs = listWorkflows();
  out.push("", "## Workflows");
  if (!wfs.length) out.push("- None yet. (New workflow → say what you want to make, then Next.)");
  for (const w of wfs) {
    const steps = w.steps.map((st) => `${st.id}: ${stepTitle(st, agents)} (${STEP_INFO[st.type].title})`).join(" → ");
    const last = listWfRuns(w.id, 1)[0];
    out.push(
      `- [workflow ${w.id}] ${w.name} · ${w.enabled ? "On" : "Off"} · project ${w.project || "none"} · last run ${last ? when(last.startedAt) : "never"}`,
      `    ${flowSentence(w, agents)}`,
      `    steps: ${steps}`,
    );
  }
  const wfRuns = recentWfRuns(8);
  if (wfRuns.length) {
    out.push("", "## Workflow runs (newest first)");
    for (const wr of wfRuns) out.push(`- ${wfRunLine(wr)}`);
  }

  // Inbox
  const items = inboxItems();
  out.push("", `## Inbox (${items.length} thing${items.length === 1 ? "" : "s"} need Nic)`);
  if (!items.length) out.push("- Nothing. (\"Nothing needs you. Nice.\")");
  for (const i of items.slice(0, 15)) {
    const ref =
      i.kind === "approval" ? `[approval ${i.approvalId}]` : "runId" in i ? `[run ${i.runId}]` : "wfRunId" in i ? `[wfrun ${i.wfRunId}]` : "";
    const kind = { approval: "asks for OK on a step", plan: "plan waiting for approval", pr: "pull request to look at", failed: "stopped", wf_ask: "workflow waiting at Ask me", wf_ship: "workflow waiting to Ship", wf_failed: "workflow stopped", quiet: "finished without really doing anything" }[i.kind];
    out.push(`- ${ref} ${i.who} · ${kind} · "${cut(i.title, 120)}" · ${cut(i.text, 200)} · ${ago(i.at)}`);
  }

  // Ideas, projects, heartbeat
  const ideas = listIdeas();
  out.push("", "## Ideas list (on the Inbox page)");
  out.push(...(ideas.length ? ideas.slice(0, 10).map((i) => `- "${cut(i.text, 160)}" (${ago(i.createdAt)})`) : ["- Empty."]));
  out.push("", `## Projects on this Mac: ${listProjects().join(", ") || "none yet"}`);
  const last = hb.recent[0];
  out.push(
    "",
    `## Heartbeat: ${hb.loaded ? "switched on" : "NOT switched on"} · ${hb.onTimeToday} of ${hb.expectedToday} on time today · last check-in ${last ? when(last.at) : "none"}${hb.lastExitCode ? ` · last exit code ${hb.lastExitCode} (an error)` : ""}`,
  );
  return out.join("\n");
}

function pill(p: string) {
  return { working: "Working", needs: "Needs you", done: "Done", stopped: "Stopped", scheduled: "Scheduled", paused: "Paused", off: "Off", ready: "Ready", queued: "Waiting", running: "Running", on: "On" }[p] ?? p;
}

// Helper for agent pages: recent runs of one agent.
export function agentRunsText(agentId: number, n = 10): string {
  return listRuns(agentId, n).map((r) => `- ${runLine(r)}`).join("\n") || "- No runs yet.";
}
