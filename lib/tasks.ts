import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, activeRun, createAgent, getAgent, listAgents, renameAgent, setArchived } from "./db";
import { readStoredBrief } from "./briefs";
import { COLOR_CHOICES } from "./choices";
import { DEFAULT_JOB, defaultMinutes, iconFor, jobName, modeFor, pickColor } from "./job";
import { listProjects } from "./projects";
import { startRun } from "./runner";
import type { Agent, Freedom, JobKind, JobSettings, Model, NotifyOn, ScheduleKind } from "./types";

// "Start a task": every new task is a new agent named after the job. Follow-ups continue the same job.

const SCHEDULES: ScheduleKind[] = ["manual", "hourly", "daily", "days"];
const FREEDOMS: Freedom[] = ["look", "check", "auto"];
const MODELS: Model[] = ["sonnet", "opus"];
const NOTIFY: NotifyOn[] = ["finished", "needs_ok", "problems"];
export const BRIEF_DIR = path.join(DATA_DIR, "briefs");
const MAX_BRIEF = 400_000;

export type TaskInput = {
  kind: JobKind;
  task: string;
  project: string;
  scheduleKind: ScheduleKind;
  scheduleDays: number[];
  scheduleTime: string;
  freedom: Freedom;
  careful: boolean;
  maxMinutes: number;
  model: Model;
  connectors: string[];
  notify: NotifyOn[];
  askEachStep: boolean;
  big: boolean;
  budgetPct: number;
  holdSmall: boolean;
  autoInstall: boolean;
  saveReport: boolean;
  brief: { name: string; text: string } | null;
};

export function parseTaskInput(body: unknown, projects = listProjects()): { ok: true; t: TaskInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const kind: JobKind = b.kind === "research" ? "research" : "build";
  const task = String(b.task ?? "").trim();
  // The panel attaches a brief by its hash (lib/briefs.ts); older callers send the text itself.
  const brief = b.brief && typeof b.brief === "object" ? (b.brief as { name?: unknown; text?: unknown; hash?: unknown }) : null;
  const stored = brief && typeof brief.hash === "string" ? readStoredBrief(brief.hash) : null;
  if (brief && typeof brief.hash === "string" && stored === null) return { ok: false, error: "That brief isn't here any more. Remove it and attach it again." };
  const briefText = stored ?? (brief ? String(brief.text ?? "") : "");
  if (task.length < 3 && !briefText) return { ok: false, error: kind === "research" ? "Write your question first." : "Write what it should do first." };
  if (task.length > 8000) return { ok: false, error: "That's a lot of text. Attach it as a brief file instead (the paperclip under the box)." };
  if (briefText.length > MAX_BRIEF) return { ok: false, error: "That brief file is too big. Keep it under about 400 KB." };
  const project = String(b.project ?? "");
  if (project ? !projects.includes(project) : kind !== "research") return { ok: false, error: "Pick a project from the list." };
  const scheduleKind = (SCHEDULES.includes(b.scheduleKind as ScheduleKind) ? b.scheduleKind : "manual") as ScheduleKind;
  const scheduleDays = Array.isArray(b.scheduleDays) ? [...new Set((b.scheduleDays as unknown[]).map(Number).filter((d) => d >= 0 && d <= 6))] : [];
  if (scheduleKind === "days" && !scheduleDays.length) return { ok: false, error: "Pick at least one day." };
  const scheduleTime = String(b.scheduleTime ?? "18:00");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduleTime)) return { ok: false, error: "Pick a time." };
  // Research only ever writes a report, so it's always Look only (connectors that send or change things still ask).
  const freedom = (kind === "research" ? "look" : FREEDOMS.includes(b.freedom as Freedom) ? b.freedom : "auto") as Freedom;
  const careful = b.careful !== false;
  const model = (MODELS.includes(b.model as Model) ? b.model : kind === "research" ? "opus" : "sonnet") as Model;
  const big = b.big === true;
  let maxMinutes = Math.round(Number(b.maxMinutes ?? defaultMinutes(kind, careful, freedom)));
  if (!(maxMinutes >= 5 && maxMinutes <= 240)) return { ok: false, error: "The time limit must be between 5 minutes and 4 hours." };
  if (big) maxMinutes = 240; // big jobs use a usage budget instead; this is only the cap for one milestone
  const budgetPct = Math.round(Number(b.budgetPct ?? DEFAULT_JOB.budgetPct));
  if (big && !(budgetPct >= 5 && budgetPct <= 100)) return { ok: false, error: "The usage budget must be between 5% and 100%." };
  const notify = Array.isArray(b.notify) ? (b.notify as NotifyOn[]).filter((n) => NOTIFY.includes(n)) : (["finished", "needs_ok", "problems"] as NotifyOn[]);
  const connectors = Array.isArray(b.connectors) ? (b.connectors as unknown[]).map(String).filter((c) => /^[a-z0-9_-]{1,40}$/i.test(c)).slice(0, 20) : [];
  return {
    ok: true,
    t: {
      kind, task, project, scheduleKind, scheduleDays, scheduleTime, freedom, careful, maxMinutes, model, connectors, notify,
      askEachStep: b.askEachStep === true && freedom !== "look", big, budgetPct, holdSmall: b.holdSmall !== false,
      autoInstall: b.autoInstall === true && project === "agentbox-panel" && big, saveReport: b.saveReport === true && kind === "research" && !!project,
      brief: briefText ? { name: String(brief?.name ?? "brief.md").replace(/[^\w.\- ]+/g, "").slice(0, 80) || "brief.md", text: briefText } : null,
    },
  };
}

