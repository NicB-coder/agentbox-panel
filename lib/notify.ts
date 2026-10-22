import { execFile } from "node:child_process";
import { getSetting, setSetting } from "./db";
import type { Agent, NotifyOn } from "./types";

// Discord pings. The webhook URL lives only in the macOS Keychain (item "discord-heartbeat")
// and is read on demand; it is never written to disk or logs.
//
// Every message waits for Discord to confirm it (?wait=true returns the posted message), retries once,
// and is written to a short log Nic can see in Settings, so a "silent" message can always be traced.

function webhook(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile("/usr/bin/security", ["find-generic-password", "-s", "discord-heartbeat", "-w"], { timeout: 5000 }, (err, stdout) => {
      resolve(err ? null : stdout.trim() || null);
    });
  });
}

export type DiscordLogEntry = { at: number; ok: boolean; text: string; why?: string };
export type PingWhat = "shipped" | "needs_ok";

// Whether to @here on Discord for the things that matter most (on by default, so they make a sound).
export function pingSettings(): Record<PingWhat, boolean> {
  return { shipped: true, needs_ok: true, ...getSetting<Partial<Record<PingWhat, boolean>>>("discordPing", {}) };
}

export async function notify(agent: Agent, kind: NotifyOn, text: string) {
  if (!agent.notify.includes(kind)) return;
  await sendDiscord(`agentbox · ${agent.name}: ${text}`, { ping: kind === "needs_ok" ? "needs_ok" : undefined });
}

function logSend(e: DiscordLogEntry) {
  const list = getSetting<DiscordLogEntry[]>("discordLog", []);
  setSetting("discordLog", [e, ...list].slice(0, 30));
}

export function discordLog(): DiscordLogEntry[] {
  return getSetting<DiscordLogEntry[]>("discordLog", []);
}

export async function sendDiscord(content: string, opts: { title?: string; url?: string; ping?: PingWhat } = {}): Promise<boolean> {
  const first = (opts.title ?? content).split("\n")[0].slice(0, 140);
  if (process.env.AGENTBOX_NO_DISCORD === "1") {
    console.log(`[notify] (dev copy, not sent) ${opts.title ? `${opts.title} · ` : ""}${content.slice(0, 300)}`);
    logSend({ at: Date.now(), ok: true, text: first, why: "Test copy: not really sent" });
    return true;
  }
  const url = await webhook();
  if (!url) {
    console.warn("[notify] no Discord webhook in the Keychain");
    logSend({ at: Date.now(), ok: false, text: first, why: "There's no Discord webhook in the Keychain (discord-heartbeat)." });
    return false;
  }
  const mention = opts.ping && pingSettings()[opts.ping];
  const body = opts.title
    ? {
        content: mention ? "@here" : undefined,
        embeds: [{ title: opts.title.slice(0, 250), description: content.slice(0, 3800), url: opts.url, color: 0x2b8a3e }],
        allowed_mentions: { parse: mention ? ["everyone"] : [] },
      }
    : { content: `${mention ? "@here " : ""}${content}`.slice(0, 1900), allowed_mentions: { parse: mention ? ["everyone"] : [] } };
  let why = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`${url}${url.includes("?") ? "&" : "?"}wait=true`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as { id?: string; message?: string; retry_after?: number };
      if (r.ok && j.id) {
        logSend({ at: Date.now(), ok: true, text: first });
        return true;
      }
      why = r.status === 429 ? "Discord said to slow down" : `Discord said no (${r.status}${j.message ? `: ${j.message}` : ""})`;
      if (r.status === 429) await new Promise((res) => setTimeout(res, Math.min(10_000, (j.retry_after ?? 2) * 1000)));
    } catch (e) {
      why = `Couldn't reach Discord (${(e as Error).message})`;
      await new Promise((res) => setTimeout(res, 3000));
    }
  }
  console.warn("[notify] Discord ping failed:", why);
  logSend({ at: Date.now(), ok: false, text: first, why });
  return false;
}
