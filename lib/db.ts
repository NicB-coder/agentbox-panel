import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Agent, AgentInput, Approval, Run, Step } from "./types";
import { SEED_AGENTS } from "./seed";

export const DATA_DIR = process.env.AGENTBOX_DATA_DIR || path.join(process.cwd(), "data");
export const LOG_DIR = path.join(DATA_DIR, "logs");

type G = typeof globalThis & { __agentboxDb?: Database.Database };
const g = globalThis as G;

export function db(): Database.Database {
  if (g.__agentboxDb) return g.__agentboxDb;
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const d = new Database(path.join(DATA_DIR, "agentbox.db"));
  d.pragma("journal_mode = WAL");
  d.pragma("busy_timeout = 5000");
  d.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      prompt TEXT NOT NULL DEFAULT '',
      project TEXT NOT NULL DEFAULT '',
      schedule_kind TEXT NOT NULL DEFAULT 'manual',
      schedule_days TEXT NOT NULL DEFAULT '[]',
      schedule_time TEXT NOT NULL DEFAULT '02:00',
      allowed TEXT NOT NULL DEFAULT 'suggest',
      mode TEXT NOT NULL DEFAULT 'auto',
      max_minutes INTEGER NOT NULL DEFAULT 30,
      model TEXT NOT NULL DEFAULT 'sonnet',
      notify TEXT NOT NULL DEFAULT '["finished","needs_ok","problems"]',
      enabled INTEGER NOT NULL DEFAULT 1,
      paused INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'claude',
      next_run_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      task TEXT NOT NULL,
      mode TEXT NOT NULL,
      trigger TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL,
      stop_reason TEXT,
      result TEXT,
      plan TEXT,
      session_id TEXT,
      branch TEXT,
      worktree TEXT,
      pr_url TEXT,
      steps TEXT NOT NULL DEFAULT '[]',
      activity TEXT,
      pid INTEGER,
      started_at INTEGER NOT NULL,
      ended_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS runs_agent ON runs(agent_id, started_at DESC);
    CREATE TABLE IF NOT EXISTS approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      tool_name TEXT,
      summary TEXT NOT NULL,
      detail TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      message TEXT,
      created_at INTEGER NOT NULL,
      decided_at INTEGER
    );
  `);
  g.__agentboxDb = d;
  seedIfEmpty(d);
  return d;
}

function seedIfEmpty(d: Database.Database) {
  const n = (d.prepare("SELECT COUNT(*) AS n FROM agents").get() as { n: number }).n;
  if (n > 0) return;
  const now = Date.now();
  for (const a of SEED_AGENTS) {
    insertAgentRow(d, a.input, a.slug, a.kind, a.paused, now);
  }
}

// ---------- agents ----------

type AgentRow = {
  id: number; slug: string; name: string; color: string; icon: string; prompt: string; project: string;
  schedule_kind: string; schedule_days: string; schedule_time: string; allowed: string; mode: string;
  max_minutes: number; model: string; notify: string; enabled: number; paused: number; kind: string;
  next_run_at: number | null; created_at: number;
};

function toAgent(r: AgentRow): Agent {
  return {
    id: r.id, slug: r.slug, name: r.name, color: r.color, icon: r.icon, prompt: r.prompt, project: r.project,
    scheduleKind: r.schedule_kind as Agent["scheduleKind"],
    scheduleDays: JSON.parse(r.schedule_days),
    scheduleTime: r.schedule_time,
    allowed: r.allowed as Agent["allowed"],
    mode: r.mode as Agent["mode"],
    maxMinutes: r.max_minutes,
    model: r.model as Agent["model"],
    notify: JSON.parse(r.notify),
    enabled: !!r.enabled, paused: !!r.paused,
    kind: r.kind as Agent["kind"],
    nextRunAt: r.next_run_at, createdAt: r.created_at,
  };
}

export function listAgents(): Agent[] {
  return (db().prepare("SELECT * FROM agents ORDER BY id").all() as AgentRow[]).map(toAgent);
}

export function getAgent(id: number): Agent | null {
  const r = db().prepare("SELECT * FROM agents WHERE id = ?").get(id) as AgentRow | undefined;
  return r ? toAgent(r) : null;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "agent";
}

function insertAgentRow(d: Database.Database, a: AgentInput, slug: string, kind: string, paused: boolean, now: number) {
  return d.prepare(`INSERT INTO agents
    (slug,name,color,icon,prompt,project,schedule_kind,schedule_days,schedule_time,allowed,mode,max_minutes,model,notify,enabled,paused,kind,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    slug, a.name, a.color, a.icon, a.prompt, a.project, a.scheduleKind, JSON.stringify(a.scheduleDays), a.scheduleTime,
    a.allowed, a.mode, a.maxMinutes, a.model, JSON.stringify(a.notify), a.enabled ? 1 : 0, paused ? 1 : 0, kind, now,
  ).lastInsertRowid as number;
}

