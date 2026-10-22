"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { HomeState } from "@/lib/views";
import { AgentTile, StartTaskTile } from "./AgentTile";
import { EmptyState } from "./bits";
import { openTaskPanel } from "./TaskPanel";
import { usePoll } from "./usePoll";
import { btn } from "./ui";

export default function HomeClient({ initial }: { initial: HomeState }) {
  const { data } = usePoll<HomeState>("/api/state", initial);
  const [show, setShow] = useState<"active" | "archived">("active");
  useEffect(() => {
    // /agents/new and links like /?new=1 open the Start a task panel.
    const q = new URLSearchParams(location.search);
    if (q.get("new") === "1") {
      history.replaceState(null, "", "/");
      openTaskPanel({ task: q.get("task") ?? undefined });
    }
  }, []);
  const list = show === "active" ? data.views : data.archived;
  return (
    <>
      <section className="pb-8 pt-10 sm:pt-14">
        <h1 className="text-[30px] font-bold leading-tight tracking-tight sm:text-[36px]">{data.greeting}</h1>
        <p className="mt-2 text-[17px] text-muted" aria-live="polite">
          {data.needs > 0 ? (
            <>
              {data.summary.split(" · ")[0]} ·{" "}
              <Link href="/inbox" className="inline-flex min-h-11 items-center font-semibold text-[#8A4600] underline underline-offset-2">
                {data.summary.split(" · ")[1]}
              </Link>
            </>
          ) : (
            data.summary
          )}
        </p>
        {data.usageNote && <p className="mt-3 inline-block rounded-[14px] bg-[#FDE8E6] px-4 py-2 text-[15px] font-medium text-[#A11B12]">{data.usageNote}</p>}
      </section>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Which agents">
        {(["active", "archived"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={show === k}
            onClick={() => setShow(k)}
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-semibold ${show === k ? "bg-ink text-white" : "bg-soft text-muted hover:text-ink"}`}
          >
            {k === "active" ? "Agents" : `Archived${data.archived.length ? ` (${data.archived.length})` : ""}`}
          </button>
        ))}
      </div>
      <section aria-label={show === "active" ? "Your agents" : "Archived agents"}>
        {show === "archived" && list.length === 0 ? (
          <EmptyState icon="folder" title="Nothing archived" text="When a job is finished, press Archive on its page to tidy it away. It shows up here with all its history." />
        ) : (
          <ul className="grid gap-10" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {list.map((v) => (
              <li key={v.agent.id}>
                <AgentTile v={v} />
              </li>
            ))}
            {show === "active" && (
              <li>
                <StartTaskTile />
              </li>
            )}
          </ul>
        )}
        {show === "active" && data.views.filter((v) => v.agent.kind === "claude").length === 0 && (
          <p className="mt-8 text-[15px] text-muted">
            Every task gets its own agent, named after the job.{" "}
            <button type="button" className={btn.link} onClick={() => openTaskPanel()}>
              Start your first task
            </button>
          </p>
        )}
      </section>
    </>
  );
}
