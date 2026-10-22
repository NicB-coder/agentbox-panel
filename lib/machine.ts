import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listAgents } from "./db";
import { readHeartbeat } from "./heartbeat";
import { cleanEnv } from "./runner";

// The Machine page: battery, disk, uptime, Tailscale, heartbeat, who's signed in, and when things last restarted.

function run(cmd: string, args: string[], timeout = 15_000): Promise<{ ok: boolean; out: string; err: string }> {
  return new Promise((resolve) =>
    execFile(cmd, args, { timeout, env: cleanEnv(), cwd: os.homedir(), maxBuffer: 4 * 1024 * 1024 }, (e, o, er) => resolve({ ok: !e, out: String(o).trim(), err: String(er).trim() })),
  );
}

export type MachineInfo = {
  name: string;
  battery: { pct: number | null; charging: boolean; plugged: boolean; text: string } | null;
  disk: { freeGb: number; totalGb: number; usedPct: number; low: boolean; copiesGb: number | null };
  bootedAt: number | null;
  panelStartedAt: number;
  tailscale: { connected: boolean; name: string | null; text: string };
  heartbeat: { text: string; ok: boolean };
  macUsers: string[];
  claude: { signedIn: boolean; text: string };
  github: { signedIn: boolean; text: string };
  discord: boolean;
  version: { commit: string; date: string; branch: string } | null;
  heartbeatId: number | null;
};

type G = typeof globalThis & { __panelStartedAt?: number; __machineCache?: { at: number; info: MachineInfo }; __copiesGb?: { at: number; gb: number | null } };
const g = globalThis as G;
g.__panelStartedAt ??= Date.now();

export const LOW_DISK_GB = 15;

export async function machineInfo(fresh = false): Promise<MachineInfo> {
  if (!fresh && g.__machineCache && Date.now() - g.__machineCache.at < 20_000) return g.__machineCache.info;
  const [batt, df, boot, ts, who, claude, gh, kc, ver, branch] = await Promise.all([
    run("/usr/bin/pmset", ["-g", "batt"]),
    run("/bin/df", ["-k", os.homedir()]),
    run("/usr/sbin/sysctl", ["-n", "kern.boottime"]),
    run("/Applications/Tailscale.app/Contents/MacOS/Tailscale", ["status", "--json"], 8_000),
    run("/usr/bin/who", []),
    run("claude", ["auth", "status", "--json"], 20_000),
    run("gh", ["auth", "status", "--hostname", "github.com"], 20_000),
    run("/usr/bin/security", ["find-generic-password", "-s", "discord-heartbeat"]),
    run("git", ["-C", process.cwd(), "log", "-1", "--format=%h%n%cI"]),
    run("git", ["-C", process.cwd(), "rev-parse", "--abbrev-ref", "HEAD"]),
  ]);

  let battery: MachineInfo["battery"] = null;
  const b = batt.out.match(/(\d+)%;\s*([^;]+);/);
  if (b) {
    const state = b[2].trim();
    const plugged = /AC Power/.test(batt.out);
    const charging = state === "charging";
    battery = { pct: Number(b[1]), charging, plugged, text: plugged ? (charging ? "Plugged in, charging" : "Plugged in") : "On battery" };
  }

  const cols = df.out.split("\n").pop()?.trim().split(/\s+/) ?? [];
  const total = Number(cols[1] ?? 0) / 1024 / 1024;
  const free = Number(cols[3] ?? 0) / 1024 / 1024;
  const disk = { freeGb: Math.round(free), totalGb: Math.round(total), usedPct: total ? Math.round(((total - free) / total) * 100) : 0, low: free < LOW_DISK_GB, copiesGb: copiesGb() };

  const bootSec = boot.out.match(/sec = (\d+)/)?.[1];

  let tailscale: MachineInfo["tailscale"] = { connected: false, name: null, text: "Can't tell (Tailscale isn't answering)" };
  if (ts.ok) {
    try {
      const j = JSON.parse(ts.out) as { BackendState?: string; Self?: { DNSName?: string; Online?: boolean } };
      const connected = j.BackendState === "Running";
      tailscale = { connected, name: j.Self?.DNSName?.replace(/\.$/, "") ?? null, text: connected ? "Connected" : `Not connected (${(j.BackendState ?? "stopped").toLowerCase()})` };
    } catch {
      /* keep "can't tell" */
    }
  }

  const hb = readHeartbeat();
  const last = hb.recent[0];
  const heartbeat = {
    ok: hb.loaded && !!last && Date.now() - last.at < 75 * 60_000,
    text: !hb.loaded ? "The hourly check-in isn't switched on" : `${hb.onTimeToday} of ${hb.expectedToday} on time today${last ? `, last one ${Math.round((Date.now() - last.at) / 60_000)} min ago` : ""}`,
  };

  const macUsers = [...new Set(who.out.split("\n").filter((l) => /console/.test(l)).map((l) => l.split(/\s+/)[0]))];

  let claudeInfo = { signedIn: false, text: "Not signed in" };
  try {
    const j = JSON.parse(claude.out) as { loggedIn?: boolean; email?: string; authMethod?: string };
    if (j.loggedIn) claudeInfo = { signedIn: true, text: `Signed in${j.authMethod === "claude.ai" ? " with your Claude account" : ""}` };
  } catch {
    if (!claude.ok) claudeInfo = { signedIn: false, text: "Not signed in (or Claude Code isn't answering)" };
  }
  const ghText = `${gh.out}\n${gh.err}`;
  const ghUser = ghText.match(/account (\S+)/)?.[1];
  const github = gh.ok && ghUser ? { signedIn: true, text: `Signed in as ${ghUser}` } : { signedIn: false, text: "Not signed in" };

  const [commit, date] = ver.out.split("\n");
  const info: MachineInfo = {
    name: "agentbox",
    battery,
    disk,
    bootedAt: bootSec ? Number(bootSec) * 1000 : null,
    panelStartedAt: g.__panelStartedAt!,
    tailscale,
    heartbeat,
    macUsers,
    claude: claudeInfo,
    github,
    discord: kc.ok,
    version: ver.ok ? { commit, date, branch: branch.out } : null,
    heartbeatId: listAgents().find((a) => a.kind === "heartbeat")?.id ?? null,
  };
  g.__machineCache = { at: Date.now(), info };
  return info;
}

// How much space the agents' copies of projects take (measured at most every 10 minutes, in the background).
function copiesGb(): number | null {
  const c = g.__copiesGb;
  if (!c || Date.now() - c.at > 10 * 60_000) {
    g.__copiesGb = { at: Date.now(), gb: c?.gb ?? null };
    const dir = path.join(os.homedir(), "agents", "worktrees");
    if (fs.existsSync(dir))
      execFile("/usr/bin/du", ["-sk", dir], { timeout: 60_000 }, (e, o) => {
        if (!e) g.__copiesGb = { at: Date.now(), gb: Math.round((Number(String(o).split(/\s+/)[0]) / 1024 / 1024) * 10) / 10 };
      });
  }
  return g.__copiesGb?.gb ?? null;
}

// For the warning banner: true when the disk is getting full.
export function lowDisk(): { low: boolean; freeGb: number } | null {
  try {
    const st = fs.statfsSync(os.homedir());
    const freeGb = Math.round((st.bavail * st.bsize) / 1024 ** 3);
    return { low: freeGb < LOW_DISK_GB, freeGb };
  } catch {
    return null;
  }
}
