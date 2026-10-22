import { execFile } from "node:child_process";
import os from "node:os";
import { CONNECTORS, serverKey } from "./connectors";
import { cleanEnv } from "./runner";

// Which connectors are actually connected, from Claude Code itself (`claude mcp list`), checked at most every few minutes.

export type ConnectorStatus = {
  id: string; name: string; what: string; asks: string;
  state: "connected" | "signin" | "off"; // off = not connected in claude.ai yet
  builtin: boolean; // GitHub: through the bot's own login
};

type G = typeof globalThis & { __connectorCache?: { at: number; list: ConnectorStatus[] }; __connectorBusy?: Promise<ConnectorStatus[]> | null; __connectorExtra?: { id: string; server: string }[] };
const g = globalThis as G;

function run(cmd: string, args: string[]): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => execFile(cmd, args, { cwd: os.homedir(), env: cleanEnv(), timeout: 60_000 }, (e, o, er) => resolve({ ok: !e, out: `${o}\n${er}` })));
}

async function check(): Promise<ConnectorStatus[]> {
  const [mcp, gh] = await Promise.all([run("claude", ["mcp", "list"]), run("gh", ["auth", "status", "--hostname", "github.com"])]);
  const found = new Map<string, "connected" | "signin">();
  for (const line of mcp.out.split("\n")) {
    const m = line.match(/^(.+?):\s+\S+.*-\s+(.*)$/);
    if (!m) continue;
    const state = /✔|connected/i.test(m[2]) && !/auth|sign/i.test(m[2]) ? "connected" : /auth|sign|login/i.test(m[2]) ? "signin" : null;
    if (state) found.set(serverKey(m[1].trim()), state);
  }
  const list: ConnectorStatus[] = CONNECTORS.map((c) => ({
    id: c.id, name: c.name, what: c.what, asks: c.asks, builtin: c.server === null,
    state: c.server === null ? (gh.ok ? "connected" : "signin") : found.get(c.server) ?? "off",
  }));
  // Connectors that aren't on our list (Nic added something else in claude.ai).
  const known = new Set(CONNECTORS.map((c) => c.server));
  const extra: { id: string; server: string }[] = [];
  for (const [server, state] of found) {
    if (known.has(server)) continue;
    const id = server.toLowerCase().replace(/^claude_ai_/, "").replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    extra.push({ id, server });
    list.push({ id, name: server.replace(/^claude_ai_/, "").replace(/_/g, " "), what: "Another app you connected. Agents can use it when you tick it.", asks: "Anything that sends, deletes or changes something", builtin: false, state });
  }
  g.__connectorExtra = extra;
  return list;
}

export async function connectorStatus(fresh = false): Promise<ConnectorStatus[]> {
  if (!fresh && g.__connectorCache && Date.now() - g.__connectorCache.at < 5 * 60_000) return g.__connectorCache.list;
  if (g.__connectorBusy) return g.__connectorBusy;
  g.__connectorBusy = check()
    .then((list) => {
      g.__connectorCache = { at: Date.now(), list };
      return list;
    })
    .finally(() => (g.__connectorBusy = null));
  return g.__connectorBusy;
}

// For pages that render straight away: the last known list (and a refresh in the background).
export function connectorStatusNow(): ConnectorStatus[] {
  const c = g.__connectorCache;
  if (!c || Date.now() - c.at > 5 * 60_000) connectorStatus().catch(() => {});
  return c?.list ?? CONNECTORS.map((x) => ({ id: x.id, name: x.name, what: x.what, asks: x.asks, builtin: x.server === null, state: x.server === null ? "connected" : "off" }));
}
