import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { getAgent, getSetting, getWorkflow, getWfRun, runsSince, runsWithStatus, setSetting } from "./db";
import { draftUsageToday } from "./draftUsage";
import type { UsageBreakdown, UsageState, UsageView, UsageWindow } from "./types";

// Where the numbers come from (checked against Claude Code 2.1.304):
// 1. `claude -p /usage --output-format json` prints the plan's real "Current session: N% used · resets …"
//    and "Current week: N% used · resets …". It's a local command: no model call, no usage spent.
//    We ask it every few minutes.
// 2. Every headless run streams `rate_limit_event`s with the same windows as numbers
//    (unifiedWindows.five_hour.utilization + resetsAt as a Unix time). Fresher, so they win while runs are going.
// 3. A run that fails with a usage-limit error tells us we're out; the reset time comes from the latest
//    rate_limit_event (or /usage) so the countdown is exact.

const EMPTY: UsageState = { session: null, week: null, limited: false, limitedUntil: null, exact: false, source: "none", updatedAt: 0 };
const PATH = [path.join(os.homedir(), ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].join(":");

export function usageState(): UsageState {
  const s = getSetting<UsageState>("usage", EMPTY);
  const now = Date.now();
  // A window that has reset since we last looked starts again from zero.
  const fresh = (w: UsageWindow | null): UsageWindow | null =>
    w && w.resetsAt && w.resetsAt <= now ? { pct: 0, resetsAt: null } : w && w.resetsAt ? { ...w, resetsAt: Math.round(w.resetsAt / 60_000) * 60_000 } : w;
  const out: UsageState = { ...s, session: fresh(s.session), week: fresh(s.week) };
  if (out.limitedUntil) out.limitedUntil = Math.round(out.limitedUntil / 60_000) * 60_000;
  if (out.limited && out.limitedUntil && out.limitedUntil <= now) {
    out.limited = false;
    out.limitedUntil = null;
  }
  // Numbers older than 20 minutes are an estimate.
  if (now - s.updatedAt > 20 * 60_000) out.exact = false;
  return out;
}

function save(patch: Partial<UsageState>) {
  setSetting("usage", { ...getSetting<UsageState>("usage", EMPTY), ...patch, updatedAt: Date.now() });
}

// From a run's stream.
export function ingestRateLimitEvent(info: Record<string, unknown>) {
  const windows = (info.unifiedWindows ?? {}) as Record<string, { utilization?: number; resetsAt?: number }>;
  const win = (w?: { utilization?: number; resetsAt?: number }): UsageWindow | null =>
    w && typeof w.utilization === "number" ? { pct: Math.round(w.utilization * 100), resetsAt: w.resetsAt ? Math.round(w.resetsAt / 60) * 60_000 : null } : null;
  const session = win(windows.five_hour);
  const week = win(windows.seven_day);
  const rejected = info.status === "rejected";
  const resetsAt = typeof info.resetsAt === "number" ? Math.round(info.resetsAt / 60) * 60_000 : null;
  const patch: Partial<UsageState> = { exact: true, source: "run" };
  if (session) patch.session = session;
  if (week) patch.week = week;
  if (rejected) {
    patch.limited = true;
    patch.limitedUntil = resetsAt ?? session?.resetsAt ?? null;
  } else if (info.status === "allowed") {
    patch.limited = false;
    patch.limitedUntil = null;
  }
  save(patch);
}

// A run stopped with a usage-limit error.
export function markLimited(text: string) {
  const s = usageState();
  const until = parseResetFromText(text) ?? s.session?.resetsAt ?? Date.now() + 60 * 60_000;
  save({ limited: true, limitedUntil: until, source: "limit-error" });
  refreshUsage(true);
}

let lastRefresh = 0;
let refreshing = false;

// Ask Claude Code's own /usage command. Free, takes about a fifth of a second.
export function refreshUsage(force = false): Promise<void> {
  if (refreshing || (!force && Date.now() - lastRefresh < 4 * 60_000)) return Promise.resolve();
  refreshing = true;
  lastRefresh = Date.now();
  const env: NodeJS.ProcessEnv = { ...process.env, PATH };
  for (const k of Object.keys(env)) if (k === "CLAUDECODE" || k.startsWith("CLAUDE_CODE_") || k === "ANTHROPIC_API_KEY") delete env[k];
  return new Promise((resolve) => {
    execFile("claude", ["-p", "/usage", "--output-format", "json", "--no-session-persistence"], { cwd: os.tmpdir(), env, timeout: 30_000 }, (err, stdout) => {
      refreshing = false;
      if (!err) {
        try {
          const parsed = parseUsageText(String(JSON.parse(String(stdout)).result ?? ""));
          if (parsed) applyParsed(parsed);
        } catch {
          /* keep the last numbers */
        }
      }
      resolve();
    });
  });
}

function applyParsed(p: { session: UsageWindow | null; week: UsageWindow | null }) {
  const cur = usageState();
  // Prefer the exact reset time we got from a run if it's about the same moment (/usage rounds to the hour).
  const keepReset = (mine: UsageWindow | null, theirs: UsageWindow | null) =>
    mine && theirs && mine.resetsAt && theirs.resetsAt && Math.abs(mine.resetsAt - theirs.resetsAt) < 90 * 60_000 ? { ...mine, resetsAt: theirs.resetsAt } : mine;
  const session = keepReset(p.session, cur.session);
  const week = keepReset(p.week, cur.week);
  const patch: Partial<UsageState> = { exact: true, source: "usage-command" };
  if (session) patch.session = session;
  if (week) patch.week = week;
  if (session && session.pct >= 100) {
    patch.limited = true;
    patch.limitedUntil = session.resetsAt;
  } else if (week && week.pct >= 100) {
    patch.limited = true;
    patch.limitedUntil = week.resetsAt;
  } else if (session) {
    patch.limited = false;
    patch.limitedUntil = null;
  }
  save(patch);
}

// "Current session: 16% used · resets Oct 20 at 3am (America/Los_Angeles)"
export function parseUsageText(text: string): { session: UsageWindow | null; week: UsageWindow | null } | null {
  const line = (re: RegExp): UsageWindow | null => {
    const m = text.match(re);
    if (!m) return null;
    const reset = m[0].match(/resets\s+([^(]+)/i);
    return { pct: Math.min(100, Number(m[1])), resetsAt: reset ? parseResetFromText(reset[1]) : null };
  };
  const session = line(/Current session:\s*(\d+)%[^\n]*/i);
  const week = line(/Current week[^:\n]*:\s*(\d+)%[^\n]*/i);
  return session || week ? { session, week } : null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// "Oct 20 at 3am", "3:30pm", "resets 9pm". Local time (the Mac's own time zone).
export function parseResetFromText(text: string): number | null {
  const t = text.toLowerCase();
  const time = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (!time) return null;
  let h = Number(time[1]) % 12;
  if (time[3] === "pm") h += 12;
  const m = Number(time[2] ?? 0);
  const now = new Date();
  const d = new Date(now);
  const date = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})/);
  if (date) {
    d.setMonth(MONTHS.indexOf(date[1]), Number(date[2]));
    if (d.getTime() < now.getTime() - 180 * 86400_000) d.setFullYear(d.getFullYear() + 1);
  }
  d.setHours(h, m, 0, 0);
  if (!date && d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

// ---------- the guard and the queue ----------

export function guardPct(): number | null {
  return getSetting<number | null>("usageGuardPct", null);
}

export function usageBlocked(): { blocked: boolean; reason: string | null; until: number | null } {
  const s = usageState();
  if (s.limited) return { blocked: true, reason: "out", until: s.limitedUntil };
  const g = guardPct();
  if (g !== null && s.session && s.session.pct >= g) return { blocked: true, reason: "guard", until: s.session.resetsAt };
  return { blocked: false, reason: null, until: null };
}

// ---------- today's breakdown ----------

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function usageView(): UsageView {
  const runs = runsSince(startOfToday());
  const drafts = draftUsageToday();
  const total = runs.reduce((n, r) => n + r.costUsd, 0) + drafts.cost;
  const byAgent = new Map<string, { name: string; color: string; cost: number; runs: number }>();
  const byWorkflow = new Map<string, { name: string; color: string; cost: number; runs: number }>();
  for (const r of runs) {
    if (r.workflowRunId) {
      const wr = getWfRun(r.workflowRunId);
      const wf = wr && getWorkflow(wr.workflowId);
      const key = wf ? `w${wf.id}` : "w?";
      const e = byWorkflow.get(key) ?? { name: wf?.name ?? "A deleted workflow", color: "#7048C8", cost: 0, runs: 0 };
      e.cost += r.costUsd;
      e.runs++;
      byWorkflow.set(key, e);
      continue;
    }
    const a = getAgent(r.agentId);
    const key = `a${r.agentId}`;
    const e = byAgent.get(key) ?? { name: a?.name ?? "A deleted agent", color: a?.color ?? "#555A63", cost: 0, runs: 0 };
    e.cost += r.costUsd;
    e.runs++;
    byAgent.set(key, e);
  }
  if (drafts.count) byWorkflow.set("drafts", { name: "Drafting workflows", color: "#2F4FD8", cost: drafts.cost, runs: drafts.count });
  const list = (m: typeof byAgent): UsageBreakdown =>
    [...m.values()]
      .sort((a, b) => b.cost - a.cost)
      .map((e) => ({ name: e.name, color: e.color, runs: e.runs, share: total > 0 ? Math.round((e.cost / total) * 100) : 0 }));
  const b = usageBlocked();
  return {
    state: usageState(),
    blocked: b.blocked,
    blockedReason: b.reason,
    guardPct: guardPct(),
    queued: runsWithStatus("queued").length,
    byAgent: list(byAgent),
    byWorkflow: list(byWorkflow),
  };
}
