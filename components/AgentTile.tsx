"use client";
import Link from "next/link";
import type { AgentView } from "@/lib/types";
import { openTaskPanel } from "./TaskPanel";
import { AgentIcon, PILL_LABEL, StatusPill } from "./ui";

// "Make an arcade website with 4 small games. It should…" → "Make an arcade website with 4 small games"
function fewWords(task: string, max = 70) {
  const first = task.split(/(?<=[.!?])\s|\n/)[0].trim();
  return first.length > max ? `${first.slice(0, max).replace(/\s+\S*$/, "")}…` : first;
}

export function AgentTile({ v }: { v: AgentView }) {
  const a = v.agent;
  const live = v.status === "working" || v.status === "needs" || v.status === "queued";
  const busy = v.status === "working" && !!v.activeRun;
  return (
    <Link
      href={`/agents/${a.id}`}
      className="tile relative flex flex-col overflow-hidden p-8 sm:p-9"
      style={live ? { background: `color-mix(in srgb, ${a.color} 7%, white)` } : undefined}
      aria-label={`${a.name}: ${v.pillLabel ?? statusWord(v)}. ${v.task}${v.progress ? `. Step ${v.progress.step} of ${v.progress.of}` : ""}`}
    >
      <span className="absolute inset-x-0 top-0 h-[6px]" style={{ background: a.color, opacity: 0.55 }} aria-hidden="true" />
      <div className="flex items-center gap-3">
        <AgentIcon name={a.icon} color={a.color} />
        <div className="min-w-0">
          <div className="truncate text-[17px] font-semibold leading-tight">{a.name}</div>
          <div className="truncate text-[13px] text-muted">{a.project || (a.job.kind === "research" ? "Research" : "")}</div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 py-4">
        <div className="clamp-2 text-[16px] font-semibold leading-snug">{busy ? fewWords(v.task) : v.task}</div>
        {busy ? (
          <>
            <div className="flex items-start gap-2 text-[14px] leading-snug">
              <span className="pulse mt-[5px] h-2 w-2 shrink-0 rounded-full" style={{ background: a.color }} aria-hidden="true" />
              <span className="clamp-2 text-ink">
                <span className="sr-only">Right now: </span>
                {v.summary}
              </span>
            </div>
            {v.progress && (
              <div className="mt-1 flex items-center gap-2 text-[13px] text-muted">
                <span className="shrink-0 font-semibold text-ink">
                  Step {v.progress.step} of {v.progress.of}
                </span>
                <span className="relative h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-[#E6E8EC]" aria-hidden="true">
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.round(((v.progress.step - 0.5) / v.progress.of) * 100)}%`, background: a.color }} />
                </span>
                <span className="truncate">{v.progress.label}</span>
              </div>
            )}
          </>
        ) : v.waitingForOk ? (
          <div className="clamp-3 text-[14px] font-semibold leading-snug text-[#8A4600]">{v.summary}</div>
        ) : (
          <div className="clamp-3 text-[14px] leading-snug text-muted">{v.summary}</div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <StatusPill status={v.status} label={v.pillLabel} />
        <span className="truncate text-[13px] text-muted">{v.timeLabel}</span>
      </div>
    </Link>
  );
}

function statusWord(v: AgentView) {
  return PILL_LABEL[v.status];
}

export function StartTaskTile() {
  return (
    <button
      type="button"
      onClick={() => openTaskPanel()}
      className="tile flex w-full flex-col items-center justify-center gap-3 !border-2 !border-dashed !border-dash !shadow-none text-muted hover:text-ink"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-soft text-[28px] leading-none" aria-hidden="true">
        +
      </span>
      <span className="text-[17px] font-semibold">Start a task</span>
      <span className="max-w-[200px] text-center text-[14px] leading-snug">Each task gets its own agent</span>
    </button>
  );
}
