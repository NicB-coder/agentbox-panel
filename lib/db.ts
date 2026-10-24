import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Agent, AgentInput, Approval, Idea, Run, RunExtra, Step, Workflow, WorkflowInput, WorkflowRun, WorkflowVersion } from "./types";
import { SEED_AGENTS } from "./seed";
import { DEFAULT_LIMITS } from "./wf";
import { jobOf } from "./job";

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
  migrate(d);
  g.__agentboxDb = d;
  seedIfEmpty(d);
  ensureHelper(d);
  migrateV3(d);
  return d;
}

// v2 additions. Safe to run on every start: only adds what's missing.
function migrate(d: Database.Database) {
  const cols = (t: string) => new Set((d.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name));
  const runCols = cols("runs");
  const add = (col: string, def: string) => {
    if (!runCols.has(col)) d.exec(`ALTER TABLE runs ADD COLUMN ${col} ${def}`);
  };
  add("workflow_run_id", "INTEGER");
  add("step_id", "TEXT");
  add("cost_usd", "REAL NOT NULL DEFAULT 0");
  add("tokens", "INTEGER NOT NULL DEFAULT 0");
  add("dismissed", "INTEGER NOT NULL DEFAULT 0");
  add("extra", "TEXT NOT NULL DEFAULT '{}'");
  const agentCols = cols("agents");
  if (!agentCols.has("archived")) d.exec("ALTER TABLE agents ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
  if (!agentCols.has("job")) d.exec("ALTER TABLE agents ADD COLUMN job TEXT NOT NULL DEFAULT '{}'");
  d.exec(`
    CREATE INDEX IF NOT EXISTS runs_wf ON runs(workflow_run_id);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      project TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 0,
      steps TEXT NOT NULL DEFAULT '[]',
      limits TEXT NOT NULL DEFAULT '{}',
      next_run_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workflow_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      saved_at INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      def TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      test INTEGER NOT NULL DEFAULT 0,
      input TEXT NOT NULL DEFAULT '',
      trigger TEXT NOT NULL DEFAULT 'manual',
      trigger_ref TEXT,
      branch TEXT,
      worktree TEXT,
      pr_url TEXT,
      current INTEGER NOT NULL DEFAULT 0,
      steps TEXT NOT NULL,
      step_runs TEXT NOT NULL DEFAULT '{}',
      loops INTEGER NOT NULL DEFAULT 0,
      feedback TEXT,
      gates TEXT NOT NULL DEFAULT '{}',
      waiting TEXT,
      stop_reason TEXT,
      summary TEXT,
      usage_start TEXT,
      waited_ms INTEGER NOT NULL DEFAULT 0,
      started_at INTEGER NOT NULL,
      ended_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS wfruns_wf ON workflow_runs(workflow_id, started_at DESC);
    CREATE TABLE IF NOT EXISTS workflow_seen (
      workflow_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      PRIMARY KEY (workflow_id, key)
    );
    CREATE TABLE IF NOT EXISTS helper_chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS helper_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'done',
      meta TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS helper_msgs_chat ON helper_messages(chat_id, id);
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL,
      run_id INTEGER NOT NULL UNIQUE,
      question TEXT NOT NULL,
      title TEXT NOT NULL,
      markdown TEXT NOT NULL,
      reviewed TEXT,
      project TEXT,
      pr_url TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      key TEXT UNIQUE,
      title TEXT NOT NULL,
      text TEXT NOT NULL DEFAULT '',
      link TEXT,
      pr_url TEXT,
      play_url TEXT,
      agent_id INTEGER,
      run_id INTEGER,
      created_at INTEGER NOT NULL,
      opened_at INTEGER
    );
  `);
  // v3.1: why a run that finished didn't really do anything (no changes, no pull request, or too quick), for the Inbox.
  if (!cols("workflow_runs").has("quiet")) d.exec("ALTER TABLE workflow_runs ADD COLUMN quiet TEXT");
}

// v3: one agent per job. The premade agents are archived once (their history stays); Heartbeat stays.
function migrateV3(d: Database.Database) {
  if (d.prepare("SELECT 1 FROM settings WHERE key = 'v3Migrated'").get()) return;
  d.prepare("UPDATE agents SET archived = 1, next_run_at = NULL WHERE kind = 'claude' AND slug IN ('builder','reviewer','site-checker','overnight')").run();
  d.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('v3Migrated', 'true')").run();
}

// The hidden agent that runs workflow steps which don't use one of Nic's agents.
function ensureHelper(d: Database.Database) {
  if (d.prepare("SELECT 1 FROM agents WHERE kind = 'helper'").get()) return;
  insertAgentRow(
    d,
    {
      name: "Workflow step", color: "#2F4FD8", icon: "sparkle", prompt: "Does one step of a workflow.", project: "", scheduleKind: "manual",
      scheduleDays: [], scheduleTime: "02:00", allowed: "suggest", mode: "auto", maxMinutes: 30, model: "sonnet", notify: [], enabled: true,
    },
    "workflow-step", "helper", false, Date.now(),
  );
}

export function helperAgentId(): number {
  return (db().prepare("SELECT id FROM agents WHERE kind = 'helper'").get() as { id: number }).id;
}

// ---------- settings ----------

export function getSetting<T>(key: string, fallback: T): T {
  const r = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  if (!r) return fallback;
  try {
    return JSON.parse(r.value) as T;
  } catch {
    return fallback;
  }
}

export function setSetting(key: string, value: unknown) {
  db().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, JSON.stringify(value));
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
  next_run_at: number | null; created_at: number; archived: number; job: string;
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
    archived: !!r.archived, job: jobOf(JSON.parse(r.job || "{}")),
  };
}

