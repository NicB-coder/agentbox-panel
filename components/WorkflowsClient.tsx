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
      <PageTitle title="Workflows" sub="Chains of steps that pass work along, from an idea to a finished pull request." />
      {data.tiles.length === 0 ? (
        <EmptyState
          icon="flow"
          title="No workflows yet"
          text="Start from a template, like Build → Review → Ship, or describe what should happen in your own words."
          action={
            <Link href="/workflows/new" className={btn.primary}>
              Start from a template
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
  return (
    <Link href={`/workflows/${t.id}`} className="tile relative flex flex-col overflow-hidden p-8 sm:p-9" aria-label={`${t.name}. ${t.sentence}`}>
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
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 py-4">
        <p className="clamp-3 text-[16px] font-semibold leading-snug">{t.sentence}</p>
        {t.note && <p className={`clamp-2 text-[14px] leading-snug ${t.status === "needs" ? "font-semibold text-[#8A4600]" : "text-muted"}`}>{t.note}</p>}
      </div>
      <div className="flex items-center justify-between gap-3">
        <StatusPill status={t.status} />
        <span className="truncate text-[13px] text-muted">{t.timeLabel}</span>
      </div>
    </Link>
  );
}
