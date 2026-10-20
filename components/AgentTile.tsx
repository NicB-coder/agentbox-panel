import Link from "next/link";
import type { AgentView } from "@/lib/types";
import { AgentIcon, StatusPill } from "./ui";

export function AgentTile({ v }: { v: AgentView }) {
  const a = v.agent;
  return (
    <Link href={`/agents/${a.id}`} className="tile relative flex flex-col overflow-hidden p-8 sm:p-9" aria-label={`${a.name}: ${statusWord(v)}. ${v.task}`}>
      <span className="absolute inset-x-0 top-0 h-[6px]" style={{ background: a.color, opacity: 0.55 }} aria-hidden="true" />
      <div className="flex items-center gap-3">
        <AgentIcon name={a.icon} color={a.color} />
        <div className="min-w-0">
          <div className="truncate text-[17px] font-semibold leading-tight">{a.name}</div>
          <div className="truncate text-[13px] text-muted">{a.project}</div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 py-4">
        <div className="clamp-2 text-[16px] font-semibold leading-snug">{v.task}</div>
        {v.waitingForOk ? (
          <div className="clamp-3 text-[14px] font-semibold leading-snug text-[#8A4600]">{v.summary}</div>
        ) : (
          <div className="clamp-3 text-[14px] leading-snug text-muted">{v.summary}</div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <StatusPill status={v.status} />
        <span className="truncate text-[13px] text-muted">{v.timeLabel}</span>
      </div>
    </Link>
  );
}

function statusWord(v: AgentView) {
  return { working: "Working", needs: "Needs you", done: "Done", stopped: "Stopped", scheduled: "Scheduled", paused: "Paused", off: "Off", ready: "Ready" }[v.status];
}

export function AddAgentTile() {
  return (
    <Link
      href="/agents/new"
      className="tile flex flex-col items-center justify-center gap-3 !border-2 !border-dashed !border-dash !shadow-none text-muted hover:text-ink"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-soft text-[28px] leading-none" aria-hidden="true">
        +
      </span>
      <span className="text-[17px] font-semibold">Add an agent</span>
    </Link>
  );
}