export function listAgents(): Agent[] {
  return (db().prepare("SELECT * FROM agents WHERE kind != 'helper' ORDER BY id").all() as AgentRow[]).map(toAgent);
}

export function getAgent(id: number): Agent | null {
  const r = db().prepare("SELECT * FROM agents WHERE id = ?").get(id) as AgentRow | undefined;
  return r ? toAgent(r) : null;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "agent";
}

function insertAgentRow(d: Database.Database, a: AgentInput, slug: string, kind: string, paused: boolean, now: number) {
  const hasJob = (d.prepare("PRAGMA table_info(agents)").all() as { name: string }[]).some((c) => c.name === "job");
  const cols = "slug,name,color,icon,prompt,project,schedule_kind,schedule_days,schedule_time,allowed,mode,max_minutes,model,notify,enabled,paused,kind,created_at";
  const vals = [
    slug, a.name, a.color, a.icon, a.prompt, a.project, a.scheduleKind, JSON.stringify(a.scheduleDays), a.scheduleTime,
    a.allowed, a.mode, a.maxMinutes, a.model, JSON.stringify(a.notify), a.enabled ? 1 : 0, paused ? 1 : 0, kind, now,
  ];
  if (hasJob) return d.prepare(`INSERT INTO agents (${cols},job) VALUES (${vals.map(() => "?").join(",")},?)`).run(...vals, JSON.stringify(a.job ?? {})).lastInsertRowid as number;
  return d.prepare(`INSERT INTO agents (${cols}) VALUES (${vals.map(() => "?").join(",")})`).run(...vals).lastInsertRowid as number;
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
  const job = a.job ?? getAgent(id)?.job ?? {};
  db().prepare(`UPDATE agents SET name=?, color=?, icon=?, prompt=?, project=?, schedule_kind=?, schedule_days=?,
    schedule_time=?, allowed=?, mode=?, max_minutes=?, model=?, notify=?, enabled=?, job=?, next_run_at=NULL WHERE id=? AND kind='claude'`).run(
    a.name, a.color, a.icon, a.prompt, a.project, a.scheduleKind, JSON.stringify(a.scheduleDays), a.scheduleTime,
    a.allowed, a.mode, a.maxMinutes, a.model, JSON.stringify(a.notify), a.enabled ? 1 : 0, JSON.stringify(job), id,
  );
  return getAgent(id);
}

