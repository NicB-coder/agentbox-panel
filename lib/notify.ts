import { execFile } from "node:child_process";
import type { Agent, NotifyOn } from "./types";

// Discord pings. The webhook URL lives only in the macOS Keychain (item "discord-heartbeat")
// and is read on demand; it is never written to disk or logs.

function webhook(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile("/usr/bin/security", ["find-generic-password", "-s", "discord-heartbeat", "-w"], { timeout: 5000 }, (err, stdout) => {
      resolve(err ? null : stdout.trim() || null);
    });
  });
}

export async function notify(agent: Agent, kind: NotifyOn, text: string) {
  if (!agent.notify.includes(kind)) return;
  const url = await webhook();
  if (!url) {
    console.warn("[notify] no Discord webhook in the Keychain");
    return;
  }
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: `agentbox · ${agent.name}: ${text}`.slice(0, 1900), allowed_mentions: { parse: [] } }),
    });
  } catch (e) {
    console.warn("[notify] Discord ping failed:", (e as Error).message);
  }
}
