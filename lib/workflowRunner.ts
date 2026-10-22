import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  activeRun, createWfRun, getAgent, getRun, getWfRun, getWorkflow, hasSeenAny, helperAgentId, listAgents, listWorkflows, markSeen,
  setWorkflowNextRunAt, updateWfRun, wfRunsWithStatus,
} from "./db";
import { runChecks } from "./checks";
import { sendDiscord } from "./notify";
import { projectPath } from "./projects";
import { PAUSED_ALL, USAGE_STOP, pausedAll, startRun, stopRun } from "./runner";
import type { Model, Run, RunExtra, WfStep, WfStepRun, Workflow, WorkflowRun, WorkMode } from "./types";
import { usageBlocked, usageState } from "./usage";
import { freedomOf, modeFor } from "./job";
import { REPORT_FORMAT, RESEARCH_METHOD } from "./research";
import { flowSentence, stepTitle, type AgentRef } from "./wf";
import { clockOf, nextRunAfter, plainText } from "./words";

// Runs a workflow: one shared git worktree and branch, one pull request, steps one after another.
// Agent-like steps reuse the v1 task runner (same hooks, approvals and the main/force-push block).

const WORKTREES = path.join(os.homedir(), "agents", "worktrees");
const PATH = [path.join(os.homedir(), ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":");
const RESTARTED = "The panel restarted while it was working.";
const PROTECTED_REPOS = ["agentbox-panel"]; // never ship automatically

type G = typeof globalThis & { __wfHandled?: Set<number>; __wfBusy?: Set<number>; __wfChecks?: Set<number>; __wfLastPoll?: number; __wfRepo?: Map<string, string> };
const g = globalThis as G;
const busy = (g.__wfBusy ??= new Set());
const handled = (g.__wfHandled ??= new Set()); // step runs whose end we've already dealt with
const checking = (g.__wfChecks ??= new Set());
const repoCache = (g.__wfRepo ??= new Map());

function sh(cmd: string, args: string[], cwd: string, timeout = 120_000): Promise<{ ok: boolean; out: string; err: string }> {
  const env: NodeJS.ProcessEnv = { ...process.env, PATH, GIT_TERMINAL_PROMPT: "0" };
  for (const k of Object.keys(env)) if (k === "CLAUDECODE" || k.startsWith("CLAUDE_CODE_")) delete env[k];
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, timeout, env, maxBuffer: 10 * 1024 * 1024 }, (e, stdout, stderr) =>
      resolve({ ok: !e, out: String(stdout).trim(), err: String(stderr).trim() }),
    );
  });
}