export function createAgent(a: AgentInput): Agent {
  const d = db();
  let slug = slugify(a.name);
  const taken = (s: string) => !!d.prepare("SELECT 1 FROM agents WHERE slug = ?").get(s);
  for (let i = 2; taken(slug); i++) slug = `${slugify(a.name)}-${i}`;
  const id = insertAgentRow(d, a, slug, "claude", false, Date.now());
  return getAgent(id)!;
}

export function updateAgent(id: number, a: AgentInput): Agent | null {
  db().prepare(`UPDATE agents SET name=?, color=?, icon=?, prompt=?, project=?, schedule_kind=?, schedule_days=?,
    schedule_time=?, allowed=?, mode=?, max_minutes=?, model=?, notify=?, enabled=?, next_run_at=NULL WHERE id=? AND kind='claude'`).run(
    a.name, a.color, a.icon, a.prompt, a.project, a.scheduleKind, JSON.stringify(a.scheduleDays), a.scheduleTime,
    a.allowed, a.mode, a.maxMinutes, a.model, JSON.stringify(a.notify), a.enabled ? 1 : 0, id,
  );
  return getAgent(id);
}

export function deleteAgent(id: number) {
  db().prepare("DELETE FROM approvals WHERE run_id IN (SELECT id FROM runs WHERE agent_id = ?)").run(id);
  db().prepare("DELETE FROM runs WHERE agent_id = ?").run(id);
  db().prepare("DELETE FROM agents WHERE id = ? AND kind='claude'").run(id);
}

export function setPaused(id: number, paused: boolean) {
  db().prepare("UPDATE agents SET paused = ?, next_run_at = NULL WHERE id = ?").run(paused ? 1 : 0, id);
}

export function setNextRunAt(id: number, at: number | null) {
  db().prepare("UPDATE agents SET next_run_at = ? WHERE id = ?").run(at, id);
}

// ---------- runs ----------

type RunRow = {
  id: number; agent_id: number; task: string; mode: string; trigger: string; status: string; stop_reason: string | null;
  result: string | null; plan: string | null; session_id: string | null; branch: string | null; worktree: string | null;
  pr_url: string | null; steps: string; activity: string | null; pid: number | null; started_at: number; ended_at: number | null;
};

function toRun(r: RunRow): Run {
  return {
    id: r.id, agentId: r.agent_id, task: r.task, mode: r.mode as Run["mode"], trigger: r.trigger as Run["trigger"],
    status: r.status as Run["status"], stopReason: r.stop_reason, result: r.result, plan: r.plan, sessionId: r.session_id,
    branch: r.branch, worktree: r.worktree, prUrl: r.pr_url, steps: JSON.parse(r.steps) as Step[], activity: r.activity,
    pid: r.pid, startedAt: r.started_at, endedAt: r.ended_at,
  };
}

export function getRun(id: number): Run | null {
  const r = db().prepare("SELECT * FROM runs WHERE id = ?").get(id) as RunRow | undefined;
  return r ? toRun(r) : null;
}

