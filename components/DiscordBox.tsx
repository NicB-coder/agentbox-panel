"use client";
import { useEffect, useState } from "react";
import type { DiscordLogEntry } from "@/lib/notify";
import { ago } from "@/lib/words";
import { InfoTip, Switch, post } from "./bits";
import { btn } from "./ui";

// Discord: when it pings you with a sound, a test message, and the last messages it sent (so nothing goes quietly missing).
export default function DiscordBox() {
  const [log, setLog] = useState<DiscordLogEntry[]>([]);
  const [ping, setPing] = useState({ shipped: true, needs_ok: true });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/discord").then((r) => r.json()).then((j) => (setLog(j.log), setPing(j.ping))).catch(() => {});
  }, []);
  // The switch moves at once; if saving fails it moves back and says so.
  async function save(p: Partial<typeof ping>) {
    const before = ping;
    setPing({ ...ping, ...p });
    const j = await post<{ log: DiscordLogEntry[]; ping: typeof ping }>("/api/discord", { ping: p }).catch(() => null);
    if (j) setPing(j.ping);
    else (setPing(before), setMsg("Couldn't save that. Try again."));
  }
  return (
    <section className="panel flex flex-col gap-4 p-6 sm:p-8" aria-labelledby="dc-h">
      <h2 id="dc-h" className="flex items-center text-[18px] font-semibold">
        Discord messages
        <InfoTip text="Agents and workflows message you on Discord when you ticked Tell me. Each job has its own Tell me when, in its settings." label="Discord messages" />
      </h2>
      <Switch label="Ping me when something ships" tip="Adds @here so your phone makes a sound, instead of the message arriving quietly." checked={ping.shipped} onChange={(v) => save({ shipped: v })} />
      <Switch label="Ping me when something needs my OK" tip="Adds @here to messages about plans and approvals waiting for you." checked={ping.needs_ok} onChange={(v) => save({ needs_ok: v })} />
      <div>
        <button
          className={btn.secondary}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMsg("");
            try {
              const j = await post<{ log: DiscordLogEntry[] }>("/api/discord", { test: true });
              setLog(j.log);
              setMsg("Sent. Check Discord.");
            } catch (e) {
              setMsg((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Sending…" : "Send a test message"}
        </button>
        {msg && <p className="mt-2 text-[14px] font-medium" role="status">{msg}</p>}
      </div>
      <div>
        <p className="text-[15px] font-semibold">Last messages</p>
        {log.length === 0 ? (
          <p className="mt-1 text-[14px] text-muted">None yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5 text-[14px]">
            {log.slice(0, 8).map((e, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className={e.ok ? "text-[#1E6B34]" : "text-[#A11B12]"}>
                  {e.ok ? "✓" : "✕"}
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{e.text.replace(/https?:\/\/\S+/g, "").replace(/\s*(Pull request|Ready to look at):\s*$/i, "").replace(/^agentbox · /, "").trim()}</span>
                  <span className="text-muted">
                    {ago(e.at)}
                    {e.why ? ` · ${e.why}` : ""}
                    {!e.ok && !e.why ? " · not delivered" : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