function slug(s: string, n = 4) {
  return s.toLowerCase().replace(/\b(main|master)\b/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").split("-").slice(0, n).join("-") || "flow";
}

const agentRefs = (): AgentRef[] => listAgents().map((a) => ({ id: a.id, name: a.name, color: a.color, icon: a.icon, slug: a.slug, allowed: a.allowed }));

function freshStepRun(): WfStepRun {
  return { state: "todo", note: null, runIds: [], startedAt: null, endedAt: null, rounds: 0 };
}

function setStep(wrId: number, stepId: string, patch: Partial<WfStepRun>) {
  const wr = getWfRun(wrId);
  if (!wr) return;
  const cur = wr.stepRuns[stepId] ?? freshStepRun();
  updateWfRun(wrId, { stepRuns: { ...wr.stepRuns, [stepId]: { ...cur, ...patch } } });
}

export function isActive(wr: WorkflowRun) {
  return wr.status === "running" || wr.status === "needs" || wr.status === "queued";
}

export function activeWfRun(workflowId: number): WorkflowRun | null {
  return wfRunsWithStatus("queued", "running", "needs").filter((w) => w.workflowId === workflowId).pop() ?? null;
}

async function repoName(dir: string): Promise<string | null> {
  if (repoCache.has(dir)) return repoCache.get(dir)!;
  const r = await sh("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], dir, 30_000);
  if (!r.ok || !r.out) return null;
  repoCache.set(dir, r.out);
  return r.out;
}

async function baseRef(repo: string): Promise<string> {
  await sh("git", ["fetch", "origin", "--prune"], repo);
  const head = await sh("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], repo);
  if (head.ok && head.out) return head.out;
  for (const ref of ["origin/main", "origin/master", "HEAD"]) if ((await sh("git", ["rev-parse", "--verify", "--quiet", ref], repo)).ok) return ref;
  return "HEAD";
}

// ---------- starting ----------

export type StartWfOpts = {
  input?: string;
  test?: boolean;
  trigger: WorkflowRun["trigger"];
  triggerRef?: string | null;
  prBranch?: string; // "When a pull request opens": work on that pull request's branch
};

export async function startWorkflow(workflowId: number, opts: StartWfOpts): Promise<WorkflowRun> {
  const wf = getWorkflow(workflowId);
  if (!wf) throw new Error("There's no workflow with that number.");
  if (pausedAll()) throw new Error("Everything is paused. Press Resume everything at the top first.");
  if (!projectPath(wf.project)) throw new Error(`Can't find the project "${wf.project}" on this Mac.`);
  if (wf.steps.length < 2) throw new Error("Add at least one step after Start first.");
  const busyRun = activeWfRun(workflowId);
  const manual = opts.trigger === "manual" || opts.trigger === "test" || opts.trigger === "idea";
  if (busyRun && manual) throw new Error("It's already running. Wait for it to finish or stop it first.");

  const stepRuns: Record<string, WfStepRun> = {};
  for (const s of wf.steps) stepRuns[s.id] = freshStepRun();
  const wr = createWfRun({
    workflowId, status: busyRun ? "queued" : "running", test: !!opts.test, input: ((opts.input ?? "").trim() || (wf.steps[0]?.task ?? "").trim()).slice(0, 8000),
    trigger: opts.trigger, triggerRef: opts.triggerRef ?? (opts.prBranch ? `branch:${opts.prBranch}` : null), steps: wf.steps, stepRuns,
  });
  if (!busyRun) begin(wr.id).catch((e) => stopWorkflow(wr.id, "It couldn't get started.", { detail: String(e) }));
  return getWfRun(wr.id)!;
}

async function begin(wrId: number) {
  const wr = getWfRun(wrId)!;
  const wf = getWorkflow(wr.workflowId)!;
  const repo = projectPath(wf.project);
  if (!repo) return stopWorkflow(wrId, `Can't find the project "${wf.project}" on this Mac.`);
  updateWfRun(wrId, { status: "running", startedAt: Date.now(), usageStart: usageState().session });
  const base = await baseRef(repo);
  const prBranch = wr.triggerRef?.startsWith("branch:") ? wr.triggerRef.slice(7) : null;
  const branch = prBranch ?? `agent/wf-${slug(wf.name, 3)}-${slug(wr.input || (wr.test ? "test" : "run"), 3)}-${wr.id}`;
  const dir = path.join(WORKTREES, wf.project, `wf-${wr.id}-${branch.replace(/\//g, "-")}`.slice(0, 120));
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const add = prBranch
    ? await sh("git", ["worktree", "add", "--detach", dir, `origin/${prBranch}`], repo)
    : await sh("git", ["worktree", "add", "-b", branch, dir, base], repo);
  if (!add.ok) return stopWorkflow(wrId, "It couldn't make its own copy of the project.", { detail: add.err });
  let prUrl: string | null = null;
  if (prBranch) {
    const pr = await sh("gh", ["pr", "view", prBranch, "--json", "url", "--jq", ".url"], dir);
    prUrl = pr.ok && pr.out ? pr.out : null;
  }
  updateWfRun(wrId, { branch, worktree: dir, prUrl });
  await advance(wrId);
}

// ---------- moving along ----------

export async function advance(wrId: number): Promise<void> {
  if (busy.has(wrId)) return;
  busy.add(wrId);
  try {
    for (let guard = 0; guard < 40; guard++) {
      const wr = getWfRun(wrId);
      if (!wr || wr.status !== "running") return;
      if (overLimits(wr)) return;
      if (wr.current >= wr.steps.length) return finish(wrId);
      const step = wr.steps[wr.current];
      const sr = wr.stepRuns[step.id] ?? freshStepRun();
      const moveOn = (patch: Partial<WfStepRun>) => {
        setStep(wrId, step.id, { endedAt: Date.now(), ...patch });
        updateWfRun(wrId, { current: wr.current + 1 });
      };

      switch (step.type) {
        case "start": {
          const how = wr.trigger === "test" ? "Test run" : wr.trigger === "schedule" ? "Started by its schedule" : wr.trigger === "issue" ? "Started by a GitHub issue" : wr.trigger === "pr" ? "Started by a new pull request" : wr.trigger === "idea" ? "Started from an idea" : "You started it";
          moveOn({ state: "done", startedAt: wr.startedAt, note: how });
          continue;
        }
        case "agent":
        case "research":
        case "review": {
          if (sr.state === "now") return; // its run is going; we hear back in onStepRunEnded
          await startStep(wr, step);
          return;
        }
        case "check": {
          if (sr.state === "now" && checking.has(wrId)) return;
          runCheckStep(wrId, step);
          return;
        }
        case "ask": {
          if (sr.state === "waiting") return;
          const text = step.question?.trim() || "The workflow is waiting for your OK to go on.";
          setStep(wrId, step.id, { state: "waiting", startedAt: Date.now(), note: "Waiting for you in the Inbox" });
          updateWfRun(wrId, { status: "needs", waiting: { kind: "ask", text, until: Date.now() } });
          ping(wr, `is waiting for your OK: ${text}`);
          return;
        }
        case "ship": {
          if (wr.test) {
            setStep(wrId, step.id, { state: "skipped", startedAt: Date.now(), endedAt: Date.now(), note: "Test run: it stopped here instead of shipping." });
            return finish(wrId, "Test run finished. It stopped before shipping.");
          }
          if (!wr.prUrl) {
            moveOn({ state: "skipped", startedAt: Date.now(), note: "Nothing to ship: no changes were made." });
            continue;
          }
          const wf = getWorkflow(wr.workflowId);
          const prev = wr.steps[wr.current - 1];
          const okedJustBefore = prev?.type === "ask" && wr.stepRuns[prev.id]?.state === "done";
          if (okedJustBefore || canShipAutomatically(wr, step, wf)) {
            await ship(wrId, step);
            return;
          }
          if (sr.state === "waiting") return;
          const text = step.shipMode === "auto" ? "Not every check passed, so it needs your OK to ship." : "Ready to ship. This merges the pull request into main.";
          setStep(wrId, step.id, { state: "waiting", startedAt: Date.now(), note: "Waiting for your OK to ship" });
          updateWfRun(wrId, { status: "needs", waiting: { kind: "ship", text, until: Date.now() } });
          ping(wr, `is ready to ship and waiting for your OK. ${wr.prUrl}`);
          return;
        }
        case "tell": {
          setStep(wrId, step.id, { state: "now", startedAt: Date.now(), note: "Writing your message…" });
          const note = await tell(wr, step);
          moveOn({ state: note.startsWith("Skipped") || note.startsWith("Test run") ? "skipped" : "done", note });
          continue;
        }
      }
    }
  } finally {
    busy.delete(wrId);
  }
}

function canShipAutomatically(wr: WorkflowRun, step: WfStep, wf: Workflow | null): boolean {
  if (step.shipMode !== "auto" || !wf || PROTECTED_REPOS.includes(wf.project)) return false;
  const gates = wr.steps.slice(0, wr.current).filter((s) => s.type === "review" || s.type === "check");
  return gates.length > 0 && gates.every((s) => wr.gates[s.id] === "passed");
}

function overLimits(wr: WorkflowRun): boolean {
  const wf = getWorkflow(wr.workflowId);
  if (!wf) return false;
  const ranMs = Date.now() - wr.startedAt - wr.waitedMs;
  if (ranMs > wf.limits.maxMinutes * 60_000) {
    stopWorkflow(wr.id, `It ran longer than its ${wf.limits.maxMinutes}-minute limit.`);
    return true;
  }
  const used = usageUsed(wr);
  if (used !== null && used > wf.limits.maxUsagePct) {
    stopWorkflow(wr.id, `It used more than about ${wf.limits.maxUsagePct}% of your Claude usage, its limit for one run.`);
    return true;
  }
  return false;
}

// How many points of the session's usage this run has used (about: other Claude use on this account counts too).
function usageUsed(wr: WorkflowRun): number | null {
  const start = wr.usageStart;
  const now = usageState();
  if (!start || !now.session || !now.exact) return null;
  let s = { ...start };
  if (now.session.resetsAt && s.resetsAt && now.session.resetsAt !== s.resetsAt) {
    // The window reset during the run: keep what was used before, start counting again from 0.
    s = { pct: 0, resetsAt: now.session.resetsAt, carry: (s.carry ?? 0) + Math.max(0, (s.last ?? s.pct) - s.pct) };
  }
  s.last = now.session.pct;
  updateWfRun(wr.id, { usageStart: s });
  return (s.carry ?? 0) + Math.max(0, now.session.pct - s.pct);
}

// ---------- agent-like steps ----------

function context(wr: WorkflowRun, wf: Workflow, step: WfStep): string {
  const agents = agentRefs();
  const lines = [
    `You are one step ("${stepTitle(step, agents)}") in Nic's workflow "${wf.name}". The whole workflow: ${flowSentence(wf, agents)}`,
    "",
    wr.input ? `The task for this run:\n${wr.input}` : "There's no extra task for this run: do the job described below.",
    "",
    "Everyone in this workflow works in this same folder and branch. Earlier steps' work is already here.",
    "If research.md exists at the top of this folder, read it first: it's the research for this task.",
  ];
  if (wr.prUrl) lines.push(`Everything so far is in the pull request ${wr.prUrl}. Read it and its comments first: gh pr view ${wr.prUrl} --comments`);
  if (wr.feedback) lines.push("", `Last time this was sent back. Fix these things first:\n${wr.feedback}`);
  return lines.join("\n");
}

function stepRunConfig(wr: WorkflowRun, wf: Workflow, step: WfStep): { agentId: number; mode: WorkMode; extra: RunExtra } {
  const agents = agentRefs();
  const ctx = context(wr, wf, step);
  const base = { worktree: wr.worktree!, branch: wr.branch!, label: stepTitle(step, agents) };
  if (step.type === "research") {
    return {
      agentId: helperAgentId(), mode: "auto",
      extra: {
        ...base, role: "research", allowed: "suggest", model: step.model ?? "sonnet", maxMinutes: step.maxMinutes ?? 20,
        prompt: `${ctx}\n\nYour job: research this task before anyone builds it, the same careful way agentbox's research tasks work.\n\n${RESEARCH_METHOD}\n\nAlso look at the existing code. Write what you learn to research.md at the top of this folder, in this format (and add a "## Recommended approach" section after the short answer, for the builder):\n${REPORT_FORMAT}\n\nDon't change any other file. Commit research.md.${step.prompt?.trim() ? `\n\nNic's notes for the research:\n${step.prompt.trim()}` : ""}`,
      },
    };
  }
  if (step.type === "review") {
    return {
      agentId: helperAgentId(), mode: "look",
      extra: {
        ...base, role: "review", allowed: "look", model: step.model ?? "opus", maxMinutes: step.maxMinutes ?? 15,
        prompt: `${ctx}\n\nYour job: you are the reviewer. Look at what changed on this branch compared with the main branch (for example git diff origin/HEAD...HEAD, or git log -p origin/main..HEAD) and compare it with the task and research.md. Does it do what was asked? Does it match the research? Are there bugs, risky changes or missing pieces? Write a short, friendly review for Nic in plain words.${step.prompt?.trim() ? `\n\nAlso check: ${step.prompt.trim()}` : ""}\n\nOn the very last line write exactly one of:\nVERDICT: passed\nVERDICT: needs work\nIf it needs work, list the specific changes needed just above that line.`,
      },
    };
  }
  // Agent step: one of Nic's agents, or a quick step with its own short prompt.
  const agent = step.agentId != null ? getAgent(step.agentId) : null;
  const freedom = step.freedom ?? (step.mode === "look" ? "look" : step.mode === "plan" ? "check" : agent ? freedomOf(agent) : "auto");
  const look = freedom === "look" || agent?.allowed === "look";
  const outcome = look ? "\n\nAt the very end, on its own line, write OUTCOME: all good  or  OUTCOME: problems found" : "";
  const job = agent ? `Your usual job, in Nic's words:\n${agent.prompt}` : `Your job:\n${step.prompt ?? ""}`;
  const extraNote = agent && step.prompt?.trim() ? `\n\nFor this step, Nic adds:\n${step.prompt.trim()}` : "";
  const finish = look ? "" : "\n\nCommit your changes with a clear message when you're done. Don't push and don't open a pull request: the workflow does that.";
  return {
    agentId: agent ? agent.id : helperAgentId(),
    mode: step.freedom ? modeFor(freedom, step.mode === "ask").mode : step.mode ?? agent?.mode ?? "auto",
    extra: {
      ...base, role: agent ? "agent" : "quick", allowed: look ? "look" : "suggest", careful: !!step.careful, connectors: step.connectors ?? [],
      model: (agent ? step.model ?? agent.model : step.model ?? "sonnet") as Model, maxMinutes: step.maxMinutes ?? agent?.maxMinutes ?? 30,
      prompt: `${ctx}\n\n${job}${extraNote}${outcome}${finish}`,
    },
  };
}

async function startStep(wr: WorkflowRun, step: WfStep) {
  const wf = getWorkflow(wr.workflowId);
  if (!wf || !wr.worktree) return stopWorkflow(wr.id, "Its copy of the project is missing.");
  const cfg = stepRunConfig(wr, wf, step);
  const agent = getAgent(cfg.agentId);
  if (!agent) return stopWorkflow(wr.id, `The agent for “${stepTitle(step, agentRefs())}” no longer exists. Pick another in the editor.`);
  if (agent.kind === "claude" && activeRun(agent.id)) {
    setStep(wr.id, step.id, { state: "todo", note: `Waiting for ${agent.name} to finish its other task` });
    updateWfRun(wr.id, { waiting: { kind: "agent", text: `Waiting for ${agent.name}`, until: Date.now() } });
    return;
  }
  if (!agent.enabled) return stopWorkflow(wr.id, `${agent.name} is switched off. Turn it on, or pick another agent for that step.`);
  const sr = wr.stepRuns[step.id] ?? freshStepRun();
  try {
    const run = await startRun(agent.id, {
      task: wr.input ? `${wf.name}: ${wr.input.split("\n")[0].slice(0, 120)}` : wf.name,
      mode: cfg.mode, trigger: "workflow", project: wf.project, workflowRunId: wr.id, stepId: step.id, extra: cfg.extra,
    });
    updateWfRun(wr.id, { waiting: null });
    setStep(wr.id, step.id, {
      state: "now", startedAt: sr.startedAt && sr.state === "now" ? sr.startedAt : Date.now(), endedAt: null,
      note: run.status === "queued" ? run.activity : "Getting started…", runIds: [...sr.runIds, run.id],
    });
  } catch (e) {
    stopWorkflow(wr.id, (e as Error).message);
  }
}

// Called by the task runner whenever a workflow step's run ends.
export async function onStepRunEnded(runId: number) {
  const run = getRun(runId);
  if (!run?.workflowRunId || !run.stepId) return;
  if (run.status !== "done" && run.status !== "stopped") return;
  if (handled.has(runId)) return;
  handled.add(runId);
  const wr = getWfRun(run.workflowRunId);
  if (!wr || wr.status !== "running") return;
  const idx = wr.steps.findIndex((s) => s.id === run.stepId);
  if (idx !== wr.current) return;
  const step = wr.steps[idx];

  if (run.status === "stopped") {
    if (run.stopReason === USAGE_STOP || run.stopReason === RESTARTED) {
      // Try this step again: after the usage resets, or straight away after a restart.
      const until = usageBlocked().until;
      setStep(wr.id, step.id, { state: "todo", note: run.stopReason === USAGE_STOP ? `Waiting for usage to reset${until ? ` at ${clockOf(until)}` : ""}` : "Starting again after a restart" });
      updateWfRun(wr.id, { waiting: { kind: "usage", text: "Waiting for usage to reset", until: until ?? Date.now() } });
      return;
    }
    if (run.stopReason === PAUSED_ALL || run.stopReason === "You stopped it.") return stopWorkflow(wr.id, run.stopReason, { byUser: true });
    setStep(wr.id, step.id, { state: "failed", endedAt: Date.now(), note: run.stopReason ?? "It stopped." });
    return stopWorkflow(wr.id, `${stepTitle(step, agentRefs())} stopped: ${run.stopReason ?? "it ran into a problem"}`, { keepStep: true });
  }
  if (run.status !== "done") return;

  const text = run.result ?? "";
  const summary = plainText(text.split("\n").map((l) => l.trim()).find(Boolean) ?? "Finished.").slice(0, 280);
  await syncBranch(wr.id);
  const fresh = getWfRun(wr.id)!;
  const agents = agentRefs();

  if (step.type === "review") {
    const verdict = text.match(/VERDICT:\s*(passed|needs work)/i)?.[1]?.toLowerCase() ?? (/needs work|changes needed|must fix/i.test(text) ? "needs work" : "passed");
    const body = text.replace(/^\s*VERDICT:.*$/gim, "").trim();
    await comment(fresh, `**Review${fresh.loops ? ` (round ${fresh.loops + 1})` : ""}: ${verdict === "passed" ? "passed ✅" : "needs work"}**\n\n${body}`);
    if (verdict === "passed") {
      updateWfRun(wr.id, { gates: { ...fresh.gates, [step.id]: "passed" }, feedback: null });
      setStep(wr.id, step.id, { state: "passed", endedAt: Date.now(), note: summary });
      updateWfRun(wr.id, { current: idx + 1 });
    } else {
      updateWfRun(wr.id, { gates: { ...fresh.gates, [step.id]: "failed" } });
      setStep(wr.id, step.id, { state: "needs_work", endedAt: Date.now(), note: summary });
      if (!sendBack(wr.id, step, `The reviewer said:\n${body}`)) return;
    }
  } else {
    const problems = /OUTCOME:\s*problems/i.test(text);
    const clean = text.replace(/^\s*OUTCOME:.*$/gim, "").trim();
    await comment(fresh, `**${stepTitle(step, agents)}** · ${summary}${clean.length > summary.length + 20 ? `\n\n<details><summary>Everything it said</summary>\n\n${clean.slice(0, 6000)}\n\n</details>` : ""}`);
    setStep(wr.id, step.id, { state: "done", endedAt: Date.now(), note: summary, outcome: /OUTCOME:/i.test(text) ? (problems ? "problems" : "ok") : undefined });
    updateWfRun(wr.id, { current: idx + 1, feedback: step.type === "agent" ? null : fresh.feedback });
  }
  await advance(wr.id);
}

// "Needs work": go back to the chosen step, or stop and tell Nic. Returns false if the run stopped.
function sendBack(wrId: number, step: WfStep, feedback: string): boolean {
  const wr = getWfRun(wrId)!;
  const wf = getWorkflow(wr.workflowId);
  const max = wf?.limits.maxLoops ?? 2;
  const target = step.onFail && step.onFail !== "stop" ? wr.steps.findIndex((s) => s.id === step.onFail) : -1;
  if (target < 1 || target >= wr.current) {
    stopWorkflow(wrId, `${stepTitle(step, agentRefs())} said it needs work, so the workflow stopped.`, { keepStep: true, detail: feedback });
    return false;
  }
  if (wr.loops >= max) {
    stopWorkflow(wrId, `It still needed work after ${max} ${max === 1 ? "round" : "rounds"} of fixes, so it stopped.`, { keepStep: true, detail: feedback });
    return false;
  }
  goBackTo(wrId, target, feedback, true);
  return true;
}

function goBackTo(wrId: number, target: number, feedback: string, countLoop: boolean) {
  const wr = getWfRun(wrId)!;
  const stepRuns = { ...wr.stepRuns };
  for (let i = target; i < wr.steps.length; i++) {
    const s = wr.steps[i];
    const cur = stepRuns[s.id] ?? freshStepRun();
    if (i > wr.current && cur.state === "todo") continue;
    stepRuns[s.id] = { ...cur, state: "todo", note: i === target ? "Going again with the feedback" : cur.note, rounds: cur.rounds + (i === target ? 1 : 0) };
  }
  updateWfRun(wrId, { stepRuns, current: target, feedback: feedback.slice(0, 6000), loops: wr.loops + (countLoop ? 1 : 0) });
}

// ---------- checks ----------

function runCheckStep(wrId: number, step: WfStep) {
  const wr = getWfRun(wrId)!;
  checking.add(wrId);
  setStep(wrId, step.id, { state: "now", startedAt: Date.now(), endedAt: null, note: "Running the checks…" });
  runChecks(wr.worktree!, step.checks ?? ["tests"], step.pagePath ?? "/")
    .then(async (results) => {
      checking.delete(wrId);
      const now = getWfRun(wrId);
      if (!now || now.status !== "running" || now.steps[now.current]?.id !== step.id) return;
      const failed = results.filter((r) => r.result === "failed");
      const skipped = results.filter((r) => r.result === "skipped");
      const note = results.map((r) => r.note).join(" ");
      await comment(now, `**Check** · ${results.map((r) => `${r.result === "passed" ? "✅" : r.result === "skipped" ? "➖" : "❌"} ${r.note}`).join("\n")}`);
      if (!failed.length) {
        updateWfRun(wrId, { gates: { ...now.gates, [step.id]: skipped.length ? "skipped" : "passed" }, current: now.current + 1 });
        setStep(wrId, step.id, { state: skipped.length === results.length ? "skipped" : "passed", endedAt: Date.now(), note });
        return advance(wrId);
      }
      updateWfRun(wrId, { gates: { ...now.gates, [step.id]: "failed" } });
      setStep(wrId, step.id, { state: "needs_work", endedAt: Date.now(), note });
      const detail = failed.map((r) => `${r.note}\n${r.detail.slice(-2500)}`).join("\n\n");
      if (sendBack(wrId, step, `A check failed:\n${detail}`)) return advance(wrId);
    })
    .catch((e) => {
      checking.delete(wrId);
      stopWorkflow(wrId, "The checks couldn't run.", { detail: String(e) });
    });
}

// ---------- the shared branch and pull request ----------

async function syncBranch(wrId: number) {
  const wr = getWfRun(wrId);
  const wf = wr && getWorkflow(wr.workflowId);
  if (!wr || !wf || !wr.worktree || !wr.branch || wr.branch === "main" || wr.branch === "master") return;
  const dir = wr.worktree;
  const base = await baseRef(dir);
  const ahead = await sh("git", ["rev-list", "--count", `${base}..HEAD`], dir);
  if (!ahead.ok || Number(ahead.out) === 0) return;
  const push = await sh("git", ["push", "-u", "origin", `HEAD:refs/heads/${wr.branch}`], dir);
  if (!push.ok) {
    console.warn("[workflow] push failed", push.err);
    return;
  }
  if (wr.prUrl) return;
  const agents = agentRefs();
  const done = wr.steps.filter((s) => ["done", "passed"].includes(wr.stepRuns[s.id]?.state ?? "") && s.type !== "start");
  const body = [
    wr.input ? `**Task:** ${wr.input}` : `**Workflow:** ${wf.name}`,
    "",
    `This pull request is the shared workspace for the **${wf.name}** workflow in agentbox. Each step adds its work and a comment here.`,
    "",
    `**The plan:** ${flowSentence(wf, agents)}`,
    ...(done.length ? ["", "**Done so far:**", ...done.map((s) => `- ${stepTitle(s, agents)}: ${wr.stepRuns[s.id]?.note ?? "done"}`)] : []),
    ...(wr.test ? ["", "_This is a test run. It stops before shipping._"] : []),
  ].join("\n");
  const title = `${wf.name}: ${(wr.input.split("\n")[0] || (wr.test ? "test run" : "run")).slice(0, 90)}`;
  const pr = await sh("gh", ["pr", "create", "--draft", "--base", base.replace(/^origin\//, ""), "--head", wr.branch, "--title", title, "--body", body], dir);
  const url = pr.out.split("\n").filter((l) => l.startsWith("http")).pop();
  if (url) updateWfRun(wrId, { prUrl: url });
  else console.warn("[workflow] couldn't open the pull request", pr.err);
}

async function comment(wr: WorkflowRun, body: string) {
  if (!wr.prUrl || !wr.worktree) return;
  await sh("gh", ["pr", "comment", wr.prUrl, "--body", `${body}\n\n<sub>Posted by agentbox</sub>`.slice(0, 60000)], wr.worktree);
}

async function ship(wrId: number, step: WfStep) {
  const wr = getWfRun(wrId)!;
  setStep(wrId, step.id, { state: "now", startedAt: Date.now(), note: "Merging the pull request…" });
  const dir = wr.worktree ?? projectPath(getWorkflow(wr.workflowId)?.project ?? "") ?? os.homedir();
  await sh("gh", ["pr", "ready", wr.prUrl!], dir);
  const m = await sh("gh", ["pr", "merge", wr.prUrl!, "--squash"], dir);
  if (!m.ok) {
    setStep(wrId, step.id, { state: "failed", endedAt: Date.now(), note: "GitHub wouldn't merge it." });
    return stopWorkflow(wrId, "GitHub wouldn't merge the pull request. It may have a conflict or need a review first.", { keepStep: true, detail: m.err });
  }
  setStep(wrId, step.id, { state: "done", endedAt: Date.now(), note: "Merged into main." });
  updateWfRun(wrId, { current: wr.current + 1, status: "running", waiting: null });
  import("./notices").then((m) => m.onWorkflowShipped(wrId)).catch((e) => console.warn("[workflow] notice", e));
  return advance(wrId);
}

async function tell(wr: WorkflowRun, step: WfStep): Promise<string> {
  const wf = getWorkflow(wr.workflowId)!;
  const earlier = wr.steps.slice(0, wr.current);
  const problems = earlier.some((s) => wr.stepRuns[s.id]?.outcome === "problems" || wr.gates[s.id] === "failed");
  if (step.tellWhen === "problems" && !problems) return "Skipped: nothing went wrong, so no message.";
  const agents = agentRefs();
  const lines = earlier
    .filter((s) => s.type !== "start" && wr.stepRuns[s.id]?.note)
    .map((s) => `• ${stepTitle(s, agents)}: ${wr.stepRuns[s.id].note}`);
  const report = earlier.map((s) => wr.stepRuns[s.id]).filter((r) => r?.outcome === "problems").map((r) => r!.runIds.at(-1)).filter(Boolean).map((id) => getRun(id!)?.result ?? "").join("\n\n");
  if (wr.test) return `Test run: it didn't send a message${step.openIssue && problems ? " or open an issue" : ""}.`;
  let issueUrl = "";
  if (step.openIssue && problems) {
    const dir = wr.worktree ?? projectPath(wf.project) ?? os.homedir();
    const r = await sh("gh", ["issue", "create", "--title", `${wf.name}: problems found ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, "--body", `${report || lines.join("\n")}\n\n<sub>Opened by the ${wf.name} workflow in agentbox</sub>`], dir);
    issueUrl = r.ok ? r.out.split("\n").filter((l) => l.startsWith("http")).pop() ?? "" : "";
  }
  const shippedIt = earlier.some((s) => s.type === "ship" && wr.stepRuns[s.id]?.state === "done");
  const name = `${wf.name}${wr.input ? `: ${wr.input.split("\n")[0].slice(0, 100)}` : ""}`;
  const title = shippedIt ? `Shipped: ${name}` : problems ? `Problems found: ${name}` : `Finished: ${name}`;
  const msg = [...lines.slice(-6).map((l) => l.slice(0, 400)), wr.prUrl ? `Pull request: ${wr.prUrl}` : "", issueUrl ? `Issue: ${issueUrl}` : ""].filter(Boolean).join("\n");
  const ok = await sendDiscord(msg, { title, url: wr.prUrl ?? undefined, ping: shippedIt ? "shipped" : undefined });
  return ok ? `Sent you a Discord message${issueUrl ? " and opened an issue" : ""}.` : `Couldn't send the Discord message${issueUrl ? ", but opened an issue" : ""}.`;
}

function ping(wr: WorkflowRun, text: string) {
  if (wr.test) return;
  const wf = getWorkflow(wr.workflowId);
  sendDiscord(`agentbox · ${wf?.name ?? "A workflow"} ${text}`);
}

// ---------- ending ----------

async function finish(wrId: number, summary?: string) {
  const wr = getWfRun(wrId);
  if (!wr) return;
  const merged = wr.steps.some((s) => s.type === "ship" && wr.stepRuns[s.id]?.state === "done");
  if (wr.prUrl && !merged && !wr.test && wr.worktree) await sh("gh", ["pr", "ready", wr.prUrl], wr.worktree);
  updateWfRun(wrId, {
    status: "done", endedAt: Date.now(), waiting: null,
    summary: summary ?? (merged ? "Shipped: merged into main." : wr.prUrl ? "Finished. The pull request has everything." : "Finished."),
  });
  await removeWorktree(wr);
  startNextQueued(wr.workflowId);
}

export function stopWorkflow(wrId: number, reason: string, opts: { byUser?: boolean; keepStep?: boolean; detail?: string } = {}) {
  const wr = getWfRun(wrId);
  if (!wr || !isActive(wr)) return;
  if (opts.detail) console.log(`[workflow ${wrId}] ${reason}\n${opts.detail.slice(0, 2000)}`);
  const step = wr.steps[wr.current];
  updateWfRun(wrId, { status: "stopped", stopReason: reason, endedAt: Date.now(), waiting: null, feedback: opts.detail ? opts.detail.slice(0, 6000) : wr.feedback });
  if (step && !opts.keepStep) {
    const sr = wr.stepRuns[step.id];
    if (sr && sr.state !== "done") setStep(wrId, step.id, { state: "failed", endedAt: Date.now(), note: reason });
  }
  // Stop the step's run if it's still going.
  for (const id of step ? wr.stepRuns[step.id]?.runIds ?? [] : []) {
    const r = getRun(id);
    if (r && ["queued", "working", "waiting"].includes(r.status)) stopRun(id, opts.byUser ? reason : "The workflow stopped.");
  }
  if (!opts.byUser) ping(wr, `stopped: ${reason}`);
  startNextQueued(wr.workflowId);
}

async function removeWorktree(wr: WorkflowRun) {
  if (!wr.worktree || !fs.existsSync(wr.worktree)) return;
  const wf = getWorkflow(wr.workflowId);
  const repo = wf && projectPath(wf.project);
  if (repo) await sh("git", ["worktree", "remove", "--force", wr.worktree], repo);
}

function startNextQueued(workflowId: number) {
  if (pausedAll()) return;
  const next = wfRunsWithStatus("queued").find((w) => w.workflowId === workflowId);
  if (next && !wfRunsWithStatus("running", "needs").some((w) => w.workflowId === workflowId)) {
    begin(next.id).catch((e) => stopWorkflow(next.id, "It couldn't get started.", { detail: String(e) }));
  }
}

// ---------- Nic's answers (Inbox / workflow page) ----------

export async function answer(wrId: number, action: "approve" | "send_back" | "stop", note?: string) {
  const wr = getWfRun(wrId);
  if (!wr || wr.status !== "needs" || !wr.waiting) throw new Error("This isn't waiting for you any more.");
  const step = wr.steps[wr.current];
  const waited = wr.waiting.until ? Date.now() - wr.waiting.until : 0;
  updateWfRun(wrId, { waitedMs: wr.waitedMs + Math.max(0, waited) });
  if (action === "stop") return stopWorkflow(wrId, "You stopped it.", { byUser: true });
  if (action === "approve") {
    if (wr.waiting.kind === "ship") {
      updateWfRun(wrId, { status: "running", waiting: null });
      return ship(wrId, step);
    }
    setStep(wrId, step.id, { state: "done", endedAt: Date.now(), note: "You said go ahead." });
    updateWfRun(wrId, { status: "running", waiting: null, current: wr.current + 1 });
    return advance(wrId);
  }
  // Send back: to the nearest earlier step that does the work.
  let target = -1;
  for (let i = wr.current - 1; i >= 1; i--) if (wr.steps[i].type === "agent") { target = i; break; }
  if (target < 0) for (let i = wr.current - 1; i >= 1; i--) if (["research", "review"].includes(wr.steps[i].type)) { target = i; break; }
  if (target < 0) throw new Error("There's no earlier step to send it back to. Use Stop instead.");
  setStep(wrId, step.id, { state: "needs_work", endedAt: Date.now(), note: "You sent it back." });
  updateWfRun(wrId, { status: "running", waiting: null });
  goBackTo(wrId, target, `Nic looked at it and sent it back${note?.trim() ? ` with this note:\n${note.trim()}` : "."}`, false);
  await comment(getWfRun(wrId)!, `**Nic sent this back**${note?.trim() ? `: ${note.trim()}` : "."}`);
  return advance(wrId);
}

// "Pick up where it stopped": continue a stopped run in the same copy and pull request.
export async function resumeWorkflow(wrId: number) {
  const wr = getWfRun(wrId);
  if (!wr || wr.status !== "stopped") throw new Error("Only a stopped run can be picked up again.");
  if (pausedAll()) throw new Error("Everything is paused. Press Resume everything at the top first.");
  if (!wr.worktree || !fs.existsSync(wr.worktree)) throw new Error("Its copy of the project is gone, so it can't pick up. Start it over instead.");
  if (activeWfRun(wr.workflowId)) throw new Error("This workflow is already running. Wait for it to finish first.");
  const step = wr.steps[wr.current];
  updateWfRun(wrId, {
    status: "running", stopReason: null, endedAt: null, loops: 0, waiting: null, summary: null,
    waitedMs: wr.waitedMs + Math.max(0, Date.now() - (wr.endedAt ?? Date.now())), usageStart: usageState().session,
  });
  const target = step && (step.type === "review" || step.type === "check") && wr.stepRuns[step.id]?.state === "needs_work" && step.onFail && step.onFail !== "stop" ? wr.steps.findIndex((x) => x.id === step.onFail) : -1;
  if (target >= 1 && target < wr.current && wr.feedback) goBackTo(wrId, target, wr.feedback, false);
  else if (step) setStep(wrId, step.id, { state: "todo", note: "Picking up where it stopped" });
  await advance(wrId);
}

export function stopAllWorkflowRuns(reason = PAUSED_ALL) {
  for (const wr of wfRunsWithStatus("queued", "running", "needs")) stopWorkflow(wr.id, reason, { byUser: true });
}

// ---------- background: schedules, triggers, retries ----------

export async function tickWorkflows(now = Date.now()) {
  if (pausedAll()) return;
  const noSchedule = process.env.AGENTBOX_NO_SCHEDULE === "1";

  // Steps waiting for usage, for a busy agent, or for checks that were cut off by a restart.
  for (const wr of wfRunsWithStatus("running")) {
    if (overLimits(wr)) continue;
    const step = wr.steps[wr.current];
    if (!step) continue;
    const sr = wr.stepRuns[step.id];
    if (wr.waiting?.kind === "usage" && !usageBlocked().blocked) {
      updateWfRun(wr.id, { waiting: null });
      advance(wr.id);
    } else if (wr.waiting?.kind === "agent") advance(wr.id);
    else if (step.type === "check" && sr?.state === "now" && !checking.has(wr.id)) advance(wr.id);
    else if (["agent", "research", "review"].includes(step.type) && sr?.state === "now") {
      // Missed the end of a step (e.g. a restart): look at its last run.
      const last = sr.runIds.at(-1);
      const r = last ? getRun(last) : null;
      if (!r) {
        setStep(wr.id, step.id, { state: "todo" });
        advance(wr.id);
      } else if (r.status === "done" || r.status === "stopped") onStepRunEnded(r.id);
    } else if (wr.worktree && !busy.has(wr.id) && sr?.state === "todo") advance(wr.id);
  }

  if (noSchedule) return;
  for (const wf of listWorkflows()) {
    if (!wf.enabled) continue;
    const start = wf.steps[0];
    if (start?.trigger !== "schedule") continue;
    const kind = start.scheduleKind ?? "daily";
    const next = () => nextRunAfter(kind, start.scheduleDays ?? [], start.scheduleTime ?? "02:00", now);
    if (wf.nextRunAt === null || wf.nextRunAt < now - 10 * 60_000) {
      setWorkflowNextRunAt(wf.id, next());
      continue;
    }
    if (wf.nextRunAt > now) continue;
    setWorkflowNextRunAt(wf.id, next());
    if (activeWfRun(wf.id)) continue;
    startWorkflow(wf.id, { trigger: "schedule" }).catch((e) => console.warn(`[workflow] ${wf.name}: ${(e as Error).message}`));
  }

  // GitHub triggers, every 2 minutes.
  if (now - (g.__wfLastPoll ?? 0) < 2 * 60_000) return;
  g.__wfLastPoll = now;
  for (const wf of listWorkflows()) {
    const start = wf.steps[0];
    if (!wf.enabled || (start?.trigger !== "issue_label" && start?.trigger !== "pr_opened")) continue;
    const dir = projectPath(wf.project);
    if (!dir) continue;
    try {
      await pollTrigger(wf, start, dir);
    } catch (e) {
      console.warn("[workflow] trigger check failed", e);
    }
  }
}

async function pollTrigger(wf: Workflow, start: WfStep, dir: string) {
  const first = !hasSeenAny(wf.id); // the first look after switching on only notes what's already there
  if (first) markSeen(wf.id, "baseline");
  if (start.trigger === "issue_label") {
    const r = await sh("gh", ["issue", "list", "--state", "open", "--label", start.label || "agent", "--json", "number,title,body,url", "--limit", "30"], dir, 30_000);
    if (!r.ok) return;
    for (const i of JSON.parse(r.out || "[]") as { number: number; title: string; body: string; url: string }[]) {
      if (!markSeen(wf.id, `issue:${i.number}`) || first) continue;
      await startWorkflow(wf.id, { trigger: "issue", triggerRef: i.url, input: `GitHub issue #${i.number}: ${i.title}\n\n${(i.body ?? "").slice(0, 4000)}\n\n${i.url}` }).catch(() => {});
    }
  } else {
    const r = await sh("gh", ["pr", "list", "--state", "open", "--json", "number,title,url,headRefName,isCrossRepository", "--limit", "30"], dir, 30_000);
    if (!r.ok) return;
    const own = `agent/wf-${slug(wf.name, 3)}-`;
    for (const p of JSON.parse(r.out || "[]") as { number: number; title: string; url: string; headRefName: string; isCrossRepository: boolean }[]) {
      if (p.isCrossRepository || p.headRefName.startsWith(own)) continue;
      if (!markSeen(wf.id, `pr:${p.number}`) || first) continue;
      await startWorkflow(wf.id, { trigger: "pr", triggerRef: `branch:${p.headRefName}`, prBranch: p.headRefName, input: `Pull request #${p.number}: ${p.title}\n${p.url}` }).catch(() => {});
    }
  }
}

export type { Run };