export function listRuns(agentId: number, limit = 50): Run[] {
  return (db().prepare("SELECT * FROM runs WHERE agent_id = ? ORDER BY started_at DESC, id DESC LIMIT ?").all(agentId, limit) as RunRow[]).map(toRun);
}

export function runsWithStatus(...statuses: Run["status"][]): Run[] {
  const q = `SELECT * FROM runs WHERE status IN (${statuses.map(() => "?").join(",")}) ORDER BY id`;
  return (db().prepare(q).all(...statuses) as RunRow[]).map(toRun);
}

export function activeRun(agentId: number): Run | null {
  const r = db().prepare("SELECT * FROM runs WHERE agent_id = ? AND status IN ('working','waiting') ORDER BY id DESC LIMIT 1").get(agentId) as RunRow | undefined;
  return r ? toRun(r) : null;
}

export function createRun(r: { agentId: number; task: string; mode: Run["mode"]; trigger: Run["trigger"]; steps: Step[] }): Run {
  const id = db().prepare("INSERT INTO runs (agent_id, task, mode, trigger, status, steps, activity, started_at) VALUES (?,?,?,?, 'working', ?, ?, ?)")
    .run(r.agentId, r.task, r.mode, r.trigger, JSON.stringify(r.steps), "Getting ready…", Date.now()).lastInsertRowid as number;
  return getRun(id)!;
}

const RUN_COLS: Record<string, string> = {
  status: "status", stopReason: "stop_reason", result: "result", plan: "plan", sessionId: "session_id", branch: "branch",
  worktree: "worktree", prUrl: "pr_url", steps: "steps", activity: "activity", pid: "pid", endedAt: "ended_at", mode: "mode",
};

export function updateRun(id: number, patch: Partial<Run>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    const col = RUN_COLS[k];
    if (!col) continue;
    sets.push(`${col} = ?`);
    vals.push(k === "steps" ? JSON.stringify(v) : v);
  }
  if (!sets.length) return;
  db().prepare(`UPDATE runs SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
}

// ---------- approvals ----------

type ApprovalRow = {
  id: number; run_id: number; kind: string; tool_name: string | null; summary: string; detail: string | null;
  status: string; message: string | null; created_at: number; decided_at: number | null;
};

function toApproval(r: ApprovalRow): Approval {
  return {
    id: r.id, runId: r.run_id, kind: r.kind as Approval["kind"], toolName: r.tool_name, summary: r.summary, detail: r.detail,
    status: r.status as Approval["status"], message: r.message, createdAt: r.created_at, decidedAt: r.decided_at,
  };
}

export function createApproval(a: { runId: number; kind: Approval["kind"]; toolName: string | null; summary: string; detail: string | null }): Approval {
  const id = db().prepare("INSERT INTO approvals (run_id, kind, tool_name, summary, detail, created_at) VALUES (?,?,?,?,?,?)")
    .run(a.runId, a.kind, a.toolName, a.summary, a.detail, Date.now()).lastInsertRowid as number;
  return getApproval(id)!;
}

export function getApproval(id: number): Approval | null {
  const r = db().prepare("SELECT * FROM approvals WHERE id = ?").get(id) as ApprovalRow | undefined;
  return r ? toApproval(r) : null;
}

export function pendingApprovalForRun(runId: number): Approval | null {
  const r = db().prepare("SELECT * FROM approvals WHERE run_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1").get(runId) as ApprovalRow | undefined;
  return r ? toApproval(r) : null;
}

export function decideApproval(id: number, allow: boolean, message: string | null) {
  db().prepare("UPDATE approvals SET status = ?, message = ?, decided_at = ? WHERE id = ? AND status = 'pending'")
    .run(allow ? "allowed" : "denied", message, Date.now(), id);
}

export function denyPendingForRun(runId: number, message: string) {
  db().prepare("UPDATE approvals SET status = 'denied', message = ?, decided_at = ? WHERE run_id = ? AND status = 'pending'")
    .run(message, Date.now(), runId);
}
