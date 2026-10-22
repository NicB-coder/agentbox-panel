"use client";
import Link from "next/link";
import { useState } from "react";
import type { WfStep, WorkflowRun } from "@/lib/types";
import { stepTitle, type AgentRef } from "@/lib/wf";
import type { StepRunInfo } from "@/lib/workflowViews";
import { clockOf, duration, plainText } from "@/lib/words";
import { btn } from "../ui";
import { Sheet } from "./StepPanel";
import { stepColor, stepIcon } from "./Canvas";

const WORD = { todo: "Not started", now: "Doing it now", done: "Done", passed: "Passed", needs_work: "Needs work", failed: "Stopped here", skipped: "Skipped", waiting: "Waiting for you" };

// In the live view: what this step did, with its log behind "Show the full log".
export default function RunStepPanel({ step, run, info, agents, onClose }: { step: WfStep; run: WorkflowRun; info: Record<number, StepRunInfo>; agents: AgentRef[]; onClose: () => void }) {
  const sr = run.stepRuns[step.id];
  const runs = (sr?.runIds ?? []).map((id) => info[id]).filter(Boolean);
  return (
    <Sheet title={stepTitle(step, agents)} icon={stepIcon(step, agents)} color={stepColor(step, agents)} onClose={onClose} ask="What did this step do?">
      <div>
        <p className="text-[14px] font-semibold text-muted">{WORD[sr?.state ?? "todo"]}</p>
        {sr?.note && <p className="mt-1 text-[16px] font-semibold leading-snug">{plainText(sr.note)}</p>}
        {sr?.startedAt && (
          <p className="mt-1 text-[14px] text-muted">
            Started {clockOf(sr.startedAt)}
            {sr.endedAt && sr.endedAt >= sr.startedAt ? ` · took ${duration(sr.endedAt - sr.startedAt)}` : ""}
            {sr.rounds ? ` · round ${sr.rounds + 1}` : ""}
          </p>
        )}
      </div>
      {runs.some((r) => r.needsOk) && (
        <p className="rounded-[14px] bg-[#FDF0DC] p-4 text-[15px] font-semibold text-[#8A4600]">
          It's waiting for your OK.{" "}
          <Link href="/inbox" className="underline">
            Answer in the Inbox
          </Link>
        </p>
      )}
      {runs.length === 0 && <p className="text-[15px] text-muted">{sr?.state === "todo" ? "This step hasn't started yet." : "agentbox did this step itself."}</p>}
      {runs
        .slice()
        .reverse()
        .map((r, i) => (
          <StepRun key={r.id} r={r} label={runs.length > 1 ? `Try ${runs.length - i}` : null} />
        ))}
      {run.prUrl && (
        <a href={run.prUrl} target="_blank" rel="noreferrer" className={btn.secondary}>
          See the pull request
        </a>
      )}
    </Sheet>
  );
}

function StepRun({ r, label }: { r: StepRunInfo; label: string | null }) {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState("");
  const raw = r.status === "stopped" ? r.stopReason : r.result ?? r.activity;
  const text = raw ? plainText(raw) : raw;
  return (
    <div className="rounded-[18px] border border-line p-4">
      {label && <p className="text-[13px] font-semibold text-muted">{label}</p>}
      {text && <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{text.length > 1500 ? `${text.slice(0, 1500)}…` : text}</p>}
      <button
        type="button"
        className={btn.link + " !text-[14px]"}
        aria-expanded={open}
        onClick={async () => {
          setOpen(!open);
          if (!open) {
            const res = await fetch(`/api/runs/${r.id}/log`, { cache: "no-store" });
            setLog(res.ok ? await res.text() : "Couldn't load the log.");
          }
        }}
      >
        {open ? "Hide the full log" : "Show the full log"}
      </button>
      {open && <pre className="mt-2 max-h-80 overflow-auto rounded-[14px] bg-soft p-3 text-[11.5px] leading-relaxed whitespace-pre-wrap">{log || "Loading…"}</pre>}
    </div>
  );
}
