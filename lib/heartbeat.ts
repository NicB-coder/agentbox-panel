import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { HeartbeatInfo, HeartbeatRun } from "./types";

// The heartbeat is an existing launchd job (com.agentbox.heartbeat) that runs ~/agents/heartbeat/run.sh
// every hour. Its out.log/err.log stay empty when things go well, so the real record of each check-in
// is the Claude Code transcript it leaves behind in ~/.claude/projects/-Users-<user>-agents-heartbeat/.

const LABEL = "com.agentbox.heartbeat";
const HB_DIR = path.join(os.homedir(), "agents", "heartbeat");
const TRANSCRIPTS = path.join(os.homedir(), ".claude", "projects", HB_DIR.replace(/[^A-Za-z0-9]/g, "-"));
const ON_TIME_MS = 5 * 60 * 1000;

let cache: { at: number; info: HeartbeatInfo } | null = null;

function tail(file: string, bytes = 4000): string {
  try {
    const st = fs.statSync(file);
    if (!st.size) return "";
    const fd = fs.openSync(file, "r");
    const len = Math.min(bytes, st.size);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, st.size - len);
    fs.closeSync(fd);
    return buf.toString("utf8");
  } catch {
    return "";
  }
}

function launchdState(): { loaded: boolean; running: boolean; lastExitCode: number | null } {
  try {
    const uid = process.getuid?.() ?? 501;
    const out = execFileSync("/bin/launchctl", ["print", `gui/${uid}/${LABEL}`], { encoding: "utf8", timeout: 3000 });
    const exit = out.match(/last exit code = (-?\d+)/);
    return { loaded: true, running: /state = running/.test(out), lastExitCode: exit ? Number(exit[1]) : null };
  } catch {
    return { loaded: false, running: false, lastExitCode: null };
  }
}

// One transcript per run. Read just enough of it to find when it started and what Claude replied.
function readRun(file: string): HeartbeatRun | null {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  let at: number | null = null;
  let reply: string | null = null;
  for (const line of text.split("\n")) {
    if (!line) continue;
    let o: { type?: string; timestamp?: string; message?: { content?: unknown } };
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (at === null && o.type === "user" && o.timestamp) at = Date.parse(o.timestamp);
    if (o.type === "assistant" && Array.isArray(o.message?.content)) {
      for (const c of o.message.content as { type: string; text?: string }[]) if (c.type === "text" && c.text) reply = c.text.trim();
    }
  }
  if (at === null) return null;
  const d = new Date(at);
  const intoHour = d.getMinutes() * 60000 + d.getSeconds() * 1000;
  return { at, onTime: intoHour <= ON_TIME_MS, reply: reply ? reply.slice(0, 200) : null };
}

export function readHeartbeat(): HeartbeatInfo {
  if (cache && Date.now() - cache.at < 10_000) return cache.info;
  const ld = launchdState();
  const runs: HeartbeatRun[] = [];
  try {
    const files = fs.readdirSync(TRANSCRIPTS).filter((f) => f.endsWith(".jsonl"));
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    for (const f of files) {
      const full = path.join(TRANSCRIPTS, f);
      if (fs.statSync(full).mtimeMs < weekAgo) continue;
      const r = readRun(full);
      if (r) runs.push(r);
    }
  } catch {
    /* no transcripts yet */
  }
  runs.sort((a, b) => b.at - a.at);

  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const todayRuns = runs.filter((r) => r.at >= midnight.getTime());
  // The job fires at minute 0 of every hour, so by now today it should have run once per hour so far
  // (a run that's due this hour counts once 5 minutes have passed).
  const now = new Date();
  const expectedToday = now.getHours() + (now.getMinutes() * 60000 >= ON_TIME_MS ? 1 : 0);
  // Count each hour slot once, so a manual extra run doesn't inflate the number.
  const onTimeHours = new Set(todayRuns.filter((r) => r.onTime).map((r) => new Date(r.at).getHours()));

  const info: HeartbeatInfo = {
    ...ld,
    todayRuns,
    expectedToday: Math.max(expectedToday, onTimeHours.size),
    onTimeToday: onTimeHours.size,
    recent: runs.slice(0, 24),
    errLogTail: tail(path.join(HB_DIR, "err.log")),
    outLogTail: tail(path.join(HB_DIR, "out.log")),
  };
  cache = { at: Date.now(), info };
  return info;
}
