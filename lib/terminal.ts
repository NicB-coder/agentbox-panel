import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { cleanEnv } from "./runner";

// The Terminal page: one real shell in this (agent) account, through a small pseudo-terminal bridge.
// The panel keeps the last part of what it printed, so reopening the page shows where you were.

type Session = { id: string; proc: ChildProcess; buf: string; listeners: Set<(s: string) => void>; ended: boolean; startedAt: number };
type G = typeof globalThis & { __term?: Session | null };
const g = globalThis as G;
const KEEP = 200_000;

export function terminalSession(fresh = false): Session {
  if (g.__term && !g.__term.ended && !fresh) return g.__term;
  if (g.__term && !g.__term.ended) g.__term.proc.kill("SIGHUP");
  const proc = spawn("/usr/bin/python3", [path.join(process.cwd(), "scripts", "pty-bridge.py")], {
    cwd: os.homedir(),
    env: { ...cleanEnv(), SHELL: process.env.SHELL || "/bin/zsh", LANG: "en_US.UTF-8", HOME: os.homedir() },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const s: Session = { id: crypto.randomBytes(8).toString("hex"), proc, buf: "", listeners: new Set(), ended: false, startedAt: Date.now() };
  const emit = (chunk: string) => {
    s.buf = (s.buf + chunk).slice(-KEEP);
    for (const l of s.listeners) l(chunk);
  };
  proc.stdout!.setEncoding("utf8");
  proc.stdout!.on("data", emit);
  proc.stderr!.setEncoding("utf8");
  proc.stderr!.on("data", emit);
  proc.on("exit", () => {
    s.ended = true;
    emit("\r\n[The terminal closed. Press New terminal to open another.]\r\n");
  });
  g.__term = s;
  return s;
}

export function currentTerminal(): Session | null {
  return g.__term ?? null;
}

export function sendInput(id: string, data: string): boolean {
  const s = g.__term;
  if (!s || s.id !== id || s.ended) return false;
  s.proc.stdin!.write(`${JSON.stringify({ t: "in", d: data })}\n`);
  return true;
}

export function resizeTerminal(id: string, cols: number, rows: number) {
  const s = g.__term;
  if (!s || s.id !== id || s.ended) return;
  s.proc.stdin!.write(`${JSON.stringify({ t: "size", cols: Math.max(20, Math.min(400, cols)), rows: Math.max(5, Math.min(200, rows)) })}\n`);
}
