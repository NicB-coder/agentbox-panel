import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  LOG_DIR, activeRun, addRunUsage, createRun, db, denyPendingForRun, getAgent, getRun, getSetting, listRuns, pendingApprovalForRun, runsWithStatus,
  updateRun,
} from "./db";
import { notify } from "./notify";
import { cleanup, exitInfo, isAlive, launch, readNew, stopProc, tail, type ProcExit, type ProcHandle } from "./proc";
import { projectPath } from "./projects";
import type { Agent, Allowed, Flow, Milestone, Model, Phase, ProcState, ReviewNote, Run, RunExtra, Step, StreamState, WorkMode } from "./types";
import { ingestRateLimitEvent, markLimited, usageBlocked, usageState } from "./usage";
import { researchFixPrompt, researchPrompt, researchReviewPrompt } from "./research";
import { clockOf } from "./words";

// One run = a copy of the project (git worktree) on its own branch + one or more Claude Code sessions in it.
// Each session is its own supervised launchd job (lib/proc.ts), so runs keep going while the panel restarts.
//
// Quick:    work → pull request
// Careful:  work → review (a different model) → fix (up to 2 rounds) → polish → final review → pull request
// Big job:  outline milestones → one fresh session per milestone (commit + push after each) → [Careful extras] → pull request
//
// Working → Needs you (waiting for an OK, or the pull request is open) → Done when merged.
// Usage limits never stop a run: it waits ("Waiting · back at 3:00 PM") and continues in the same session.
// Its own time limit does stop it, as "Ran out of time", with Keep going.

const WORKTREES = path.join(os.homedir(), "agents", "worktrees");
const BRIEFS = path.join(LOG_DIR, "..", "briefs");
const HOOK = path.join(process.cwd(), "scripts", "agentbox-hook.mjs");
const PANEL_URL = `http://127.0.0.1:${process.env.PORT || 3000}`;
const PATH = [path.join(os.homedir(), ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":");
const MAX_REVIEW_ROUNDS = 2;

type G = typeof globalThis & { __agentboxEnding?: Set<number> };
const ending: Set<number> = ((globalThis as G).__agentboxEnding ??= new Set()); // runs whose session end is being handled

const handle = (p: ProcState): ProcHandle => p;

// ---------- small helpers ----------

export function sh(cmd: string, args: string[], cwd: string, timeout = 120_000): Promise<{ ok: boolean; out: string; err: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, timeout, env: { ...cleanEnv(), GIT_TERMINAL_PROMPT: "0" }, maxBuffer: 10 * 1024 * 1024 }, (e, stdout, stderr) =>
      resolve({ ok: !e, out: String(stdout).trim(), err: String(stderr).trim() }),
    );
  });
}

// Don't leak this process's own Claude Code session settings (if any), or the panel's own settings, into agent runs.
export function cleanEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const k of Object.keys(env)) if (k === "CLAUDECODE" || k.startsWith("CLAUDE_CODE_") || k === "ANTHROPIC_API_KEY" || k.startsWith("AGENTBOX_") || k.startsWith("__NEXT")) delete env[k];
  for (const k of ["NEXT_DIST_DIR", "PORT", "NODE_ENV", "NEXT_RUNTIME", "NEXT_TELEMETRY_DISABLED"]) delete env[k];
  env.PATH = PATH;
  return env;
}

function logPath(runId: number) {
  return path.join(LOG_DIR, `${runId}.log`);
}

export function log(runId: number, line: string) {
  const t = new Date().toLocaleTimeString("en-US", { hour12: false });
  fs.appendFileSync(logPath(runId), `[${t}] ${line}\n`);
}

export function readLog(runId: number): string {
  try {
    return fs.readFileSync(logPath(runId), "utf8");
  } catch {
    return "";
  }
}

