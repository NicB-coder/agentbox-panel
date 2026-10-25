"use client";
import Link from "next/link";
import type { WorkflowsListState, WorkflowTile } from "@/lib/workflowViews";
import { EmptyState, PageTitle } from "./bits";
import { Icon, StatusPill, btn } from "./ui";
import { usePoll } from "./usePoll";

export default function WorkflowsClient({ initial }: { initial: WorkflowsListState }) {
  const { data } = usePoll<WorkflowsListState>("/api/workflows/state", initial);
  return (
    <div>
      <PageTitle title="Workflows" sub="A workflow is a bigger job done in steps, one after another: for example build it, have it checked, then ask you." />
      {data.tiles.length === 0 ? (
        <EmptyState
          icon="flow"
          title="No workflows yet"
          text="Say what you want to make, and agentbox sets up the steps for you."
          action={
            <Link href="/workflows/new" className={btn.primary}>
              New workflow
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-10" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {data.tiles.map((t) => (
            <li key={t.id}>
              <Tile t={t} />
            </li>
          ))}
          <li>
            <Link href="/workflows/new" className="tile flex flex-col items-center justify-center gap-3 !border-2 !border-dashed !border-dash !shadow-none text-muted hover:text-ink">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-soft text-[28px] leading-none" aria-hidden="true">
                +
              </span>
              <span className="text-[17px] font-semibold">New workflow</span>
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}

function Tile({ t }: { t: WorkflowTile }) {
  const live = t.status === "running" || t.status === "needs";
  return (
    <Link
      href={`/workflows/${t.id}`}
      className="tile relative flex flex-col overflow-hidden p-8 sm:p-9"
      style={live ? { background: "color-mix(in srgb, #7048C8 7%, white)" } : undefined}
      aria-label={`${t.name}. ${t.current ? `On step ${t.current.index + 1} of ${t.current.of}: ${t.current.title}. ` : ""}${t.sentence}`}
    >
      <span className="absolute inset-x-0 top-0 h-[6px]" style={{ background: "#7048C8", opacity: 0.55 }} aria-hidden="true" />
      <div className="flex items-center gap-3">
        <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          <span className="absolute inset-0 rounded-full" style={{ background: "#7048C8", opacity: 0.1 }} />
          <span className="relative">
            <Icon name="flow" color="#7048C8" size={20} />
          </span>
        </span>
        <div className="min-w-0 truncate text-[17px] font-semibold leading-tight">{t.name}</div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 py-4">
        <span className="flex flex-wrap items-center gap-x-1 gap-y-1.5" aria-hidden="true">
          {t.chips.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-[11px] text-[#9AA0A8]">→</span>}
              <span
                title={c.title}
                className={`flex h-7 items-center gap-1 rounded-[9px] px-1.5 text-[12px] font-semibold ${t.current?.index === i ? "glow" : ""}`}
                style={{ background: `${c.color}1A`, color: "#15171B", outline: t.current?.index === i ? `2px solid ${c.color}` : undefined, ["--glow" as string]: c.color }}
              >
                <Icon name={c.icon} color={c.color} size={14} />
                <span className="max-w-[90px] truncate">{c.title}</span>
              </span>
            </span>
          ))}
        </span>
        {t.current ? (
          <>
            <p className="text-[15px] font-semibold leading-snug">
              Step {t.current.index + 1} of {t.current.of}: {t.current.title}
            </p>
            {t.note && (
              <p className={`flex items-start gap-2 text-[14px] leading-snug ${t.status === "needs" ? "font-semibold text-[#8A4600]" : "text-ink"}`}>
                {t.status === "running" && <span className="pulse mt-[5px] h-2 w-2 shrink-0 rounded-full bg-[#7048C8]" aria-hidden="true" />}
                <span className="clamp-2">{t.note}</span>
              </p>
            )}
          </>
        ) : (
          <>
            <p className="clamp-3 text-[15px] font-semibold leading-snug">{t.sentence}</p>
            {t.note && <p className={`clamp-2 text-[14px] leading-snug ${t.status === "needs" ? "font-semibold text-[#8A4600]" : "text-muted"}`}>{t.note}</p>}
          </>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <StatusPill status={t.status} />
        <span className="truncate text-[13px] text-muted">{t.timeLabel}</span>
      </div>
    </Link>
  );
}