export function setArchived(id: number, archived: boolean) {
  db().prepare("UPDATE agents SET archived = ?, next_run_at = NULL WHERE id = ? AND kind = 'claude'").run(archived ? 1 : 0, id);
}

export function renameAgent(id: number, name: string) {
  db().prepare("UPDATE agents SET name = ? WHERE id = ?").run(name, id);
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
  workflow_run_id: number | null; step_id: string | null; cost_usd: number; tokens: number; dismissed: number; extra: string;
};

function toRun(r: RunRow): Run {
  return {
    id: r.id, agentId: r.agent_id, task: r.task, mode: r.mode as Run["mode"], trigger: r.trigger as Run["trigger"],
    status: r.status as Run["status"], stopReason: r.stop_reason, result: r.result, plan: r.plan, sessionId: r.session_id,
    branch: r.branch, worktree: r.worktree, prUrl: r.pr_url, steps: JSON.parse(r.steps) as Step[], activity: r.activity,
    pid: r.pid, startedAt: r.started_at, endedAt: r.ended_at,
    workflowRunId: r.workflow_run_id, stepId: r.step_id, costUsd: r.cost_usd, tokens: r.tokens, dismissed: !!r.dismissed,
    extra: JSON.parse(r.extra || "{}") as RunExtra,
  };
}

export function getRun(id: number): Run | null {
  const r = db().prepare("SELECT * FROM runs WHERE id = ?").get(id) as RunRow | undefined;
  return r ? toRun(r) : null;
}

export function listRunsForWorkflowRun(wfRunId: number): Run[] {
  return (db().prepare("SELECT * FROM runs WHERE workflow_run_id = ? ORDER BY id").all(wfRunId) as RunRow[]).map(toRun);
}

export function runsSince(ms: number): Run[] {
  return (db().prepare("SELECT * FROM runs WHERE started_at >= ? ORDER BY id").all(ms) as RunRow[]).map(toRun);
}

export function recentStoppedRuns(sinceMs: number): Run[] {
  return (db().prepare("SELECT * FROM runs WHERE status = 'stopped' AND dismissed = 0 AND ended_at >= ? AND workflow_run_id IS NULL ORDER BY ended_at DESC").all(sinceMs) as RunRow[]).map(toRun);
}

// Task runs that finished without really doing anything (see lib/quiet.ts).
export function recentQuietRuns(sinceMs: number): Run[] {
  return (db().prepare("SELECT * FROM runs WHERE status = 'done' AND dismissed = 0 AND ended_at >= ? AND workflow_run_id IS NULL AND json_extract(extra, '$.quiet') IS NOT NULL ORDER BY ended_at DESC").all(sinceMs) as RunRow[]).map(toRun);
}

export function addRunUsage(id: number, costUsd: number, tokens: number) {
  db().prepare("UPDATE runs SET cost_usd = cost_usd + ?, tokens = tokens + ? WHERE id = ?").run(costUsd, tokens, id);
}

export function dismissRun(id: number) {
  db().prepare("UPDATE runs SET dismissed = 1 WHERE id = ?").run(id);
}

export function listRuns(agentId: number, limit = 50): Run[] {
  return (db().prepare("SELECT * FROM runs WHERE agent_id = ? ORDER BY started_at DESC, id DESC LIMIT ?").all(agentId, limit) as RunRow[]).map(toRun);
}

export function runsWithStatus(...statuses: Run["status"][]): Run[] {
  const q = `SELECT * FROM runs WHERE status IN (${statuses.map(() => "?").join(",")}) ORDER BY id`;
  return (db().prepare(q).all(...statuses) as RunRow[]).map(toRun);
}

export function activeRun(agentId: number): Run | null {
  const r = db().prepare("SELECT * FROM runs WHERE agent_id = ? AND status IN ('queued','working','waiting') ORDER BY id DESC LIMIT 1").get(agentId) as RunRow | undefined;
  return r ? toRun(r) : null;
}

