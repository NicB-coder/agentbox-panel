"use client";
import Link from "next/link";
import { useState } from "react";
import type { ConnectorStatus } from "@/lib/connectorStatus";
import { InfoTip, PageTitle } from "./bits";
import { StatusPill, btn } from "./ui";

// Connectors: the apps agents can use (email, calendar, files, chat…), whether each one is connected,
// and in plain words what it lets an agent do. Per task, Nic ticks which ones it may use.
export default function ConnectorsClient({ initial }: { initial: ConnectorStatus[] }) {
  const [list, setList] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  async function check() {
    setBusy(true);
    try {
      const r = await fetch("/api/connectors?fresh=1", { cache: "no-store" });
      if (r.ok) setList(await r.json());
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <PageTitle
        title="Connectors"
        sub={
          <span className="inline-flex items-center">
            Apps your agents can use. You pick which ones for each task.
            <InfoTip text="When you start a task, tick the connectors it may use under More options. Anything that sends, deletes or books something always asks you first, and Look only tasks can never do those things." label="Connectors" />
          </span>
        }
      >
        <button className={btn.secondary} onClick={check} disabled={busy}>
          {busy ? "Checking…" : "Check again"}
        </button>
      </PageTitle>
      <ul className="grid gap-6 md:grid-cols-2">
        {list.map((c) => (
          <li key={c.id} className="panel flex flex-col gap-3 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[18px] font-semibold">{c.name}</h2>
              <StatusPill status={c.state === "connected" ? "done" : c.state === "signin" ? "needs" : "off"} label={c.state === "connected" ? "Connected" : c.state === "signin" ? "Needs signing in" : "Not connected"} />
            </div>
            <p className="text-[15px] leading-relaxed">{c.what}</p>
            <p className="text-[14px] text-muted">
              <span className="font-semibold text-ink">Always asks you first: </span>
              {c.asks}.
            </p>
            {c.state !== "connected" && (
              <div>
                {c.state === "signin" ? (
                  <Link href={`/terminal?cmd=${encodeURIComponent(c.builtin ? "gh auth login --hostname github.com --git-protocol https --web" : `claude mcp login --no-browser "claude.ai ${c.name}"`)}`} className={btn.primary}>
                    Sign in again
                  </Link>
                ) : (
                  <button className={btn.primary} aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>
                    Connect
                  </button>
                )}
                {open === c.id && (
                  <ol className="mt-4 flex list-decimal flex-col gap-2 rounded-[14px] bg-soft p-4 pl-9 text-[15px] leading-relaxed">
                    <li>
                      Open{" "}
                      <a href="https://claude.ai/settings/connectors" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-semibold underline">
                        claude.ai → Settings → Connectors
                      </a>{" "}
                      on any device.
                    </li>
                    <li>Make sure you're signed in with the same Claude account agentbox uses (the one on the Machine page).</li>
                    <li>Find {c.name}, press Connect, and allow it.</li>
                    <li>Come back here and press Check again. It shows up as Connected, and agentbox can use it straight away.</li>
                  </ol>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
