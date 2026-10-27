"use client";
import { useCallback, useEffect, useState } from "react";
import type { UpdateStatus } from "@/lib/update";
import { Confirm, InfoTip, post } from "./bits";
import { btn } from "./ui";

// Update agentbox: one button, a clear progress view, and a plain success or failure message.
export default function UpdateBox() {
  const [s, setS] = useState<UpdateStatus | null>(null);
  const [away, setAway] = useState(false); // the panel is restarting
  const [err, setErr] = useState("");
  const [log, setLog] = useState<string | null>(null);
  const [ask, setAsk] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/update", { cache: "no-store" });
      const j = await r.json();
      setS(j.status);
      setAway(false);
    } catch {
      setAway(true);
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, s?.state === "running" || away ? 1500 : 15000);
    return () => clearInterval(t);
  }, [load, s?.state, away]);

  const running = s?.state === "running";
  async function start(force = false) {
    setErr("");
    try {
      await post("/api/update", { force });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  const tone =
    s?.state === "done" || s?.state === "uptodate" ? "bg-[#E6F4EA] text-[#1E6B34]" : s?.state === "failed" ? "bg-[#FDE8E6] text-[#A11B12]" : s?.state === "rolledback" ? "bg-[#FDF0DC] text-[#8A4600]" : "bg-soft";
  return (
    <section id="update" className="panel scroll-mt-24 p-6 sm:p-8" aria-labelledby="upd-h">
      <h2 id="upd-h" className="flex items-center text-[18px] font-semibold">
        Update agentbox
        <InfoTip text="Gets the newest version from GitHub, builds it next to the running one, tries it on the side, then switches over. If anything goes wrong, the old version keeps running (or comes back by itself)." label="Update agentbox" />
      </h2>
      <p className="mt-1 text-[15px] text-muted">Gets the newest version of this panel and restarts it. Takes a few minutes. Running agents keep going.</p>
      {s && s.steps.length > 0 && (running || Date.now() - (s.endedAt ?? 0) < 6 * 3600_000) && (
        <ol className="mt-4 flex flex-col gap-1.5" aria-label="Update progress">
          {s.steps.map((label, i) => {
            const state = running ? (i < s.step ? "done" : i === s.step ? "now" : "todo") : s.state === "done" ? "done" : i < s.step ? "done" : i === s.step ? "stop" : "todo";
            return (
              <li key={i} className={`text-[15px] ${state === "now" ? "font-semibold text-[#2A3F9E]" : state === "todo" ? "text-muted" : ""}`}>
                <span aria-hidden="true">{state === "done" ? "✓" : state === "now" ? "●" : state === "stop" ? "✕" : "○"}</span> {label}
              </li>
            );
          })}
        </ol>
      )}
      {away && running && <p className="mt-4 rounded-[14px] bg-soft px-4 py-3 text-[15px] font-medium">The panel is restarting. This page reconnects by itself…</p>}
      {s && (!running || s.message) && (
        <p className={`mt-4 rounded-[14px] px-4 py-3 text-[15px] font-medium ${running ? "bg-soft" : tone}`} role="status">
          {s.message}
        </p>
      )}
      {err && (
        <p role="alert" className="mt-3 text-[14px] font-medium text-[#A11B12]">
          {err}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button className={btn.primary} disabled={running} onClick={() => setAsk(true)}>
          {running ? "Updating…" : "Update agentbox"}
        </button>
        <Confirm
          open={ask}
          title="Update agentbox now?"
          text="It gets the newest version and restarts the panel, which takes a few minutes. This page reconnects by itself, and if the new version doesn't start, the old one comes back on its own."
          yes="Update it"
          no="Not now"
          onYes={() => {
            setAsk(false);
            start();
          }}
          onClose={() => setAsk(false)}
        />
        {s && !running && s.state !== "uptodate" && (
          <button
            className={btn.link}
            onClick={async () => setLog(log === null ? ((await fetch("/api/update?log=1").then((r) => r.json()).catch(() => ({}))).log ?? "") : null)}
            aria-expanded={log !== null}
          >
            {log === null ? "Show the full log" : "Hide the full log"}
          </button>
        )}
      </div>
      {log !== null && <pre className="mt-4 max-h-80 overflow-auto rounded-[14px] bg-soft p-4 text-[12px] whitespace-pre-wrap">{log || "(empty)"}</pre>}
    </section>
  );
}