export function createRun(r: {
  agentId: number; task: string; mode: Run["mode"]; trigger: Run["trigger"]; steps: Step[];
  status?: "working" | "queued"; activity?: string; workflowRunId?: number | null; stepId?: string | null; extra?: RunExtra;
}): Run {
  const id = db()
    .prepare("INSERT INTO runs (agent_id, task, mode, trigger, status, steps, activity, started_at, workflow_run_id, step_id, extra) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run(
      r.agentId, r.task, r.mode, r.trigger, r.status ?? "working", JSON.stringify(r.steps), r.activity ?? "Getting ready…", Date.now(),
      r.workflowRunId ?? null, r.stepId ?? null, JSON.stringify(r.extra ?? {}),
    ).lastInsertRowid as number;
  return getRun(id)!;
}

const RUN_COLS: Record<string, string> = {
  status: "status", stopReason: "stop_reason", result: "result", plan: "plan", sessionId: "session_id", branch: "branch",
  worktree: "worktree", prUrl: "pr_url", steps: "steps", activity: "activity", pid: "pid", endedAt: "ended_at", mode: "mode",
  startedAt: "started_at", extra: "extra",
};

export function updateRun(id: number, patch: Partial<Run>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    const col = RUN_COLS[k];
    if (!col) continue;
    sets.push(`${col} = ?`);
    vals.push(k === "steps" || k === "extra" ? JSON.stringify(v) : v);
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

export function pendingApprovals(): Approval[] {
  return (db().prepare("SELECT * FROM approvals WHERE status = 'pending' ORDER BY id DESC").all() as ApprovalRow[]).map(toApproval);
}

// ---------- ideas ----------

export function listIdeas(): Idea[] {
  return (db().prepare("SELECT * FROM ideas ORDER BY id DESC").all() as { id: number; text: string; created_at: number }[]).map((r) => ({
    id: r.id, text: r.text, createdAt: r.created_at,
  }));
}

export function addIdea(text: string): number {
  return db().prepare("INSERT INTO ideas (text, created_at) VALUES (?, ?)").run(text, Date.now()).lastInsertRowid as number;
}

export function deleteIdea(id: number) {
  db().prepare("DELETE FROM ideas WHERE id = ?").run(id);
}

// ---------- workflows ----------

type WorkflowRow = {
  id: number; name: string; project: string; enabled: number; steps: string; limits: string; next_run_at: number | null;
  created_at: number; updated_at: number;
};


function toWorkflow(r: WorkflowRow): Workflow {
  return {
    id: r.id, name: r.name, project: r.project, enabled: !!r.enabled, steps: JSON.parse(r.steps),
    limits: { ...DEFAULT_LIMITS, ...JSON.parse(r.limits || "{}") }, nextRunAt: r.next_run_at, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function listWorkflows(): Workflow[] {
  return (db().prepare("SELECT * FROM workflows ORDER BY id").all() as WorkflowRow[]).map(toWorkflow);
}

export function getWorkflow(id: number): Workflow | null {
  const r = db().prepare("SELECT * FROM workflows WHERE id = ?").get(id) as WorkflowRow | undefined;
  return r ? toWorkflow(r) : null;
}

export function createWorkflow(w: WorkflowInput, note: string): Workflow {
  const now = Date.now();
  const id = db()
    .prepare("INSERT INTO workflows (name, project, enabled, steps, limits, created_at, updated_at) VALUES (?,?,0,?,?,?,?)")
    .run(w.name, w.project, JSON.stringify(w.steps), JSON.stringify(w.limits), now, now).lastInsertRowid as number;
  addVersion(id, w, note);
  return getWorkflow(id)!;
}

export function updateWorkflow(id: number, w: WorkflowInput, note = "Saved"): Workflow | null {
  db().prepare("UPDATE workflows SET name = ?, project = ?, steps = ?, limits = ?, updated_at = ?, next_run_at = NULL WHERE id = ?")
    .run(w.name, w.project, JSON.stringify(w.steps), JSON.stringify(w.limits), Date.now(), id);
  addVersion(id, w, note);
  return getWorkflow(id);
}

export function setWorkflowEnabled(id: number, enabled: boolean) {
  db().prepare("UPDATE workflows SET enabled = ?, next_run_at = NULL WHERE id = ?").run(enabled ? 1 : 0, id);
  if (!enabled) db().prepare("DELETE FROM workflow_seen WHERE workflow_id = ?").run(id);
}

export function setWorkflowNextRunAt(id: number, at: number | null) {
  db().prepare("UPDATE workflows SET next_run_at = ? WHERE id = ?").run(at, id);
}

export function deleteWorkflow(id: number) {
  db().prepare("UPDATE runs SET workflow_run_id = NULL WHERE workflow_run_id IN (SELECT id FROM workflow_runs WHERE workflow_id = ?)").run(id);
  db().prepare("DELETE FROM workflow_runs WHERE workflow_id = ?").run(id);
  db().prepare("DELETE FROM workflow_versions WHERE workflow_id = ?").run(id);
  db().prepare("DELETE FROM workflow_seen WHERE workflow_id = ?").run(id);
  db().prepare("DELETE FROM workflows WHERE id = ?").run(id);
}

function addVersion(workflowId: number, w: WorkflowInput, note: string) {
  const last = db().prepare("SELECT def FROM workflow_versions WHERE workflow_id = ? ORDER BY id DESC LIMIT 1").get(workflowId) as { def: string } | undefined;
  const def = JSON.stringify({ name: w.name, project: w.project, steps: w.steps, limits: w.limits });
  if (last?.def === def) return; // nothing changed
  db().prepare("INSERT INTO workflow_versions (workflow_id, saved_at, note, def) VALUES (?,?,?,?)").run(workflowId, Date.now(), note, def);
}

export function listVersions(workflowId: number): WorkflowVersion[] {
  return (db().prepare("SELECT * FROM workflow_versions WHERE workflow_id = ? ORDER BY id DESC LIMIT 50").all(workflowId) as {
    id: number; workflow_id: number; saved_at: number; note: string; def: string;
  }[]).map((r) => ({ id: r.id, workflowId: r.workflow_id, savedAt: r.saved_at, note: r.note, def: JSON.parse(r.def) }));
}

export function markSeen(workflowId: number, key: string): boolean {
  return db().prepare("INSERT OR IGNORE INTO workflow_seen (workflow_id, key) VALUES (?, ?)").run(workflowId, key).changes > 0;
}

export function hasSeenAny(workflowId: number): boolean {
  return !!db().prepare("SELECT 1 FROM workflow_seen WHERE workflow_id = ? LIMIT 1").get(workflowId);
}

// ---------- workflow runs ----------

type WfRunRow = {
  id: number; workflow_id: number; status: string; test: number; input: string; trigger: string; trigger_ref: string | null;
  branch: string | null; worktree: string | null; pr_url: string | null; current: number; steps: string; step_runs: string;
  loops: number; feedback: string | null; gates: string; waiting: string | null; stop_reason: string | null; summary: string | null;
  usage_start: string | null; waited_ms: number; started_at: number; ended_at: number | null; quiet: string | null;
};

function toWfRun(r: WfRunRow): WorkflowRun {
  return {
    id: r.id, workflowId: r.workflow_id, status: r.status as WorkflowRun["status"], test: !!r.test, input: r.input,
    trigger: r.trigger as WorkflowRun["trigger"], triggerRef: r.trigger_ref, branch: r.branch, worktree: r.worktree, prUrl: r.pr_url,
    current: r.current, steps: JSON.parse(r.steps), stepRuns: JSON.parse(r.step_runs), loops: r.loops, feedback: r.feedback,
    gates: JSON.parse(r.gates), waiting: r.waiting ? JSON.parse(r.waiting) : null, stopReason: r.stop_reason, summary: r.summary,
    usageStart: r.usage_start ? JSON.parse(r.usage_start) : null, waitedMs: r.waited_ms, startedAt: r.started_at, endedAt: r.ended_at,
    quiet: r.quiet ? JSON.parse(r.quiet) : null,
  };
}

export function createWfRun(r: Pick<WorkflowRun, "workflowId" | "status" | "test" | "input" | "trigger" | "triggerRef" | "steps" | "stepRuns">): WorkflowRun {
  const id = db()
    .prepare("INSERT INTO workflow_runs (workflow_id, status, test, input, trigger, trigger_ref, steps, step_runs, started_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(r.workflowId, r.status, r.test ? 1 : 0, r.input, r.trigger, r.triggerRef, JSON.stringify(r.steps), JSON.stringify(r.stepRuns), Date.now())
    .lastInsertRowid as number;
  return getWfRun(id)!;
}

export function getWfRun(id: number): WorkflowRun | null {
  const r = db().prepare("SELECT * FROM workflow_runs WHERE id = ?").get(id) as WfRunRow | undefined;
  return r ? toWfRun(r) : null;
}

export function listWfRuns(workflowId: number, limit = 30): WorkflowRun[] {
  return (db().prepare("SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY id DESC LIMIT ?").all(workflowId, limit) as WfRunRow[]).map(toWfRun);
}

export function wfRunsWithStatus(...statuses: WorkflowRun["status"][]): WorkflowRun[] {
  const q = `SELECT * FROM workflow_runs WHERE status IN (${statuses.map(() => "?").join(",")}) ORDER BY id`;
  return (db().prepare(q).all(...statuses) as WfRunRow[]).map(toWfRun);
}

export function recentStoppedWfRuns(sinceMs: number): WorkflowRun[] {
  return (db().prepare("SELECT * FROM workflow_runs WHERE status = 'stopped' AND ended_at >= ? AND (summary IS NULL OR summary != 'dismissed') ORDER BY ended_at DESC").all(sinceMs) as WfRunRow[]).map(toWfRun);
}

// Finished, but didn't really do anything (see lib/quiet.ts). Dismissing clears the note.
export function recentQuietWfRuns(sinceMs: number): WorkflowRun[] {
  return (db().prepare("SELECT * FROM workflow_runs WHERE status = 'done' AND quiet IS NOT NULL AND ended_at >= ? ORDER BY ended_at DESC").all(sinceMs) as WfRunRow[]).map(toWfRun);
}

const WF_COLS: Record<string, string> = {
  status: "status", branch: "branch", worktree: "worktree", prUrl: "pr_url", current: "current", stepRuns: "step_runs", loops: "loops",
  feedback: "feedback", gates: "gates", waiting: "waiting", stopReason: "stop_reason", summary: "summary", usageStart: "usage_start",
  endedAt: "ended_at", startedAt: "started_at", waitedMs: "waited_ms", quiet: "quiet",
};
const WF_JSON = new Set(["stepRuns", "gates", "waiting", "usageStart", "quiet"]);

export function updateWfRun(id: number, patch: Partial<WorkflowRun>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    const col = WF_COLS[k];
    if (!col) continue;
    sets.push(`${col} = ?`);
    vals.push(WF_JSON.has(k) ? (v === null ? null : JSON.stringify(v)) : v);
  }
  if (!sets.length) return;
  db().prepare(`UPDATE workflow_runs SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
}

// For the Helper: everything active, then the newest of the rest.
export function readRecentRuns(n: number): Run[] {
  const active = (db().prepare("SELECT * FROM runs WHERE status IN ('queued','working','waiting','review') ORDER BY id DESC").all() as RunRow[]).map(toRun);
  const rest = (db().prepare("SELECT * FROM runs WHERE status NOT IN ('queued','working','waiting','review') ORDER BY id DESC LIMIT ?").all(n) as RunRow[]).map(toRun);
  return [...active, ...rest].slice(0, Math.max(n, active.length));
}

export function recentWfRuns(n: number): WorkflowRun[] {
  const active = (db().prepare("SELECT * FROM workflow_runs WHERE status IN ('queued','running','needs') ORDER BY id DESC").all() as WfRunRow[]).map(toWfRun);
  const rest = (db().prepare("SELECT * FROM workflow_runs WHERE status NOT IN ('queued','running','needs') ORDER BY id DESC LIMIT ?").all(n) as WfRunRow[]).map(toWfRun);
  return [...active, ...rest].slice(0, Math.max(n, active.length));
}