function jobSettings(t: TaskInput): JobSettings {
  return {
    kind: t.kind, careful: t.careful, askEachStep: t.askEachStep, connectors: t.connectors, big: t.big, budgetPct: t.budgetPct,
    holdSmall: t.holdSmall, autoInstall: t.autoInstall, saveReport: t.saveReport, brief: t.brief?.name ?? null,
  };
}

export function briefPath(agentId: number) {
  return path.join(BRIEF_DIR, `agent-${agentId}.md`);
}

export function readBrief(agentId: number): string | null {
  try {
    return fs.readFileSync(briefPath(agentId), "utf8");
  } catch {
    return null;
  }
}

function saveBrief(agentId: number, text: string) {
  fs.mkdirSync(BRIEF_DIR, { recursive: true });
  fs.writeFileSync(briefPath(agentId), text, { mode: 0o600 });
}

// A new task → a new agent named after the job. Starts now unless it's scheduled.
export async function createTask(t: TaskInput, opts: { onBranch?: { branch: string; prUrl: string } } = {}): Promise<{ agent: Agent; runId: number | null }> {
  const { mode, allowed } = modeFor(t.freedom, t.askEachStep);
  const active = listAgents().filter((a) => a.kind === "claude" && !a.archived);
  const fromBrief = !t.task && t.brief ? t.brief.name.replace(/\.(md|txt)$/i, "").replace(/[-_]+/g, " ") : "";
  const base = jobName(t.task || fromBrief, t.kind);
  let name = base;
  for (let i = 2; active.some((a) => a.name.toLowerCase() === name.toLowerCase()); i++) name = `${base} ${i}`;
  const prompt = t.task || `Do the job described in the attached brief (${t.brief?.name ?? "brief.md"}).`;
  const agent = createAgent({
    name,
    color: pickColor(active.map((a) => a.color), COLOR_CHOICES.map((c) => c.hex)),
    icon: iconFor(t.kind, t.freedom, t.scheduleKind !== "manual"),
    prompt,
    project: t.project,
    scheduleKind: t.scheduleKind,
    scheduleDays: t.scheduleDays,
    scheduleTime: t.scheduleTime,
    allowed,
    mode,
    maxMinutes: t.maxMinutes,
    model: t.model,
    notify: t.notify,
    enabled: true,
    job: jobSettings(t),
  });
  if (t.brief) saveBrief(agent.id, t.brief.text);
  betterName(agent.id, prompt, t.kind).catch(() => {});
  if (t.scheduleKind !== "manual") return { agent: getAgent(agent.id)!, runId: null };
  const run = await startRun(agent.id, { task: "", trigger: "manual", extra: opts.onBranch ? { onBranch: opts.onBranch } : undefined });
  return { agent: getAgent(agent.id)!, runId: run.id };
}

// A follow-up continues the same job: same project, same branch and pull request if one is open.
export async function followUp(agentId: number, t: TaskInput): Promise<{ agent: Agent; runId: number }> {
  const agent = getAgent(agentId);
  if (!agent || agent.kind !== "claude") throw new Error("There's no job with that number.");
  if (activeRun(agentId)) throw new Error("It's still working on this job. Add your follow-up when it's done, or press Stop first.");
  const { mode } = modeFor(t.freedom, t.askEachStep);
  if (agent.archived) setArchived(agentId, false);
  const run = await startRun(agentId, {
    task: t.task,
    mode,
    trigger: "manual",
    extra: {
      followUp: true, careful: t.careful, connectors: t.connectors, model: t.model, maxMinutes: t.maxMinutes,
      allowed: t.freedom === "look" ? "look" : "suggest",
    },
  });
  return { agent: getAgent(agentId)!, runId: run.id };
}

// A nicer 2–4 word name from Claude (Haiku, no tools). The quick guess above is used until then, or if this fails.
async function betterName(agentId: number, task: string, kind: JobKind) {
  if (process.env.AGENTBOX_NO_AI_NAMES === "1") return;
  const before = getAgent(agentId)?.name;
  const prompt = `Give this ${kind === "research" ? "research question" : "task"} a short name of 2 to 4 words, like "Arcade site", "Helper fixes" or "Recipe research". Plain words, no quotes, no punctuation at the end. Reply with the name only.\n\nThe ${kind === "research" ? "question" : "task"}:\n${task.slice(0, 1500)}`;
  const out = await new Promise<string>((resolve) => {
    execFile(
      "claude",
      ["-p", prompt, "--model", "haiku", "--tools", "", "--strict-mcp-config", "--setting-sources", "", "--no-session-persistence", "--output-format", "text"],
      { timeout: 45_000, cwd: DATA_DIR, env: cleanEnv() },
      (e, stdout) => resolve(e ? "" : String(stdout)),
    );
  });
  const name = out.trim().split("\n")[0]?.replace(/^["'“”]+|["'“”.!]+$/g, "").trim() ?? "";
  if (!name || name.length > 40 || name.split(/\s+/).length > 6) return;
  const now = getAgent(agentId);
  if (!now || now.name !== before) return; // Nic renamed it already
  const taken = listAgents().some((a) => a.id !== agentId && !a.archived && a.name.toLowerCase() === name.toLowerCase());
  if (!taken) renameAgent(agentId, name.charAt(0).toUpperCase() + name.slice(1));
}

function cleanEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const k of Object.keys(env)) if (k === "CLAUDECODE" || k.startsWith("CLAUDE_CODE_") || k === "ANTHROPIC_API_KEY") delete env[k];
  env.PATH = [path.join(process.env.HOME ?? "", ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":");
  return env;
}