function slug(s: string, n: number) {
  return s
    .toLowerCase()
    .replace(/\b(main|master)\b/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .slice(0, n)
    .join("-");
}

const lookOnly = (allowed: Allowed, mode: WorkMode) => allowed === "look" || mode === "look";
const otherModel = (m: Model): Model => (m === "opus" ? "sonnet" : "opus");

// What this run actually uses: the agent's settings, unless a follow-up or workflow step overrides them.
export function eff(agent: Agent, run: Run): { allowed: Allowed; model: Model; maxMinutes: number; prompt: string; name: string; careful: boolean; big: boolean } {
  const x = run.extra ?? {};
  const research = agent.kind === "claude" && agent.job.kind === "research" && !run.workflowRunId;
  const look = research || lookOnly(x.allowed ?? agent.allowed, run.mode);
  return {
    allowed: research ? "look" : x.allowed ?? agent.allowed,
    model: x.model ?? agent.model,
    maxMinutes: x.maxMinutes ?? agent.maxMinutes,
    prompt: x.prompt ?? agent.prompt,
    name: agent.kind === "helper" ? x.label ?? "Workflow step" : agent.name,
    careful: x.careful ?? (agent.kind === "claude" && !run.workflowRunId ? agent.job.careful : false),
    big: !look && !run.workflowRunId && (x.big ?? (agent.kind === "claude" && agent.job.big && !x.followUp)),
  };
}

export function pausedAll(): boolean {
  return getSetting<boolean>("pausedAll", false);
}

function afterEnd(run: Run) {
  if (run.workflowRunId) import("./workflowRunner").then((m) => m.onStepRunEnded(run.id)).catch((e) => console.warn("[workflow]", e));
}

// The run's extra settings, merged (never overwritten wholesale: other code updates it too).
export function patchExtra(runId: number, patch: Partial<RunExtra>) {
  const run = getRun(runId);
  if (!run) return;
  updateRun(runId, { extra: { ...run.extra, ...patch } });
}

function patchFlow(runId: number, patch: Partial<Flow>) {
  const run = getRun(runId);
  if (!run?.extra.flow) return;
  patchExtra(runId, { flow: { ...run.extra.flow, ...patch } });
}

function stepsOf(labels: string[], now = 0): Step[] {
  return labels.map((label, i) => ({ label, state: i < now ? "done" : i === now ? "now" : "todo" }));
}

function defaultSteps(look: boolean): Step[] {
  return stepsOf(look ? ["Look around", "Check the details", "Write up what it found"] : ["Understand the problem", "Make the changes", "Check that it works", "Send a pull request"]);
}

// Careful mode shows its stages as the progress steps; the builder's own plan shows under "Build it".
const CAREFUL_STAGES = ["Build it", "Review", "Fix what it found", "Polish", "Final check", "Send the pull request"];
const CAREFUL_LOOK_STAGES = ["Look into it", "Double-check", "Write the report"];
const STAGE_INDEX: Partial<Record<Phase, number>> = { plan: 0, work: 0, review: 1, fix: 2, polish: 3, final: 4 };

function setStageSteps(runId: number, phase: Phase) {
  const run = getRun(runId);
  const flow = run?.extra.flow;
  if (!run || !flow?.careful) return;
  if (flow.big) return setBigSteps(runId);
  const agent = getAgent(run.agentId);
  const look = agent ? lookOnly(eff(agent, run).allowed, run.mode) : false;
  if (look) {
    const i = phase === "review" ? 1 : phase === "fix" ? 2 : 0;
    const research = agent?.job.kind === "research" && !run.workflowRunId;
    return updateRun(runId, { steps: stepsOf(research ? ["Research it", "Check it against the sources", "Correct the report"] : CAREFUL_LOOK_STAGES, i) });
  }
  const i = STAGE_INDEX[phase] ?? 0;
  updateRun(runId, { steps: stepsOf(CAREFUL_STAGES, i).map((s, j) => (j === 2 && i > 2 && flow.fixes === 0 ? { ...s, label: "Nothing to fix" } : s)) });
}

function setBigSteps(runId: number) {
  const run = getRun(runId);
  const big = run?.extra.flow?.big;
  if (!run || !big) return;
  const flow = run.extra.flow!;
  if (flow.stage === "outline" || !big.milestones.length) return updateRun(runId, { steps: [{ label: "Plan the milestones", state: "now" }] });
  const extras = flow.careful ? ["Review and polish"] : [];
  const labels = [...big.milestones.map((m) => m.title), ...extras, "Send the pull request"];
  const now = flow.stage === "milestone" ? big.index : ["review", "fix", "polish", "final"].includes(flow.stage) ? big.milestones.length : big.milestones.length + extras.length;
  updateRun(runId, { steps: labels.map((label, i) => ({ label, state: i < now ? "done" : i === now ? "now" : "todo" })) });
}

// ---------- starting a run ----------

export type StartOpts = {
  task?: string;
  mode?: WorkMode;
  trigger: Run["trigger"];
  project?: string; // workflow steps run in the workflow's project
  workflowRunId?: number;
  stepId?: string;
  extra?: RunExtra;
};

export const WAITING_FOR_USAGE = "Waiting for usage to reset";

export async function startRun(agentId: number, opts: StartOpts): Promise<Run> {
  const agent = getAgent(agentId);
  if (!agent || (agent.kind !== "claude" && agent.kind !== "helper")) throw new Error("This agent can't run tasks.");
  if (!agent.enabled) throw new Error("This agent is switched off. Turn it on in Settings first.");
  if (pausedAll()) throw new Error("Everything is paused. Press Resume everything at the top first.");
  if (agent.kind === "claude" && activeRun(agentId)) throw new Error("It's already working on something.");
  const project = opts.project ?? agent.project;
  const repo = projectPath(project);
  if (!repo && !(project === "" && agent.job.kind === "research")) throw new Error(`Can't find the project "${project}" on this Mac.`);

  const mode = opts.mode ?? agent.mode;
  const extra = opts.extra ?? {};
  const allowed = extra.allowed ?? agent.allowed;
  const firstOfJob = !opts.task?.trim() && opts.trigger === "manual" && agent.kind === "claude" && !listRuns(agentId, 1).length;
  const task = opts.task?.trim() || (opts.trigger === "schedule" ? "Scheduled run" : firstOfJob ? firstLine(agent.prompt).slice(0, 200) || "Its usual job" : "Its usual job");
  const blocked = usageBlocked();
  const held = opts.trigger === "schedule" ? heldBy(agent) : null;
  const run = createRun({
    agentId, task, mode, trigger: opts.trigger, steps: defaultSteps(lookOnly(allowed, mode)),
    status: blocked.blocked || held ? "queued" : "working",
    activity: held ? `Waiting for ${held} to finish` : blocked.blocked ? `${WAITING_FOR_USAGE}${blocked.until ? ` at ${clockOf(blocked.until)}` : ""}` : undefined,
    workflowRunId: opts.workflowRunId, stepId: opts.stepId, extra: { ...extra, project, ...(firstOfJob ? { jobStart: true } : {}), ...(held ? { held: true } : {}) },
  });
  const by = opts.trigger === "schedule" ? "the schedule" : opts.trigger === "workflow" ? "a workflow" : "Nic";
  log(run.id, `Run started by ${by} · task: ${task} · mode: ${mode} · allowed: ${allowed} · model: ${extra.model ?? agent.model}`);
  if (opts.trigger === "schedule") clearStaleScheduled(agent.id, run.id);
  if (held) {
    log(run.id, `A big job (${held}) is running and asked to hold small runs, so this waits for it.`);
    return getRun(run.id)!;
  }
  if (blocked.blocked) {
    log(run.id, blocked.reason === "guard" ? "Usage is past your limit in Settings, so it waits for the reset." : "Out of Claude usage, so it waits for the reset.");
    return getRun(run.id)!;
  }
  prepare(agent, getRun(run.id)!, repo).catch((e) => finishStopped(run.id, "It couldn't get started.", String(e)));
  return getRun(run.id)!;
}

// A newer scheduled run replaces older stopped ones in the Inbox (e.g. two old "ran out of time" cards).
function clearStaleScheduled(agentId: number, keep: number) {
  db().prepare("UPDATE runs SET dismissed = 1 WHERE agent_id = ? AND id != ? AND trigger = 'schedule' AND status = 'stopped'").run(agentId, keep);
}

// Is a big job running that asked to hold small scheduled runs? Its name, if so.
export function heldBy(agent: Agent): string | null {
  if (agent.job.big) return null;
  for (const r of runsWithStatus("working", "waiting", "queued")) {
    if (r.agentId === agent.id || !r.extra.flow?.big) continue;
    const a = getAgent(r.agentId);
    if (a?.job.big && a.job.holdSmall) return a.name;
  }
  return null;
}

// Starts runs that were waiting (for usage, or held for a big job), and continues ones waiting to resume.
export function startQueued() {
  if (pausedAll()) return;
  const now = Date.now();
  const u = usageState();
  const outOfUsage = u.limited && (u.limitedUntil ?? now + 1) > now;
  const guard = usageBlocked();
  for (const run of runsWithStatus("queued")) {
    const agent = getAgent(run.agentId);
    if (!agent) continue;
    if (run.extra.resume) {
      // Waiting to carry on (usage limit or a restart): at the reset time, or the 30-minute retry.
      const r = run.extra.resume;
      if (r.until > now) continue;
      if (r.why === "usage" && outOfUsage && (u.limitedUntil ?? 0) > r.until + 60_000) {
        patchExtra(run.id, { resume: { ...r, until: u.limitedUntil! + 60_000 } });
        updateRun(run.id, { activity: `Waiting · back at ${clockOf(u.limitedUntil! + 60_000)}` });
        continue;
      }
      log(run.id, r.why === "usage" ? "Usage should be back. Carrying on where it left off." : "Carrying on where it left off.");
      updateRun(run.id, { status: "working", activity: r.why === "usage" ? "Usage is back, carrying on…" : "Resumed after restart" });
      patchExtra(run.id, { resume: undefined, lastTickAt: Date.now() });
      launchPhase(run.id, r.phase, r.prompt, r.session).catch((e) => finishStopped(run.id, "It couldn't carry on.", String(e)));
      continue;
    }
    if (run.extra.held && heldBy(agent)) continue;
    if (guard.blocked) continue;
    if (agent.kind === "claude" && runsWithStatus("working", "waiting").some((r) => r.agentId === agent.id)) continue;
    const project = run.extra.project ?? agent.project;
    const repo = projectPath(project);
    if (!repo && project !== "") {
      finishStopped(run.id, `Can't find the project "${project}" on this Mac.`);
      continue;
    }
    log(run.id, run.extra.held ? "The big job is done. Starting now." : "Usage is back. Starting now.");
    updateRun(run.id, { status: "working", activity: "Getting ready…", startedAt: Date.now() });
    patchExtra(run.id, { held: false });
    prepare(agent, getRun(run.id)!, repo).catch((e) => finishStopped(run.id, "It couldn't get started.", String(e)));
  }
}

export async function baseRef(repo: string): Promise<string> {
  await sh("git", ["fetch", "origin", "--prune"], repo);
  const head = await sh("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], repo);
  if (head.ok && head.out) return head.out;
  for (const ref of ["origin/main", "origin/master", "HEAD"]) if ((await sh("git", ["rev-parse", "--verify", "--quiet", ref], repo)).ok) return ref;
  return "HEAD";
}

// Makes (or reuses) the copy to work in, then starts the first session.
async function prepare(agent: Agent, run: Run, repo: string | null) {
  const e = eff(agent, run);
  const look = lookOnly(e.allowed, run.mode);
  const flow: Flow = { careful: e.careful, stage: "work", round: 0, fixes: 0, reviews: [], polished: false, workSession: null };
  if (e.big) {
    flow.stage = "outline";
    const week = usageState().week;
    flow.big = { milestones: [], index: 0, handoff: "", weekCarry: 0, weekStart: week?.pct ?? null, lastWeek: week?.pct ?? null, budgetPct: agent.job.budgetPct };
  }
  patchExtra(run.id, { flow, activeMs: 0, lastTickAt: Date.now(), seq: run.extra.seq ?? 0 });

  if (run.extra.worktree) {
    // A workflow step: everyone works in the workflow's shared folder and branch.
    updateRun(run.id, { branch: run.extra.branch ?? null, worktree: run.extra.worktree, activity: "Reading the task…" });
    log(run.id, `Working in the workflow's shared copy on branch ${run.extra.branch}`);
  } else if (!repo) {
    // Research without a project: an empty folder of its own.
    const dir = path.join(os.homedir(), "agents", "research", `run-${run.id}`);
    fs.mkdirSync(dir, { recursive: true });
    log(run.id, `Working in its own empty folder ${dir}`);
    updateRun(run.id, { worktree: dir, activity: "Reading the question…" });
    putBrief(agent, dir);
  } else if (run.extra.checkoutRef) {
    // Look at someone else's branch (a pull request review): a detached copy, nothing is ever pushed from it.
    await sh("git", ["fetch", "origin", "--prune"], repo);
    const dir = path.join(WORKTREES, run.extra.project ?? agent.project, `review-${run.id}`);
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    const wt = await sh("git", ["worktree", "add", "--detach", dir, run.extra.checkoutRef], repo);
    if (!wt.ok) throw new Error(`git worktree add failed: ${wt.err}`);
    updateRun(run.id, { worktree: dir, activity: "Reading the pull request…" });
    log(run.id, `Looking at ${run.extra.checkoutRef} in ${dir}`);
  } else {
    const base = await baseRef(repo);
    const prev = run.extra.onBranch
      ? { branch: run.extra.onBranch.branch, prUrl: run.extra.onBranch.prUrl }
      : run.extra.followUp || run.trigger === "schedule"
        ? await continuation(agent, run, repo)
        : null;
    let branch: string;
    let dir: string;
    if (prev?.dir) {
      ({ branch, dir } = prev as { branch: string; dir: string });
      log(run.id, `Continuing the job in the same copy on branch ${branch}`);
    } else {
      branch = prev?.branch ?? `agent/${agent.slug}-${slug(run.task, 4) || "run"}-${run.id}`;
      dir = path.join(WORKTREES, run.extra.project ?? agent.project, `${branch.replace(/\//g, "-")}${prev?.branch ? `-${run.id}` : ""}`);
      fs.mkdirSync(path.dirname(dir), { recursive: true });
      const wt = prev?.branch
        ? await sh("git", ["worktree", "add", "-B", branch, dir, `origin/${branch}`], repo)
        : await sh("git", ["worktree", "add", "-b", branch, dir, base], repo);
      if (!wt.ok) throw new Error(`git worktree add failed: ${wt.err}`);
      log(run.id, prev?.branch ? `Made a fresh copy of the job's branch ${branch} (its pull request is still open)` : `Made a fresh copy on branch ${branch} from ${base} at ${dir}`);
    }
    updateRun(run.id, { branch, worktree: dir, activity: "Reading the task…", ...(prev?.prUrl ? { prUrl: prev.prUrl } : {}) });
    putBrief(agent, dir);
  }

  const fresh = getRun(run.id)!;
  if (e.big) return launchPhase(run.id, "outline", outlinePrompt(agent, fresh), null);
  if (run.mode === "plan" && !look) return launchPhase(run.id, "plan", buildPrompt(agent, fresh), null);
  return launchPhase(run.id, "work", buildPrompt(agent, fresh), null);
}

// Where a follow-up continues: the copy of an earlier run that stopped part-way, or the branch of a pull request that's still open.
async function continuation(agent: Agent, run: Run, repo: string): Promise<{ branch: string; dir?: string; prUrl?: string } | null> {
  const earlier = listRuns(agent.id, 20).filter((r) => r.id !== run.id && !r.workflowRunId && r.branch);
  for (const r of earlier) {
    if (r.status === "review" && r.prUrl) {
      const state = await sh("gh", ["pr", "view", r.prUrl, "--json", "state", "--jq", ".state"], repo, 30_000);
      if (state.ok && state.out !== "OPEN") continue;
      const dir = r.worktree && fs.existsSync(r.worktree) && !runsWithStatus("working", "waiting").some((x) => x.worktree === r.worktree) ? r.worktree : undefined;
      return { branch: r.branch!, dir, prUrl: r.prUrl };
    }
    if (r.status === "stopped" && r.worktree && fs.existsSync(r.worktree) && run.extra.followUp) return { branch: r.branch!, dir: r.worktree };
    if (r.status === "done" || r.status === "stopped") return null; // the last piece of this job is finished: start fresh
  }
  return null;
}

// A long brief is stored with the job and put in the copy as .agentbox/brief.md (never committed).
function putBrief(agent: Agent, dir: string) {
  try {
    fs.mkdirSync(path.join(dir, ".agentbox"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".agentbox", ".gitignore"), "*\n");
    if (agent.job.brief) fs.copyFileSync(path.join(BRIEFS, `agent-${agent.id}.md`), path.join(dir, ".agentbox", "brief.md"));
  } catch {
    /* no brief file */
  }
}

// ---------- what each session is told ----------

function panelRules(agent: Agent, run: Run): string[] {
  const project = run.extra.project ?? agent.project;
  if (project !== "agentbox-panel") return [];
  const port = 3200 + (run.id % 600);
  return [
    "",
    "This project is the agentbox panel itself, and the real panel is running right now (port 3000, from ~/projects/agentbox-panel). Never touch that folder, its database or the running panel, and never restart it.",
    `To try your changes, run your own dev copy from YOUR folder with its own data and port: AGENTBOX_DEV_DIR="$PWD/.agentbox/dev" AGENTBOX_DEV_PORT=${port} scripts/dev-copy.sh fresh   (it copies the database, turns schedules and Discord off, and serves on http://127.0.0.1:${port}). Stop it when you're done.`,
  ];
}

function rules(agent: Agent, run: Run, phase: Phase): string {
  const e = eff(agent, run);
  const reviewer = phase === "review" || phase === "final";
  const look = lookOnly(e.allowed, run.mode) || reviewer || phase === "outline";
  const lines = [
    reviewer
      ? "You are a reviewer started from Nic's agentbox panel. Another AI did the work; you check it. Nic is a high-school developer, so write in plain, friendly English without jargon."
      : `You are "${e.name}", an AI agent started from Nic's agentbox panel. Nic is a high-school developer who reads your progress in the panel, so write for him in plain, friendly English without jargon.`,
    "",
  ];
  if (!reviewer && phase !== "outline") {
    lines.push(
      "Progress lines (the panel reads these, put each on its own line):",
      `- Before you start, write: PLAN: first step | second step | third step   (3 to 5 short plain-English steps such as "Understand the problem", "Make the changes", "Test it in a browser"${look ? "" : ". Don't include sending a pull request, the panel does that"}).`,
      "- Each time you begin a step, write: STEP: <its number, starting at 1>",
      "- At the very end, write: SUMMARY: <one plain-English sentence saying what you did or found>",
      "",
    );
  }
  lines.push(`You are working in your own copy of the project${run.branch ? ` on the branch ${run.branch}` : ""}. Never push to main or master, never force push, and never touch secrets, tokens or passwords.`);
  if (look) lines.push("You may only LOOK: read, run read-only checks and report. Don't change, create or delete any files in the project, and don't commit or push. Your final message is what Nic (or the panel) reads.");
  else if (e.allowed === "suggest" || run.workflowRunId || e.big || e.careful) lines.push("Make your changes in this copy and commit them with a clear message. Don't push and don't open a pull request; the panel pushes your branch and opens the pull request for Nic.");
  else lines.push(`You may commit and push to your own branch (git push origin ${run.branch}). Never push anywhere else. The panel opens the pull request for Nic.`);
  lines.push(...panelRules(agent, run));
  return lines.join("\n");
}

function jobText(agent: Agent): string {
  const brief = agent.job.brief ? `\n\nNic attached a brief for this job (${agent.job.brief}). Read it first, all of it: .agentbox/brief.md in your folder. Don't commit that folder.` : "";
  return `Your job, in Nic's words:\n${agent.prompt}${brief}`;
}

function buildPrompt(agent: Agent, run: Run): string {
  if (run.workflowRunId) return `${eff(agent, run).prompt}`;
  if (agent.job.kind === "research") {
    const project = run.extra.project ?? agent.project;
    if (!run.extra.followUp) return researchPrompt(agent.prompt, { project: project || undefined, brief: !!agent.job.brief });
    const before = listRuns(agent.id, 5).find((r) => r.id !== run.id && r.status === "done" && r.result);
    return researchPrompt(
      `${run.task}\n\n(This follows up on Nic's earlier question: "${agent.prompt.slice(0, 1500)}". Your earlier report is below; build on it, don't repeat it.)\n\n<earlier-report>\n${(before?.result ?? "").slice(0, 20000)}\n</earlier-report>`,
      { project: project || undefined, brief: !!agent.job.brief },
    );
  }
  const job = jobText(agent);
  if (run.extra.followUp) {
    const earlier = listRuns(agent.id, 8).filter((r) => r.id !== run.id && !r.workflowRunId).reverse();
    const lines = earlier.map((r, i) => `${i + 1}. ${r.extra.jobStart ? "The job itself" : `"${r.task.slice(0, 300)}"`} → ${r.status === "stopped" ? `stopped (${r.stopReason ?? "no reason"})` : r.status === "review" ? "pull request open" : r.status}${r.result ? `: ${firstLine(r.result).slice(0, 300)}` : ""}${r.prUrl ? ` (${r.prUrl})` : ""}`);
    const pr = earlier.filter((r) => r.prUrl).at(-1)?.prUrl;
    return [
      job,
      "",
      "This is a follow-up on the same job. What happened so far:",
      ...(lines.length ? lines : ["(nothing yet)"]),
      "",
      run.branch ? `You're on the job's branch ${run.branch}, so the earlier work is already here (see git log).` : "",
      pr ? `Its pull request is ${pr}. Read it and its comments first: gh pr view ${pr} --comments` : "",
      "",
      `Nic's follow-up:\n${run.task}`,
    ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
  }
  if (run.extra.jobStart || run.task === "Its usual job" || run.task === "Scheduled run") return `${job}\n\nDo your job now.`;
  return `${job}\n\nThis time, Nic asked you to:\n${run.task}`;
}

function whatWasAsked(agent: Agent, run: Run): string {
  if (run.workflowRunId) return eff(agent, run).prompt.slice(0, 6000);
  const extra = run.extra.followUp || !(run.extra.jobStart || run.task === "Its usual job" || run.task === "Scheduled run") ? `\n\nThis time Nic asked for:\n${run.task}` : "";
  return `${jobText(agent)}${extra}`;
}

function reviewPrompt(agent: Agent, run: Run, base: string, final: boolean): string {
  const look = lookOnly(eff(agent, run).allowed, run.mode);
  if (agent.job.kind === "research" && !run.workflowRunId) return researchReviewPrompt(run.extra.followUp ? run.task : agent.prompt, run.result ?? "");
  if (look) {
    return [
      "An AI agent looked into something for Nic and wrote the report below. Double-check it before Nic reads it.",
      "",
      "What it was asked:",
      whatWasAsked(agent, run),
      "",
      "Its report:",
      "<report>",
      (run.result ?? "").slice(0, 30000),
      "</report>",
      "",
      "Check the important claims yourself (look at the files, run read-only checks, open the pages). Is anything wrong, missing or overstated? Don't change any files.",
      "Write a short list of what must be corrected (only real problems), then end with exactly one line:",
      "VERDICT: passed",
      "or",
      "VERDICT: needs work",
    ].join("\n");
  }
  return [
    `Another AI just did some work for Nic in this folder (branch ${run.branch ?? "this branch"}). You didn't write it. ${final ? "This is the final check before Nic sees it." : "Review it."}`,
    "",
    "What it was asked:",
    whatWasAsked(agent, run),
    "",
    `Look at what changed compared with ${base}: git diff ${base}...HEAD and git log ${base}..HEAD (and git status for anything not committed).`,
    "Check: does it do what was asked, completely? Are there bugs, broken or risky changes, or missing pieces? Does it actually work? Run the tests, or open the page or app if you can, without changing anything.",
    "Don't change any files. Write a short review in plain words: one line on what's good, then a numbered list of the specific things that must be fixed. Only real problems, not style preferences.",
    "End with exactly one line:",
    "VERDICT: passed",
    "or",
    "VERDICT: needs work",
  ].join("\n");
}

function fixPrompt(findings: string, look: boolean): string {
  return look
    ? `A reviewer (a different AI) double-checked your report and found these problems:\n\n${findings}\n\nCheck them, and write your whole report again with the corrections, from the top, as your final message. Keep the progress lines (PLAN, STEP, SUMMARY).`
    : `A reviewer (a different AI) checked your work and found these problems:\n\n${findings}\n\nFix them now, test that the fixes work, and commit. Keep the progress lines (PLAN, STEP, SUMMARY); the SUMMARY should say what you fixed.`;
}

const POLISH_PROMPT =
  "The work passed review. Now polish and optimize it without changing what it does or adding features: tidy the code, remove leftovers and debug output, make it faster or smoother where that's easy and safe, and if it's a page or a game check that it looks right on a phone too. Test that everything still works, then commit. Keep the progress lines (PLAN, STEP, SUMMARY); the SUMMARY should say what you polished.";

function outlinePrompt(agent: Agent, run: Run): string {
  return [
    whatWasAsked(agent, run),
    "",
    "This is a big job. Don't build anything yet. Read the job (and the brief if there is one) and look at the project, then split the work into milestones: 3 to 10 solid pieces, in order, each one something that can be built, tested and committed on its own.",
    "Reply with one line:",
    "MILESTONES: first milestone | second milestone | third milestone",
    "(each one under 10 words, plain English), then a short paragraph of notes for whoever builds them: the approach, the order, and anything tricky.",
  ].join("\n");
}

function milestonePrompt(agent: Agent, run: Run): string {
  const big = run.extra.flow!.big!;
  const m = big.milestones[big.index];
  const progress = big.milestones.map((x, i) => `${i + 1}. ${x.title} — ${x.state === "done" ? `done${x.summary ? `: ${x.summary}` : ""}` : i === big.index ? "YOU ARE DOING THIS ONE NOW" : "later"}`).join("\n");
  return [
    whatWasAsked(agent, run),
    "",
    `This is a big job, done milestone by milestone, each in a fresh session. The plan:\n${progress}`,
    "",
    big.handoff ? `Handoff notes from the last milestone:\n${big.handoff}\n` : "",
    "The progress so far is also in .agentbox/progress.md. Earlier milestones are already committed on this branch (see git log).",
    "",
    `Your milestone now (${big.index + 1} of ${big.milestones.length}): ${m.title}`,
    "Do only this milestone, completely. Test it. Commit your work with a clear message.",
    "At the very end write:",
    "HANDOFF: <notes for whoever does the next milestone: what's done, what's next, anything tricky or unfinished>",
    "SUMMARY: <one plain-English sentence on what you did>",
  ].filter((l) => l !== "").join("\n");
}

function writeProgressFile(run: Run) {
  const big = run.extra.flow?.big;
  if (!big || !run.worktree) return;
  const lines = [
    "# Progress (written by agentbox)",
    "",
    ...big.milestones.map((m, i) => `- [${m.state === "done" ? "x" : " "}] ${i + 1}. ${m.title}${m.summary ? ` — ${m.summary}` : ""}`),
    "",
    big.handoff ? `## Last handoff\n\n${big.handoff}` : "",
  ];
  try {
    fs.mkdirSync(path.join(run.worktree, ".agentbox"), { recursive: true });
    fs.writeFileSync(path.join(run.worktree, ".agentbox", "progress.md"), lines.join("\n"));
  } catch {
    /* the copy is gone */
  }
}

// ---------- launching one session ----------

function permissionMode(mode: WorkMode, phase: Phase): string {
  if (phase === "plan") return "plan";
  if (phase === "review" || phase === "final" || phase === "outline") return "auto";
  if (mode === "ask") return "manual"; // every step that needs permission goes to Nic via the hook
  return "auto"; // auto, look (with write tools removed), and plan after approval
}

const freshStream = (): StreamState => ({ result: null, sawStepMarker: false, edited: false, limited: false, authError: false });

export async function launchPhase(runId: number, phase: Phase, prompt: string, resume: string | null) {
  const run = getRun(runId);
  const agent = run && getAgent(run.agentId);
  if (!run || !agent || !run.worktree) throw new Error("The run or its copy of the project is missing.");
  const e = eff(agent, run);
  const reviewer = phase === "review" || phase === "final";
  const look = lookOnly(e.allowed, run.mode) || reviewer || phase === "outline";
  const model = reviewer ? otherModel(e.model) : e.model;
  const settings = {
    hooks: {
      PreToolUse: [
        { matcher: "Bash", hooks: [{ type: "command", command: `node "${HOOK}"`, timeout: 30 }] },
        { matcher: "mcp__.*", hooks: [{ type: "command", command: `node "${HOOK}"`, timeout: 4 * 3600 }] },
      ],
      PermissionRequest: [{ matcher: "*", hooks: [{ type: "command", command: `node "${HOOK}"`, timeout: 4 * 3600 }] }],
    },
  };
  const args = [
    "-p", prompt,
    "--output-format", "stream-json",
    "--verbose",
    "--model", model,
    "--permission-mode", permissionMode(run.mode, phase),
    "--settings", JSON.stringify(settings),
    "--append-system-prompt", rules(agent, run, phase),
  ];
  const deny = ["Bash(git push --force*)", "Bash(git push -f*)", "Bash(git push * main*)", "Bash(git push * master*)", "Bash(gh pr merge *)"];
  if (look) deny.push("Edit", "Write", "NotebookEdit", "Bash(git commit *)", "Bash(git push *)");
  else if (e.allowed === "suggest" || run.workflowRunId || e.big || e.careful) deny.push("Bash(git push *)", "Bash(gh pr create *)");
  const { connectorDenies } = await import("./connectors");
  deny.push(...connectorDenies(run.extra.connectors ?? (agent.kind === "claude" && !run.workflowRunId ? agent.job.connectors : [])));
  args.push("--disallowedTools", ...deny);
  if (resume) args.push("--resume", resume);

  const seq = (run.extra.seq ?? 0) + 1;
  const env = {
    ...cleanEnv(),
    AGENTBOX_URL: PANEL_URL, AGENTBOX_RUN_ID: String(run.id), AGENTBOX_ALLOWED: look ? "look" : e.allowed === "make" && !e.big && !e.careful && !run.workflowRunId ? "make" : "suggest",
    AGENTBOX_PHASE: phase,
  };
  const h = await launch(`run-${run.id}-${seq}`, "claude", args, run.worktree, env);
  const proc: ProcState = { ...h, phase, offset: 0, state: freshStream(), session: resume, prompt };
  patchExtra(run.id, { proc, seq, last: { phase, prompt, session: resume }, stopReq: null, lastTickAt: Date.now() });
  patchFlow(run.id, { stage: phase });
  updateRun(run.id, { status: "working", pid: null });
  const flow = getRun(run.id)!.extra.flow;
  if (flow?.big) setBigSteps(run.id);
  else if (flow?.careful) setStageSteps(run.id, phase);
  const who = model === "opus" ? "Opus" : "Sonnet";
  const words: Record<Phase, string> = {
    plan: "planning", work: "working", review: `reviewing with ${who}`, fix: "fixing what the review found",
    polish: "polishing", final: `final check with ${who}`, outline: "planning the milestones", milestone: "working on a milestone",
  };
  log(run.id, `Starting Claude Code (${words[phase]}, permission mode ${permissionMode(run.mode, phase)}${resume ? ", continuing the same session" : ""}) as ${h.label}`);
  if (reviewer) updateRun(run.id, { activity: phase === "final" ? "Final check by a second AI…" : "A second AI is reviewing the work…" });
  if (phase === "polish") updateRun(run.id, { activity: "Polishing and optimizing…" });
  if (phase === "fix") updateRun(run.id, { activity: "Fixing what the review found…" });
  if (phase === "outline") updateRun(run.id, { activity: "Planning the milestones…" });
}

// ---------- watching sessions (every second) ----------

export function pumpRuns() {
  const now = Date.now();
  for (const run of runsWithStatus("working")) {
    const p = run.extra.proc;
    if (!p) {
      // Never got its session going (e.g. the panel restarted while it was preparing the copy).
      if (now - (run.extra.lastTickAt ?? run.startedAt) > 10 * 60_000 && !ending.has(run.id)) finishStopped(run.id, "It got stuck before it started. Try again.");
      continue;
    }
    if (ending.has(run.id)) continue;
    const { lines, offset } = readNew(p.out, p.offset);
    const state = { ...p.state };
    for (const line of lines) onEvent(run.id, line, state, p.phase);
    const pending = pendingApprovalForRun(run.id);
    // Time spent working (not waiting for Nic). Capped per tick so a sleeping Mac doesn't count.
    const tick = Math.min(Math.max(0, now - (run.extra.lastTickAt ?? now)), 60_000);
    const activeMs = (run.extra.activeMs ?? 0) + (pending ? 0 : tick);
    const fresh = getRun(run.id)!;
    const cur = fresh.extra.proc ?? p;
    patchExtra(run.id, { proc: { ...cur, offset, state }, activeMs, lastTickAt: now });

    const agent = getAgent(run.agentId);
    const e = agent ? eff(agent, fresh) : null;
    if (e && !e.big && !fresh.extra.stopReq && activeMs > e.maxMinutes * 60_000) {
      log(run.id, `It ran out of time (the limit is ${e.maxMinutes} minutes of work).`);
      patchExtra(run.id, { outOfTime: true });
      stopRun(run.id, OUT_OF_TIME);
      continue;
    }
    if (e?.big && fresh.extra.flow?.big && !fresh.extra.stopReq) {
      const used = bigUsage(fresh);
      if (used !== null && used > fresh.extra.flow.big.budgetPct) {
        log(run.id, `It used about ${used}% of your weekly usage, more than its budget of ${fresh.extra.flow.big.budgetPct}%.`);
        patchExtra(run.id, { overBudget: true });
        stopRun(run.id, OVER_BUDGET);
        continue;
      }
    }
    const exit = exitInfo(handle(p));
    if (exit) endPhase(run.id, exit);
    else if (!isAlive(handle(p))) endPhase(run.id, { code: null, signal: "lost", at: now });
  }
}

// How much of the weekly meter a big job has used (carried across weekly resets).
export function bigUsage(run: Run): number | null {
  const big = run.extra.flow?.big;
  const week = usageState().week;
  if (!big || !week || big.weekStart === null) return null;
  let { weekStart, weekCarry } = big;
  const { lastWeek } = big;
  if (lastWeek !== null && week.pct < lastWeek - 5) {
    // The week reset: keep what was used, count again from 0.
    weekCarry += Math.max(0, lastWeek - weekStart);
    weekStart = 0;
  }
  if (week.pct !== lastWeek) patchFlow(run.id, { big: { ...big, weekStart, weekCarry, lastWeek: week.pct } });
  return Math.round(weekCarry + Math.max(0, week.pct - weekStart));
}

// ---------- reading Claude's stream ----------

const PLAIN_TOOL: Record<string, string> = {
  Read: "Reading the code",
  Grep: "Searching the code",
  Glob: "Looking through the files",
  Edit: "Making changes",
  MultiEdit: "Making changes",
  Write: "Writing a file",
  NotebookEdit: "Making changes",
  WebFetch: "Reading a web page",
  WebSearch: "Searching the web",
  TodoWrite: "Planning its next steps",
  Task: "Getting a helper to look into something",
  Agent: "Getting a helper to look into something",
};

function onEvent(runId: number, line: string, state: StreamState, phase: Phase) {
  let ev: Record<string, unknown>;
  try {
    ev = JSON.parse(line);
  } catch {
    log(runId, line.slice(0, 2000));
    return;
  }
  const run = getRun(runId);
  if (!run) return;
  const builder = phase !== "review" && phase !== "final" && phase !== "outline";
  if (ev.type === "system" && ev.subtype === "init") {
    if (builder) updateRun(runId, { sessionId: String(ev.session_id) });
    const p = run.extra.proc;
    if (p) patchExtra(runId, { proc: { ...p, session: String(ev.session_id) } });
    log(runId, `Session ${ev.session_id} · model ${ev.model} · permission mode ${ev.permissionMode}`);
    return;
  }
  if (ev.type === "assistant") {
    const content = ((ev.message as { content?: unknown[] })?.content ?? []) as { type: string; text?: string; name?: string; input?: Record<string, unknown> }[];
    for (const c of content) {
      if (c.type === "text" && c.text) {
        log(runId, `Claude: ${c.text}`);
        if (builder) readMarkers(runId, c.text, state);
      } else if (c.type === "tool_use" && c.name) {
        const input = c.input ?? {};
        log(runId, `Tool ${c.name}: ${JSON.stringify(input).slice(0, 1500)}`);
        let activity = PLAIN_TOOL[c.name] ?? "Working on it";
        if (c.name === "Bash") activity = typeof input.description === "string" && input.description ? sentence(input.description) : "Running a check";
        if (c.name.startsWith("mcp__")) activity = "Using a connected app";
        updateRun(runId, { activity: `${phase === "review" || phase === "final" ? "Reviewing: " : ""}${activity}…` });
        if (!builder) continue;
        // No progress lines from the agent? Move the default steps along by what it's doing.
        if (!state.sawStepMarker && /^(Edit|MultiEdit|Write|NotebookEdit)$/.test(c.name) && !state.edited) {
          state.edited = true;
          setStep(runId, 1);
        } else if (!state.sawStepMarker && state.edited && c.name === "Bash") setStep(runId, 2);
      }
    }
    return;
  }
  if (ev.type === "user") {
    const content = ((ev.message as { content?: unknown[] })?.content ?? []) as { type: string; content?: unknown; is_error?: boolean }[];
    for (const c of content) {
      if (c.type === "tool_result") {
        const text = typeof c.content === "string" ? c.content : JSON.stringify(c.content);
        log(runId, `${c.is_error ? "Tool error" : "Tool result"}: ${text.slice(0, 1500)}`);
      }
    }
    return;
  }
  if (ev.type === "result") {
    state.result = { text: String(ev.result ?? ""), isError: !!ev.is_error, subtype: String(ev.subtype ?? "") };
    if (ev.session_id && builder) updateRun(runId, { sessionId: String(ev.session_id) });
    const u = (ev.usage ?? {}) as Record<string, number>;
    const tokens = (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    addRunUsage(runId, Number(ev.total_cost_usd ?? 0), tokens);
    log(runId, `Finished: ${ev.subtype}${ev.is_error ? " (error)" : ""} · ${Math.round(Number(ev.duration_ms ?? 0) / 1000)}s · ${tokens} tokens`);
    return;
  }
  if (ev.type === "rate_limit_event") {
    const info = (ev.rate_limit_info ?? {}) as Record<string, unknown>;
    ingestRateLimitEvent(info);
    if (info.status === "rejected") {
      state.limited = true;
      log(runId, "Claude says the usage limit is reached.");
    }
    return;
  }
  log(runId, `${ev.type}${ev.subtype ? `/${ev.subtype}` : ""}`);
}

function sentence(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/\.$/, "");
}

function readMarkers(runId: number, text: string, state: StreamState) {
  const run = getRun(runId);
  if (!run) return;
  const flow = run.extra.flow;
  const nested = !!flow && (flow.careful || !!flow.big); // the builder's own plan goes under the current stage
  const plan = text.match(/^\s*PLAN:\s*(.+)$/m);
  if (plan) {
    const look = run.steps.length && run.steps[run.steps.length - 1].label !== "Send a pull request";
    const labels = plan[1].split("|").map((s) => s.trim().replace(/\*+/g, "")).filter(Boolean).slice(0, 6);
    if (labels.length) {
      if (nested) patchFlow(runId, { subSteps: stepsOf(labels) });
      else {
        if (!look) labels.push("Send a pull request");
        updateRun(runId, { steps: stepsOf(labels) });
      }
      state.sawStepMarker = true;
    }
  }
  const steps = [...text.matchAll(/^\s*STEP:\s*(\d+)/gm)];
  if (steps.length) {
    state.sawStepMarker = true;
    setStep(runId, Number(steps[steps.length - 1][1]) - 1);
  }
  const summary = text.match(/^\s*SUMMARY:\s*(.+)$/m);
  if (summary) updateRun(runId, { result: summary[1].trim() });
  // Use its latest plain sentence as the "what it's doing" line, if it's short and not a marker.
  const prose = text.split("\n").map((l) => l.trim()).filter((l) => l && !/^(PLAN|STEP|SUMMARY|HANDOFF|MILESTONES):/.test(l) && !l.startsWith("```") && l.length < 160);
  if (prose.length && !summary) updateRun(runId, { activity: prose[prose.length - 1].replace(/[*_`#]/g, "") });
}

function setStep(runId: number, index: number) {
  const run = getRun(runId);
  if (!run) return;
  const flow = run.extra.flow;
  if (flow && (flow.careful || flow.big)) {
    if (!flow.subSteps?.length) return;
    const i = Math.max(0, Math.min(index, flow.subSteps.length - 1));
    return patchFlow(runId, { subSteps: flow.subSteps.map((s, j) => ({ ...s, state: j < i ? "done" : j === i ? "now" : "todo" })) });
  }
  if (!run.steps.length) return;
  const i = Math.max(0, Math.min(index, run.steps.length - 1));
  updateRun(runId, { steps: run.steps.map((s, j) => ({ ...s, state: j < i ? "done" : j === i ? "now" : "todo" })) });
}

function allStepsDone(runId: number) {
  const run = getRun(runId);
  if (run) updateRun(runId, { steps: run.steps.map((s) => ({ ...s, state: "done" })) });
}

function stripMarkers(text: string) {
  return text.replace(/^\s*(PLAN|STEP|SUMMARY):.*$/gm, "").replace(/^\s*HANDOFF:[\s\S]*?(?=^\s*SUMMARY:|$(?![\s\S]))/m, "").trim();
}

// ---------- when a session ends ----------

export const USAGE_STOP = "It ran out of Claude usage.";
export const OUT_OF_TIME = "Ran out of time";
export const OVER_BUDGET = "It used its usage budget";
export const PAUSED_ALL = "You paused everything.";
export const RESTARTED = "The panel restarted while it was working.";
export const SIGN_IN_CLAUDE = "Claude Code needs signing in again.";
const isUsageLimit = (s: string) => /usage limit|limit reached|hit your limit|rate limit|quota|out of (extra )?usage|limit will reset/i.test(s);
const isAuthError = (s: string) => /not logged in|authenticat|invalid api key|please run \/login|oauth token (has )?expired|log ?in again/i.test(s);

function plainError(text: string, stderr: string, subtype: string): string {
  const all = `${text}\n${stderr}`.toLowerCase();
  if (isUsageLimit(all)) return USAGE_STOP;
  if (isAuthError(all)) return SIGN_IN_CLAUDE;
  if (subtype === "error_max_turns") return "It took too many steps and gave up.";
  if (/overloaded|529|internal server error/.test(all)) return "Claude was too busy. Try again in a bit.";
  return "It ran into a problem and stopped.";
}

function endPhase(runId: number, exit: ProcExit) {
  if (ending.has(runId)) return;
  ending.add(runId);
  onPhaseExit(runId, exit)
    .catch((e) => finishStopped(runId, "Something went wrong while wrapping up.", String(e)))
    .finally(() => ending.delete(runId));
}

async function onPhaseExit(runId: number, exit: ProcExit) {
  let run = getRun(runId);
  const agent = run && getAgent(run.agentId);
  const p = run?.extra.proc;
  if (!run || !agent || !p) return;
  // Read anything left in its output.
  const { lines } = readNew(p.out, p.offset);
  const st = { ...p.state };
  for (const line of lines) onEvent(runId, line, st, p.phase);
  run = getRun(runId)!;
  const latest = run.extra.proc ?? p;
  const stderr = tail(p.err, 4000);
  if (stderr.trim()) log(runId, `stderr: ${stderr.trim().slice(-1500)}`);
  log(runId, exit.signal === "lost" ? "Its session was cut off (the Mac or the panel restarted)." : `Claude Code exited (code ${exit.code}${exit.signal ? `, signal ${exit.signal}` : ""})`);
  const session = latest.session ?? null;
  patchExtra(runId, { proc: undefined, last: { phase: p.phase, prompt: p.prompt, session } });
  cleanup(handle(p)).catch(() => {});

  if (run.extra.stopReq?.startsWith("__usage:")) {
    const until = Number(run.extra.stopReq.slice(8));
    patchExtra(runId, { stopReq: null });
    return waitForUsage(runId, p.phase, session, p.prompt, "", until);
  }
  if (run.extra.stopReq) return finishStopped(runId, run.extra.stopReq);
  if (exit.signal === "lost") {
    // The Mac (or launchd) stopped it under us: carry on in the same conversation.
    const prompt = session ? "You were interrupted because this Mac or the agentbox panel restarted. Carry on where you left off: check git status and what you've already done first. Keep the progress lines." : p.prompt;
    log(runId, "Resuming after the restart.");
    updateRun(runId, { activity: "Resumed after restart" });
    return launchPhase(runId, p.phase, prompt, session);
  }
  const res = st.result;
  if (!res || res.isError || (exit.code !== 0 && exit.code !== null)) {
    const reason = st.limited && (!res || res.isError) ? USAGE_STOP : plainError(res?.text ?? "", stderr, res?.subtype ?? "");
    if (reason === USAGE_STOP) return waitForUsage(runId, p.phase, session, p.prompt, `${res?.text ?? ""}\n${stderr}`);
    if (reason === SIGN_IN_CLAUDE) patchExtra(runId, { signIn: "claude" });
    return finishStopped(runId, reason);
  }
  return next(runId, p.phase, res.text, session);
}

// Dev copy tests only: stop the current session as if Claude said the usage limit was reached, with a reset soon.
export function simulateUsageLimit(runId: number, seconds: number) {
  const run = getRun(runId);
  if (!run?.extra.proc) throw new Error("It isn't running a session right now.");
  log(runId, `(test) Pretending the usage limit was reached; it resets in ${seconds} seconds.`);
  patchExtra(runId, { stopReq: `__usage:${Date.now() + seconds * 1000}` });
  stopProc(handle(run.extra.proc));
}

// Out of usage: wait in the same copy and conversation, then carry on by itself.
function waitForUsage(runId: number, phase: Phase, session: string | null, prompt: string, text: string, testUntil?: number) {
  if (!testUntil) markLimited(text);
  const u = usageState();
  const until = testUntil ?? (u.limitedUntil && u.limitedUntil > Date.now() ? u.limitedUntil + 60_000 : Date.now() + 30 * 60_000);
  const resumePrompt = session ? "You were paused because Claude's usage limit was reached. It's back now. Carry on exactly where you left off: check git status and what you've already done first. Keep the progress lines." : prompt;
  patchExtra(runId, { resume: { phase, prompt: resumePrompt, session, until, why: "usage" } });
  updateRun(runId, { status: "queued", activity: `Waiting · back at ${clockOf(until)}` });
  log(runId, `Out of Claude usage. It waits and carries on by itself at ${clockOf(until)}.`);
}

// What comes after a session that finished well.
async function next(runId: number, phase: Phase, text: string, session: string | null) {
  const run = getRun(runId)!;
  const agent = getAgent(run.agentId)!;
  const e = eff(agent, run);
  const look = lookOnly(e.allowed, run.mode);
  const flow: Flow = run.extra.flow ?? { careful: false, stage: phase, round: 0, fixes: 0, reviews: [], polished: false, workSession: null };

  if (phase === "plan") {
    const plan = stripMarkers(text) || "(It didn't write a plan.)";
    updateRun(runId, { status: "waiting", plan, activity: "Waiting for your OK on its plan", pid: null });
    patchFlow(runId, { workSession: session });
    log(runId, "Plan ready, waiting for Nic.");
    notify(agent, "needs_ok", `has a plan for “${run.task}” and is waiting for your OK.`);
    return;
  }

  if (phase === "outline") {
    const m = text.match(/^\s*MILESTONES:\s*(.+)$/m);
    const titles = (m?.[1] ?? "").split("|").map((s) => s.trim().replace(/\*+/g, "")).filter(Boolean).slice(0, 12);
    if (!titles.length) return finishStopped(runId, "It couldn't split the job into milestones.", text.slice(0, 2000));
    const notes = text.replace(/^\s*MILESTONES:.*$/m, "").trim();
    const big = { ...flow.big!, milestones: titles.map((title) => ({ title, state: "todo" as const })), index: 0, handoff: notes ? `Notes from planning: ${notes.slice(0, 3000)}` : "" };
    patchFlow(runId, { big });
    log(runId, `Milestones: ${titles.join(" | ")}`);
    return startMilestone(runId);
  }

  if (phase === "milestone") {
    const big = flow.big!;
    const handoff = text.match(/^\s*HANDOFF:\s*([\s\S]*?)(?=^\s*SUMMARY:|$(?![\s\S]))/m)?.[1]?.trim() ?? "";
    const summary = getRun(runId)!.result ?? firstLine(stripMarkers(text));
    const milestones: Milestone[] = big.milestones.map((m, i) => (i === big.index ? { ...m, state: "done", summary: summary.slice(0, 300) } : m));
    const nextIndex = big.index + 1;
    patchFlow(runId, { big: { ...big, milestones, handoff: handoff.slice(0, 6000) || big.handoff, index: nextIndex }, subSteps: [] });
    await commitAll(getRun(runId)!, `Milestone ${big.index + 1}: ${big.milestones[big.index].title}`);
    await checkpoint(runId, `finished milestone ${big.index + 1} of ${big.milestones.length}: ${big.milestones[big.index].title}. ${summary}`);
    if (nextIndex < big.milestones.length) return startMilestone(runId);
    patchFlow(runId, { workSession: session });
    updateRun(runId, { result: `Finished all ${big.milestones.length} milestones: ${big.milestones.map((m) => m.title).join(", ")}.` });
    if (flow.careful) return startReview(runId, false);
    return finishBuild(runId);
  }

  if (phase === "review" || phase === "final") {
    const verdict: ReviewNote["verdict"] = /VERDICT:\s*needs work/i.test(text) ? "needs work" : /VERDICT:\s*passed/i.test(text) ? "passed" : /needs work|must fix|should be fixed/i.test(text) ? "needs work" : "passed";
    const body = text.replace(/^\s*VERDICT:.*$/gim, "").trim();
    const note: ReviewNote = { kind: phase === "final" ? "final" : "review", verdict, text: body.slice(0, 8000), at: Date.now(), model: otherModel(e.model) };
    const reviews = [...flow.reviews, note];
    const round = phase === "review" ? flow.round + 1 : flow.round;
    patchFlow(runId, { reviews, round, fixedSinceReview: false });
    log(runId, `${phase === "final" ? "Final check" : `Review round ${round}`}: ${verdict}`);
    if (look) {
      const research = agent.job.kind === "research" && !run.workflowRunId;
      if (verdict === "needs work" && flow.fixes === 0 && flow.workSession) return launchPhase(runId, "fix", research ? researchFixPrompt(body) : fixPrompt(body, true), flow.workSession);
      return finishLook(runId, getRun(runId)!.result ?? "");
    }
    if (phase === "final") {
      if (verdict === "needs work" && !flow.lastFix && flow.workSession) {
        patchFlow(runId, { lastFix: true });
        return launchPhase(runId, "fix", fixPrompt(body, false), flow.workSession);
      }
      return finishBuild(runId);
    }
    if (verdict === "needs work" && round <= MAX_REVIEW_ROUNDS && flow.workSession) return launchPhase(runId, "fix", fixPrompt(body, false), flow.workSession);
    return launchPhase(runId, "polish", POLISH_PROMPT, flow.workSession);
  }

  // A builder session finished: work, fix, polish.
  const fresh = getRun(runId)!;
  const summary = fresh.result || firstLine(stripMarkers(text)) || "Finished.";
  if (phase === "work") patchFlow(runId, { workSession: session, workSummary: summary });
  if (phase === "fix") patchFlow(runId, { fixes: flow.fixes + 1, fixedSinceReview: true });
  if (phase === "polish") patchFlow(runId, { polished: true });

  if (look) {
    // Keep the full report; a fix rewrites it.
    const report = stripMarkers(text);
    const research = agent.job.kind === "research" && !fresh.workflowRunId;
    const result = research ? report || summary : fresh.result && report && !report.startsWith(fresh.result) ? `${fresh.result}\n\n${report}` : report || summary;
    updateRun(runId, { result });
    if (flow.careful && phase === "work") return startReview(runId, false);
    return finishLook(runId, result);
  }

  if (!flow.careful) {
    if (fresh.workflowRunId) return finishStep(agent, fresh, summary, stripMarkers(text));
    return shipIt(agent, fresh, summary);
  }
  await commitAll(fresh, phase === "work" ? fresh.task : phase === "fix" ? "Fix what the review found" : "Polish and optimize");
  if (phase === "work") {
    if (!(await hasChanges(getRun(runId)!))) {
      log(runId, "It didn't change anything, so there's nothing to review.");
      if (fresh.workflowRunId) return finishStep(agent, getRun(runId)!, summary, stripMarkers(text));
      return shipIt(agent, getRun(runId)!, summary);
    }
    return startReview(runId, false);
  }
  if (phase === "fix") {
    if (flow.lastFix) return finishBuild(runId);
    return startReview(runId, false);
  }
  return startReview(runId, true); // after polishing: the final check
}

async function startReview(runId: number, final: boolean) {
  const run = getRun(runId)!;
  const agent = getAgent(run.agentId)!;
  const base = run.workflowRunId ? "origin/HEAD" : await baseRef(run.worktree!);
  return launchPhase(runId, final ? "final" : "review", reviewPrompt(agent, run, base, final), null);
}

async function startMilestone(runId: number) {
  const run = getRun(runId)!;
  const agent = getAgent(run.agentId)!;
  const big = run.extra.flow!.big!;
  patchFlow(runId, { big: { ...big, milestones: big.milestones.map((m, i) => (i === big.index ? { ...m, state: "now" } : m)) }, stage: "milestone", subSteps: [] });
  writeProgressFile(getRun(runId)!);
  updateRun(runId, { activity: `Starting milestone ${big.index + 1} of ${big.milestones.length}: ${big.milestones[big.index].title}` });
  return launchPhase(runId, "milestone", milestonePrompt(agent, getRun(runId)!), null);
}

// Big jobs save their work after every milestone: commit, push, and a draft pull request to watch.
async function checkpoint(runId: number, message: string) {
  const run = getRun(runId)!;
  const agent = getAgent(run.agentId)!;
  if (!run.branch || !run.worktree) return;
  const push = await sh("git", ["push", "-u", "origin", `HEAD:refs/heads/${run.branch}`], run.worktree);
  if (!push.ok) {
    log(runId, `Couldn't push the checkpoint: ${push.err.slice(0, 500)}`);
    if (/auth|credential|permission denied|403|401/i.test(push.err)) patchExtra(runId, { signIn: "github" });
  } else log(runId, `Checkpoint pushed to ${run.branch}.`);
  if (push.ok && !run.prUrl) {
    const base = await baseRef(run.worktree);
    const pr = await sh("gh", ["pr", "create", "--draft", "--base", base.replace(/^origin\//, ""), "--head", run.branch, "--title", `${agent.name} (in progress)`, "--body", `A big job from agentbox, built milestone by milestone. This pull request fills up as it goes.\n\n**The job:** ${firstLine(agent.prompt).slice(0, 500)}`], run.worktree);
    const url = pr.out.split("\n").filter((l) => l.startsWith("http")).pop();
    if (url) updateRun(runId, { prUrl: url });
  }
  notify(agent, "finished", message);
}

async function commitAll(run: Run, message: string) {
  if (!run.worktree || !run.branch) return;
  const status = await sh("git", ["status", "--porcelain"], run.worktree);
  if (!status.out) return;
  await sh("git", ["add", "-A"], run.worktree);
  await sh("git", ["commit", "-m", `${message.slice(0, 72)}\n\nMade by an agent from agentbox.`], run.worktree);
}

async function hasChanges(run: Run): Promise<boolean> {
  if (!run.worktree) return false;
  const base = run.workflowRunId ? "origin/HEAD" : await baseRef(run.worktree);
  const ahead = await sh("git", ["rev-list", "--count", `${base}..HEAD`], run.worktree);
  return !ahead.ok || Number(ahead.out) > 0;
}

function finishBuild(runId: number) {
  const run = getRun(runId)!;
  const agent = getAgent(run.agentId)!;
  const big = run.extra.flow?.big;
  const summary = big ? `Finished all ${big.milestones.length} milestones: ${big.milestones.map((m) => m.title).join(", ")}.` : run.extra.flow?.workSummary || run.result || "Finished.";
  updateRun(runId, { result: summary });
  if (run.workflowRunId) return finishStep(agent, run, summary, summary);
  return shipIt(agent, run, summary);
}

async function finishLook(runId: number, report: string) {
  allStepsDone(runId);
  const run = getRun(runId)!;
  const agent = getAgent(run.agentId)!;
  if (run.workflowRunId) return finishStep(agent, run, firstLine(report), report);
  updateRun(runId, { status: "done", result: report || run.result || "Finished.", endedAt: Date.now(), activity: null, pid: null });
  if (agent.job.kind === "research" && !run.extra.prReview) {
    const { saveReport } = await import("./reports");
    await saveReport(getRun(runId)!).catch((e) => log(runId, `Couldn't save the report: ${String(e)}`));
    await removeWorktree(getRun(runId)!);
    return;
  }
  await removeWorktree(run);
  if (run.extra.prReview) return import("./prReview").then((m) => m.onReviewEnded(getRun(runId)!));
  notify(agent, "finished", `finished “${run.task}”. ${firstLine(report)}`);
}

// "Reviewed ✓ · 2 fixes made · optimized"
export function carefulLine(flow: Flow | undefined): string | null {
  if (!flow?.careful || !flow.reviews.length) return null;
  const last = flow.reviews[flow.reviews.length - 1];
  const bits = [last.verdict === "passed" ? "Reviewed ✓" : flow.fixedSinceReview ? "Reviewed and corrected ✓" : "Reviewed: a few things still need a look"];
  if (flow.fixes) bits.push(`${flow.fixes} ${flow.fixes === 1 ? "fix" : "fixes"} made`);
  if (flow.polished) bits.push("optimized");
  return bits.join(" · ");
}

// A workflow step is done: keep the shared folder, commit what it changed, and hand back to the workflow.
async function finishStep(agent: Agent, run: Run, summary: string, report: string) {
  const e = eff(agent, run);
  if (!lookOnly(e.allowed, run.mode) && run.worktree) {
    const status = await sh("git", ["status", "--porcelain"], run.worktree);
    if (status.out) {
      await sh("git", ["add", "-A"], run.worktree);
      await sh("git", ["commit", "-m", `${(run.extra.label ?? e.name).slice(0, 60)}: ${summary.slice(0, 200)}\n\nMade by a workflow step from agentbox.`], run.worktree);
    }
  }
  allStepsDone(run.id);
  updateRun(run.id, { status: "done", result: report && report !== summary ? `${summary}\n\n${report}` : summary, endedAt: Date.now(), activity: null, pid: null });
  log(run.id, "Step finished, handing back to the workflow.");
  afterEnd(getRun(run.id)!);
}

export function firstLine(s: string) {
  return s.split("\n").map((l) => l.trim()).find(Boolean)?.slice(0, 300) ?? "";
}

async function shipIt(agent: Agent, run: Run, summary: string) {
  const dir = run.worktree!;
  updateRun(run.id, { activity: "Sending a pull request…" });
  const cur = getRun(run.id)!;
  updateRun(run.id, { steps: cur.steps.map((s, i) => ({ ...s, state: i < cur.steps.length - 1 ? "done" : "now" })) });

  // Commit anything it left uncommitted.
  const status = await sh("git", ["status", "--porcelain"], dir);
  if (status.out) {
    await sh("git", ["add", "-A"], dir);
    await sh("git", ["commit", "-m", `${run.task.slice(0, 72)}\n\n${summary}\n\nMade by the ${agent.name} agent from agentbox.`], dir);
  }
  const base = await baseRef(dir);
  const ahead = await sh("git", ["rev-list", "--count", `${base}..HEAD`], dir);
  if (ahead.ok && Number(ahead.out) === 0) {
    allStepsDone(run.id);
    updateRun(run.id, { status: "done", result: `${summary} (No changes were needed, so there's no pull request.)`, endedAt: Date.now(), activity: null, pid: null });
    await removeWorktree(run);
    notify(agent, "finished", `finished “${run.task}” with no changes needed. ${summary}`);
    return;
  }

  const push = await sh("git", ["push", "-u", "origin", `HEAD:refs/heads/${run.branch}`], dir);
  if (!push.ok) {
    if (/auth|credential|permission denied|403|401|could not read username/i.test(push.err)) patchExtra(run.id, { signIn: "github" });
    return finishStopped(run.id, "It finished, but couldn't send its work to GitHub.", push.err);
  }
  log(run.id, `Pushed ${run.branch}`);

  const flow = getRun(run.id)!.extra.flow;
  const careful = carefulLine(flow);
  const reviewNotes = flow?.reviews.length
    ? flow.reviews.map((r, i) => `<details><summary>${r.kind === "final" ? "Final check" : `Review ${i + 1}`}: ${r.verdict} (${r.model === "opus" ? "Opus" : "Sonnet"})</summary>\n\n${r.text.slice(0, 6000)}\n\n</details>`).join("\n")
    : "";
  const milestones = flow?.big?.milestones.length ? `\n**Milestones:**\n${flow.big.milestones.map((m) => `- [x] ${m.title}${m.summary ? `: ${m.summary}` : ""}`).join("\n")}` : "";
  const body = [
    `**Task:** ${run.extra.jobStart ? firstLine(agent.prompt).slice(0, 1000) : run.task}`,
    "",
    `**What it did:** ${summary}`,
    careful ? `\n**${careful}**` : "",
    milestones,
    reviewNotes ? `\n${reviewNotes}` : "",
    "",
    `Made by the **${agent.name}** agent from agentbox (${eff(agent, run).model === "opus" ? "Opus" : "Sonnet"}). Please look before merging.`,
  ].join("\n");
  const existing = await sh("gh", ["pr", "view", run.branch!, "--json", "url,isDraft,state", "--jq", '.url + " " + (.isDraft|tostring) + " " + .state'], dir);
  const [prUrl, draft, state] = existing.ok ? existing.out.split(" ") : [];
  let url = state === "OPEN" ? prUrl : "";
  if (url) {
    if (draft === "true") await sh("gh", ["pr", "ready", url], dir);
    if (flow?.big) await sh("gh", ["pr", "edit", url, "--title", agent.name.slice(0, 120), "--body", body], dir);
    else await sh("gh", ["pr", "comment", url, "--body", `**${run.extra.followUp ? "Follow-up" : "Update"}:** ${run.task}\n\n${summary}${careful ? `\n\n**${careful}**` : ""}${reviewNotes ? `\n\n${reviewNotes}` : ""}\n\n<sub>Posted by agentbox</sub>`], dir);
  } else {
    const title = run.task === "Its usual job" || run.task === "Scheduled run" ? `${agent.name}: ${summary}` : run.extra.jobStart ? `${agent.name}: ${firstLine(agent.prompt)}` : run.task;
    const pr = await sh("gh", ["pr", "create", "--base", base.replace(/^origin\//, ""), "--head", run.branch!, "--title", title.slice(0, 120), "--body", body], dir);
    if (!pr.ok) {
      if (/auth|credential|401|403|gh auth login/i.test(pr.err)) patchExtra(run.id, { signIn: "github" });
      return finishStopped(run.id, "It pushed its work but couldn't open the pull request.", pr.err);
    }
    url = pr.out.split("\n").filter((l) => l.startsWith("http")).pop() ?? pr.out;
  }
  log(run.id, `Pull request: ${url}`);
  allStepsDone(run.id);
  updateRun(run.id, { status: "review", prUrl: url, result: summary, endedAt: Date.now(), activity: null, pid: null });
  await removeWorktree(getRun(run.id)!);
  notify(agent, "finished", `finished “${run.task}”.${careful ? ` ${careful}.` : ""} Pull request ready: ${url}`);
  if (!careful && agent.kind === "claude" && !run.extra.prReview) {
    // Not made in Careful mode: a reviewer reads it anyway, so Nic never has to ask.
    import("./prReview").then((m) => m.reviewRunPr(getRun(run.id)!)).catch((e) => log(run.id, `Couldn't start a review: ${(e as Error).message}`));
  }
  if (agent.kind === "claude" && agent.job.autoInstall && agent.project === "agentbox-panel" && flow?.reviews.at(-1)?.verdict !== "needs work") {
    import("./update").then((m) => m.installFromPr(run.id)).catch((e) => log(run.id, `Couldn't start installing it: ${String(e)}`));
  }
}

async function removeWorktree(run: Run) {
  if (!run.worktree || !fs.existsSync(run.worktree)) return;
  if (run.worktree.includes(`${path.sep}research${path.sep}run-`)) return fs.rmSync(run.worktree, { recursive: true, force: true });
  if (run.workflowRunId && !run.extra.checkoutRef) return; // the workflow owns its folder
  const agent = getAgent(run.agentId);
  const repo = agent && projectPath(run.extra.project ?? agent.project);
  if (repo) await sh("git", ["worktree", "remove", "--force", run.worktree], repo);
}

function finishStopped(runId: number, reason: string, detail?: string) {
  const run = getRun(runId);
  if (!run || run.status === "stopped" || run.status === "done") return;
  if (detail) log(runId, `Problem: ${detail}`);
  log(runId, `Stopped: ${reason}`);
  denyPendingForRun(runId, "The run was stopped.");
  updateRun(runId, { status: "stopped", stopReason: reason, endedAt: Date.now(), activity: null, pid: null });
  patchExtra(runId, { stopReq: null, resume: undefined });
  const agent = getAgent(run.agentId);
  const quiet = reason === "You stopped it." || reason === PAUSED_ALL || reason === OUT_OF_TIME || reason === OVER_BUDGET;
  if (agent && !run.workflowRunId && !quiet) notify(agent, "problems", `stopped while doing “${run.task}”: ${reason}`);
  if (agent && !run.workflowRunId && reason === OUT_OF_TIME) notify(agent, "problems", `ran out of time on “${run.task}”. Press Keep going in agentbox to give it 30 more minutes.`);
  if (agent && !run.workflowRunId && reason === OVER_BUDGET) notify(agent, "problems", `used its usage budget on “${run.task}” and is paused. You can raise the budget in agentbox.`);
  if (run.extra.prReview) {
    removeWorktree(run).catch(() => {});
    import("./prReview").then((m) => m.onReviewEnded(getRun(runId)!)).catch(() => {});
  }
  afterEnd(getRun(runId)!);
}

// ---------- controls ----------

export function stopRun(runId: number, reason = "You stopped it.") {
  const run = getRun(runId);
  if (!run || (run.status !== "working" && run.status !== "waiting" && run.status !== "queued")) return;
  denyPendingForRun(runId, "The run was stopped.");
  if (run.status !== "working" || !run.extra.proc) return finishStopped(runId, reason);
  patchExtra(runId, { stopReq: reason });
  log(runId, reason === OUT_OF_TIME ? "Stopping: out of time." : `Stopping: ${reason}`);
  stopProc(handle(run.extra.proc));
}

// "Pause everything": stop whatever is running. Schedules and workflows check pausedAll() themselves.
export function stopAllRuns(reason = PAUSED_ALL) {
  for (const run of runsWithStatus("queued", "working", "waiting")) stopRun(run.id, reason);
}

export function approvePlan(runId: number) {
  const run = getRun(runId);
  if (!run || run.status !== "waiting" || !run.sessionId) throw new Error("There's no plan waiting for an OK.");
  log(runId, "Nic approved the plan.");
  updateRun(runId, { status: "working", activity: "Starting on the plan…" });
  patchExtra(runId, { lastTickAt: Date.now() });
  launchPhase(runId, "work", "Nic approved your plan. Go ahead and carry it out now, following the progress-line rules.", run.sessionId).catch((e) =>
    finishStopped(runId, "It couldn't start on the plan.", String(e)),
  );
}

export function changePlan(runId: number, message: string) {
  const run = getRun(runId);
  if (!run || run.status !== "waiting" || !run.sessionId) throw new Error("There's no plan waiting for an OK.");
  log(runId, `Nic asked for changes to the plan: ${message}`);
  updateRun(runId, { status: "working", plan: null, activity: "Changing its plan…" });
  patchExtra(runId, { lastTickAt: Date.now() });
  launchPhase(runId, "plan", `Nic read your plan and wants changes:\n${message}\n\nWrite the updated plan.`, run.sessionId).catch((e) =>
    finishStopped(runId, "It couldn't change its plan.", String(e)),
  );
}

// Can this stopped run carry on where it stopped (same copy, same conversation)?
export function canContinue(run: Run): boolean {
  return run.status === "stopped" && !!run.extra.last && !!run.worktree && fs.existsSync(run.worktree) && run.stopReason !== "The pull request was closed without merging.";
}

// "Keep going (+30 min)", "Raise the budget", "Pick up where it stopped": continue the same job in the same copy.
export function continueRun(runId: number, opts: { addMinutes?: number; addBudget?: number } = {}) {
  const run = getRun(runId);
  const agent = run && getAgent(run.agentId);
  if (!run || !agent) throw new Error("That run isn't here any more.");
  if (!canContinue(run)) throw new Error("This one can't pick up where it stopped (its copy of the project is gone). Use Try again instead.");
  if (pausedAll()) throw new Error("Everything is paused. Press Resume everything at the top first.");
  if (agent.kind === "claude" && activeRun(agent.id)) throw new Error("This job is already working on something else.");
  const last = run.extra.last!;
  const e = eff(agent, run);
  const patch: Partial<RunExtra> = { outOfTime: false, overBudget: false, signIn: undefined, stopReq: null, lastTickAt: Date.now() };
  if (opts.addMinutes) patch.maxMinutes = Math.max(e.maxMinutes, Math.ceil((run.extra.activeMs ?? 0) / 60_000)) + opts.addMinutes;
  if (opts.addBudget && run.extra.flow?.big) patch.flow = { ...run.extra.flow, big: { ...run.extra.flow.big, budgetPct: run.extra.flow.big.budgetPct + opts.addBudget } };
  patchExtra(runId, patch);
  updateRun(runId, { status: "working", stopReason: null, endedAt: null, activity: "Picking up where it stopped…" });
  db().prepare("UPDATE runs SET dismissed = 0 WHERE id = ?").run(runId);
  const why =
    run.stopReason === OUT_OF_TIME
      ? `You were stopped because you ran out of time. You have ${opts.addMinutes ?? 30} more minutes now.`
      : run.stopReason === OVER_BUDGET
        ? "You were paused because you used your usage budget. Nic gave you more."
        : "You were stopped part-way.";
  const prompt = last.session ? `${why} Carry on exactly where you left off: check git status and what you've already done first. Keep the progress lines.` : last.prompt;
  log(runId, `Nic pressed ${opts.addMinutes ? `Keep going (+${opts.addMinutes} min)` : opts.addBudget ? `Raise the budget (+${opts.addBudget}%)` : "Pick up where it stopped"}.`);
  launchPhase(runId, last.phase, prompt, last.session).catch((err) => finishStopped(runId, "It couldn't carry on.", String(err)));
}

// ---------- background upkeep ----------

// After a restart: sessions keep running under launchd and pumpRuns() reattaches to them.
// Runs from before v3 (child processes of the old panel) are gone, so they end as Stopped.
export function recoverOnBoot() {
  for (const run of runsWithStatus("working")) {
    if (run.extra.proc) {
      log(run.id, "The panel restarted. Reattaching to its session.");
      continue;
    }
    if (run.extra.flow) continue; // between sessions; pumpRuns decides
    finishStopped(run.id, RESTARTED);
  }
}

// Needs you (pull request open) → Done when merged, Stopped if closed without merging.
export async function checkPullRequests() {
  for (const run of runsWithStatus("review")) {
    if (!run.prUrl) continue;
    const r = await sh("gh", ["pr", "view", run.prUrl, "--json", "state", "--jq", ".state"], os.homedir(), 30_000);
    if (!r.ok) continue;
    if (r.out === "MERGED") {
      updateRun(run.id, { status: "done" });
      log(run.id, "Pull request merged.");
      await import("./notices").then((m) => m.onMerged(run.id)).catch(() => {});
    } else if (r.out === "CLOSED") {
      updateRun(run.id, { status: "stopped", stopReason: "The pull request was closed without merging." });
      log(run.id, "Pull request closed without merging.");
    }
  }
}

export function plainApprovalSummary(toolName: string, input: Record<string, unknown>): string {
  const file = typeof input.file_path === "string" ? path.basename(input.file_path) : typeof input.notebook_path === "string" ? path.basename(input.notebook_path) : "";
  switch (toolName) {
    case "Bash":
      return typeof input.description === "string" && input.description ? sentence(input.description) : "Run a command on this Mac";
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return `Change the file ${file}`;
    case "Write":
      return `Create or replace the file ${file}`;
    case "WebFetch":
      try {
        return `Open the web page ${new URL(String(input.url)).hostname}`;
      } catch {
        return "Open a web page";
      }
    case "WebSearch":
      return `Search the web for “${String(input.query ?? "").slice(0, 80)}”`;
    case "ExitPlanMode":
      return "Start working on its plan";
    default:
      if (toolName.startsWith("mcp__")) {
        // e.g. mcp__claude_ai_Gmail__send_message → "Gmail: send message"
        const [, server = "", tool = ""] = toolName.split("__");
        return `${server.replace(/^claude_ai_/, "").replace(/_/g, " ")}: ${tool.replace(/_/g, " ")}`;
      }
      return `Use the ${toolName} tool`;
  }
}
