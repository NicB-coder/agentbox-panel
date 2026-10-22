import { execFile, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DATA_DIR } from "./db";

// Supervised processes: every Claude Code session an agent runs is its own launchd job (in this account),
// not a child of the panel. The panel can restart or update while it keeps going, and reattaches by
// reading the files it writes. If launchd isn't available it falls back to a detached process.

export const PROC_DIR = path.join(DATA_DIR, "procs");
const RUNNER = path.join(process.cwd(), "scripts", "proc-runner.mjs");
const NODE = process.execPath;
// A short tag per data folder, so a dev copy's jobs never clash with the real panel's.
const TAG = crypto.createHash("sha1").update(DATA_DIR).digest("hex").slice(0, 6);
const UID = typeof process.getuid === "function" ? process.getuid() : 501;

export type ProcHandle = {
  key: string;
  label: string;
  out: string;
  err: string;
  exit: string;
  pidFile: string;
  plist: string | null;
  startedAt: number;
};

export type ProcExit = { code: number | null; signal: string | null; at: number; stopped?: boolean; error?: string };

function launchctl(args: string[]): Promise<{ ok: boolean; err: string }> {
  return new Promise((resolve) =>
    execFile("/bin/launchctl", args, { timeout: 15_000 }, (e, _o, stderr) => resolve({ ok: !e, err: String(stderr || (e ? e.message : "")) })),
  );
}

function plistXml(label: string, args: string[], logFile: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${esc(label)}</string>
  <key>ProgramArguments</key><array>${args.map((a) => `<string>${esc(a)}</string>`).join("")}</array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
  <key>AbandonProcessGroup</key><true/>
  <key>ProcessType</key><string>Interactive</string>
  <key>StandardOutPath</key><string>${esc(logFile)}</string>
  <key>StandardErrorPath</key><string>${esc(logFile)}</string>
</dict>
</plist>
`;
}

// Starts `cmd args` under launchd. Returns once it has been handed over (not when it ends).
export async function launch(key: string, cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<ProcHandle> {
  fs.mkdirSync(PROC_DIR, { recursive: true, mode: 0o700 });
  const base = path.join(PROC_DIR, key);
  const h: ProcHandle = {
    key,
    label: `com.agentbox.run.${TAG}.${key}`,
    out: `${base}.out`,
    err: `${base}.err`,
    exit: `${base}.exit`,
    pidFile: `${base}.pid`,
    plist: null,
    startedAt: Date.now(),
  };
  for (const f of [h.out, h.err, h.exit, h.pidFile]) fs.rmSync(f, { force: true });
  const specFile = `${base}.json`;
  fs.writeFileSync(specFile, JSON.stringify({ cmd, args, cwd, env, out: h.out, err: h.err, exit: h.exit, pidFile: h.pidFile }), { mode: 0o600 });

  if (process.env.AGENTBOX_NO_LAUNCHD !== "1") {
    const plist = `${base}.plist`;
    fs.writeFileSync(plist, plistXml(h.label, [NODE, RUNNER, specFile], `${base}.runner.log`), { mode: 0o600 });
    await launchctl(["bootout", `gui/${UID}/${h.label}`]); // a leftover with the same name
    const r = await launchctl(["bootstrap", `gui/${UID}`, plist]);
    if (r.ok) {
      h.plist = plist;
      return h;
    }
    console.warn(`[proc] launchd said no (${r.err.trim()}); starting ${key} as a detached process instead`);
    fs.rmSync(plist, { force: true });
  }
  const child = spawn(NODE, [RUNNER, specFile], { detached: true, stdio: "ignore", cwd, env });
  child.unref();
  return h;
}

export function readPids(h: ProcHandle): { runner: number; child: number } | null {
  try {
    return JSON.parse(fs.readFileSync(h.pidFile, "utf8"));
  } catch {
    return null;
  }
}

export function exitInfo(h: ProcHandle): ProcExit | null {
  try {
    return JSON.parse(fs.readFileSync(h.exit, "utf8"));
  } catch {
    return null;
  }
}

function alivePid(pid: number | undefined | null): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

// Still going? (Its runner or Claude itself is alive and it hasn't written an exit file.)
export function isAlive(h: ProcHandle): boolean {
  if (exitInfo(h)) return false;
  const p = readPids(h);
  if (!p) return Date.now() - h.startedAt < 60_000; // just handed over; give launchd a moment
  return alivePid(p.runner) || alivePid(p.child);
}

// Reads output written since `offset`. Returns whole lines only and the new offset.
export function readNew(file: string, offset: number): { lines: string[]; offset: number } {
  let fd: number;
  try {
    fd = fs.openSync(file, "r");
  } catch {
    return { lines: [], offset };
  }
  try {
    const size = fs.fstatSync(fd).size;
    if (size <= offset) return { lines: [], offset };
    const len = Math.min(size - offset, 8 * 1024 * 1024);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, offset);
    const text = buf.toString("utf8");
    const last = text.lastIndexOf("\n");
    if (last < 0) return { lines: [], offset };
    const whole = text.slice(0, last);
    return { lines: whole.split("\n").filter((l) => l.trim()), offset: offset + Buffer.byteLength(whole, "utf8") + 1 };
  } finally {
    fs.closeSync(fd);
  }
}

export function tail(file: string, bytes = 4000): string {
  try {
    const st = fs.statSync(file);
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

// Asks it to stop (its runner takes down Claude and everything Claude started).
export function stopProc(h: ProcHandle) {
  const p = readPids(h);
  for (const pid of [p?.runner]) {
    try {
      if (pid) process.kill(pid, "SIGTERM");
    } catch {
      /* gone */
    }
  }
  if (p?.child && !alivePid(p.runner)) {
    try {
      process.kill(-p.child, "SIGTERM");
    } catch {
      /* gone */
    }
  }
  setTimeout(() => {
    if (p?.child && alivePid(p.child)) {
      try {
        process.kill(-p.child, "SIGKILL");
      } catch {
        /* gone */
      }
    }
  }, 10_000).unref();
}

// Tidies up launchd and the files once the panel has read everything.
export async function cleanup(h: ProcHandle) {
  if (h.plist) {
    await launchctl(["bootout", `gui/${UID}/${h.label}`]);
    fs.rmSync(h.plist, { force: true });
  }
  const base = path.join(PROC_DIR, h.key);
  for (const ext of [".json", ".pid", ".exit", ".runner.log"]) fs.rmSync(base + ext, { force: true });
  // Output files stay a little while for the log; old ones are swept by sweepProcFiles.
}

export function sweepProcFiles(maxAgeMs = 3 * 86400_000) {
  try {
    for (const f of fs.readdirSync(PROC_DIR)) {
      const p = path.join(PROC_DIR, f);
      if (Date.now() - fs.statSync(p).mtimeMs > maxAgeMs) fs.rmSync(p, { force: true });
    }
  } catch {
    /* nothing yet */
  }
}

export const homeDir = os.homedir();
