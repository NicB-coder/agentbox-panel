"use client";
import Link from "next/link";
import { useState } from "react";
import type { AgentPageState } from "@/lib/views";
import type { Approval, PillStatus, Run, WorkMode } from "@/lib/types";
import { ago, clockOf, duration, MODE_WORDS, agentSentence, plainText } from "@/lib/words";
import { AgentIcon, StatusPill, btn } from "./ui";
import { usePoll } from "./usePoll";
import ModePicker from "./ModePicker";
import { ErrorBox } from "./bits";

async function post(url: string, body: unknown = {}) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Something went wrong.");
  return j;
}

export default function AgentPageClient({ initial, id }: { initial: AgentPageState; id: number }) {
  const { data, refresh } = usePoll<AgentPageState>(`/api/agents/${id}/state`, initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const { view, schedule, runs, heartbeat } = data;
  const a = view.agent;
  const isHeartbeat = a.kind === "heartbeat";
  const working = !!view.activeRun;

  async function act(label: string, url: string, body?: unknown) {
    setBusy(label);
    setError("");
    try {
      await post(url, body);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="pt-8 sm:pt-10">
      <Link href="/" className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-muted hover:text-ink">
        <span aria-hidden="true">←</span> All agents
      </Link>

      {/* Top */}
      <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <AgentIcon name={a.icon} color={a.color} size={56} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[28px] font-bold leading-tight tracking-tight">{a.name}</h1>
              <StatusPill status={view.status} />
            </div>
            <p className="text-[15px] text-muted">{a.project}</p>
          </div>
        </div>
        {!isHeartbeat && (
          <div className="flex flex-wrap gap-3">
            <button className={btn.primary} disabled={working || !a.enabled || !!busy} onClick={() => act("run", `/api/agents/${id}/run`, {})}>
              {busy === "run" ? "Starting…" : "Run now"}
            </button>
            <button className={btn.secondary} disabled={!!busy} onClick={() => act("pause", `/api/agents/${id}/pause`, { paused: !a.paused })}>
              {a.paused ? "Resume" : "Pause"}
            </button>
            {working && (
              <button className={btn.danger} disabled={!!busy} onClick={() => act("stop", `/api/agents/${id}/stop`)}>
                {busy === "stop" ? "Stopping…" : "Stop"}
              </button>
            )}
            <Link href={`/agents/${id}/edit`} className={btn.secondary}>
              Edit
            </Link>
          </div>
        )}
      </div>
      {error && (
        <div className="mt-4">
          <ErrorBox message={error} onRetry={() => setError("")} where={`${a.name}'s page`} />
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          {isHeartbeat ? <HeartbeatNow data={data} /> : <RightNow data={data} act={act} busy={busy} />}
          {!isHeartbeat && <GiveTask id={id} defaultMode={a.mode} disabled={working || !a.enabled} onStarted={refresh} />}
          {isHeartbeat ? <HeartbeatHistory data={data} /> : <History runs={runs} />}
        </div>
        <aside className="flex flex-col gap-6">
          <section className="panel p-6" aria-labelledby="schedule-h">
            <h2 id="schedule-h" className="text-[18px] font-semibold">
              Schedule
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed">{schedule}</p>
          </section>
          <section className="panel p-6" aria-labelledby="about-h">
            <h2 id="about-h" className="text-[18px] font-semibold">
              What it does
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-muted">{a.prompt}</p>
            {!isHeartbeat && <p className="mt-4 text-[15px] leading-relaxed">{agentSentence(a)}</p>}
            {isHeartbeat && <p className="mt-4 text-[14px] text-muted">This is the existing hourly job on this Mac. It's shown here to watch, not to change.</p>}
          </section>
        </aside>
      </div>

      <FullLog id={id} runs={runs} heartbeatLog={heartbeat ? [heartbeat.outLogTail, heartbeat.errLogTail] : null} />
    </div>
  );
}

function Steps({ run }: { run: Run }) {
  if (!run.steps.length) return null;
  return (
    <ol className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-[15px]" aria-label="Progress">
      {run.steps.map((s, i) => (
        <li key={i} className="flex items-center gap-2">
          {i > 0 && (
            <span className="text-[#9AA0A8]" aria-hidden="true">
              →
            </span>
          )}
          <span className={s.state === "now" ? "font-semibold text-[#2A3F9E]" : s.state === "done" ? "text-ink" : "text-muted"}>
            <span aria-hidden="true">{s.state === "done" ? "✓" : s.state === "now" ? "●" : "○"}</span> {s.label}
            <span className="sr-only">{s.state === "done" ? " (done)" : s.state === "now" ? " (doing now)" : " (not started)"}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function RightNow({ data, act, busy }: { data: AgentPageState; act: (l: string, u: string, b?: unknown) => Promise<void>; busy: string }) {
  const { view, runs } = data;
  const run = view.activeRun;
  const pending = view.pendingApproval;
  const review = runs.find((r) => r.status === "review");
  return (
    <section className="panel p-6 sm:p-8" aria-labelledby="now-h" aria-live="polite">
      <h2 id="now-h" className="text-[18px] font-semibold">
        Right now
      </h2>
      {run ? (
        <>
          <p className="mt-3 text-[20px] font-semibold leading-snug">{run.task}</p>
          <p className="mt-1 text-[15px] text-muted">
            {run.status === "waiting" ? "Waiting for you" : run.activity ?? "Working on it"} · started {ago(run.startedAt)} · {MODE_WORDS[run.mode].label}
          </p>
          <Steps run={run} />
          {pending && pending.kind === "tool" && <AskBox approval={pending} act={act} busy={busy} />}
          {run.plan && run.status === "waiting" && !pending && <PlanBox run={run} act={act} busy={busy} />}
        </>
      ) : review ? (
        <>
          <p className="mt-3 text-[20px] font-semibold leading-snug">{review.task}</p>
          <p className="mt-1 text-[15px] text-muted">{review.result ?? "It finished and opened a pull request for you."}</p>
          {review.prUrl && (
            <a href={review.prUrl} target="_blank" rel="noreferrer" className={`${btn.primary} mt-5`}>
              Look at the pull request
            </a>
          )}
          <p className="mt-3 text-[14px] text-muted">When you merge it on GitHub, this turns to Done by itself.</p>
        </>
      ) : (
        <>
          <p className="mt-3 text-[20px] font-semibold leading-snug">{view.task}</p>
          {!(view.status === "stopped" && runs[0]?.status === "stopped") && <p className="mt-1 text-[15px] text-muted">{view.summary}</p>}
          {view.status === "stopped" && runs[0]?.status === "stopped" && (
            <div className="mt-5">
              <ErrorBox
                compact
                message={runs[0].stopReason ?? "It stopped before finishing."}
                onRetry={() => act("retry", `/api/runs/${runs[0].id}/retry`)}
                where={`${view.agent.name}: "${runs[0].task}"`}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}

function AskBox({ approval, act, busy }: { approval: Approval; act: (l: string, u: string, b?: unknown) => Promise<void>; busy: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="mt-6 rounded-[18px] bg-[#FDF0DC] p-5">
      <p className="text-[14px] font-semibold text-[#8A4600]">It wants to:</p>
      <p className="mt-1 text-[17px] font-semibold">{approval.summary}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className={btn.primary} disabled={!!busy} onClick={() => act("allow", `/api/approvals/${approval.id}`, { allow: true })}>
          Allow
        </button>
        <button className={btn.secondary} disabled={!!busy} onClick={() => act("deny", `/api/approvals/${approval.id}`, { allow: false })}>
          Deny
        </button>
        {approval.detail && (
          <button className="min-h-11 px-2 text-[14px] font-medium text-[#8A4600] underline" onClick={() => setShow(!show)} aria-expanded={show}>
            {show ? "Hide the details" : "Show the details"}
          </button>
        )}
      </div>
      {show && approval.detail && <pre className="mt-4 max-h-72 overflow-auto rounded-[14px] bg-white p-4 text-[12px] leading-relaxed whitespace-pre-wrap">{approval.detail}</pre>}
    </div>
  );
}

function PlanBox({ run, act, busy }: { run: Run; act: (l: string, u: string, b?: unknown) => Promise<void>; busy: string }) {
  const [changing, setChanging] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="mt-6 rounded-[18px] bg-[#FDF0DC] p-5">
      <p className="text-[14px] font-semibold text-[#8A4600]">Here's its plan. Is this OK?</p>
      <div className="mt-3 max-h-[28rem] overflow-auto rounded-[14px] bg-white p-4 text-[15px] leading-relaxed whitespace-pre-wrap">{run.plan}</div>
      {!changing ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <button className={btn.primary} disabled={!!busy} onClick={() => act("approve", `/api/runs/${run.id}/plan`, { approve: true })}>
            Approve plan
          </button>
          <button className={btn.secondary} disabled={!!busy} onClick={() => setChanging(true)}>
            Change it
          </button>
        </div>
      ) : (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (msg.trim()) act("change", `/api/runs/${run.id}/plan`, { approve: false, message: msg }).then(() => setChanging(false));
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="text-[15px] font-semibold">What should it change?</span>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} className="rounded-[14px] border border-[#C9CDD4] bg-white p-3 text-[15px]" />
          </label>
          <div className="flex gap-3">
            <button type="submit" className={btn.primary} disabled={!!busy || !msg.trim()}>
              Send
            </button>
            <button type="button" className={btn.secondary} onClick={() => setChanging(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function GiveTask({ id, defaultMode, disabled, onStarted }: { id: number; defaultMode: WorkMode; disabled: boolean; onStarted: () => void }) {
  const [task, setTask] = useState("");
  const [mode, setMode] = useState<WorkMode>(defaultMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="panel p-6 sm:p-8" aria-labelledby="give-h">
      <h2 id="give-h" className="text-[18px] font-semibold">
        Give it a task
      </h2>
      <form
        className="mt-4 flex flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!task.trim()) return setError("Write what you want it to do first.");
          setBusy(true);
          setError("");
          try {
            await post(`/api/agents/${id}/run`, { task, mode });
            setTask("");
            onStarted();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="sr-only">The task</span>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            rows={3}
            placeholder="For example: Make the header look right on phones."
            className="rounded-[14px] border border-[#C9CDD4] p-3 text-[15px] leading-relaxed"
          />
        </label>
        <ModePicker value={mode} onChange={setMode} legend="How should it work with you this time?" />
        {error && <ErrorBox compact message={error} where="Give it a task" />}
        <div>
          <button type="submit" className={btn.primary} disabled={busy || disabled}>
            {busy ? "Starting…" : "Start"}
          </button>
          {disabled && <span className="ml-3 text-[14px] text-muted">It's busy right now. You can start a new task when it's done.</span>}
        </div>
      </form>
    </section>
  );
}

const RESULT: Record<Run["status"], { status: PillStatus; label: string }> = {
  queued: { status: "queued", label: "Waiting" },
  working: { status: "working", label: "Working" },
  waiting: { status: "needs", label: "Needs you" },
  review: { status: "needs", label: "Needs you" },
  done: { status: "done", label: "Done" },
  stopped: { status: "stopped", label: "Stopped" },
};

function History({ runs }: { runs: Run[] }) {
  return (
    <section className="panel p-6 sm:p-8" aria-labelledby="hist-h">
      <h2 id="hist-h" className="text-[18px] font-semibold">
        History
      </h2>
      {runs.length === 0 ? (
        <p className="mt-3 text-[15px] text-muted">No runs yet. Give it a task or press Run now.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {runs.map((r) => {
            const res = RESULT[r.status];
            return (
              <li key={r.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-snug">{r.task}</p>
                  <p className="mt-0.5 text-[14px] text-muted">
                    {new Date(r.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}, {clockOf(r.startedAt)}
                    {r.endedAt ? ` · took ${duration(r.endedAt - r.startedAt)}` : ""}
                    {r.status === "stopped" && r.stopReason ? ` · ${r.stopReason}` : ""}
                  </p>
                  {r.result && r.status !== "stopped" && <Report text={r.result} />}
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={res.status} label={res.label} />
                  {r.prUrl && (
                    <a href={r.prUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-[14px] font-semibold text-[#2A3F9E] underline">
                      Pull request
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Report({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [first, ...rest] = plainText(text).split(/\n\s*\n/);
  return (
    <div className="mt-1 text-[14px] leading-snug text-muted">
      <p className="whitespace-pre-wrap">{first}</p>
      {rest.length > 0 && (
        <>
          {open && <div className="mt-2 whitespace-pre-wrap rounded-[14px] bg-soft p-4 text-ink">{rest.join("\n\n")}</div>}
          <button className="min-h-11 text-[14px] font-semibold text-ink underline" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "Hide the report" : "Read the full report"}
          </button>
        </>
      )}
    </div>
  );
}

function HeartbeatNow({ data }: { data: AgentPageState }) {
  const hb = data.heartbeat!;
  const last = hb.recent[0];
  return (
    <section className="panel p-6 sm:p-8" aria-labelledby="now-h">
      <h2 id="now-h" className="text-[18px] font-semibold">
        Right now
      </h2>
      <p className="mt-3 text-[20px] font-semibold leading-snug">
        {hb.onTimeToday} of {hb.expectedToday} check-ins on time today
      </p>
      <p className="mt-1 text-[15px] text-muted">
        {hb.running ? "Checking in right now." : last ? `Last check-in ${ago(last.at)} at ${clockOf(last.at)}.` : "No check-ins yet."}
        {last?.reply ? ` It said: “${last.reply}”` : ""}
      </p>
      {!hb.loaded && <p className="mt-3 text-[15px] font-medium text-[#A11B12]">The hourly job isn't loaded on this Mac.</p>}
    </section>
  );
}

function HeartbeatHistory({ data }: { data: AgentPageState }) {
  const hb = data.heartbeat!;
  return (
    <section className="panel p-6 sm:p-8" aria-labelledby="hist-h">
      <h2 id="hist-h" className="text-[18px] font-semibold">
        History
      </h2>
      <ul className="mt-2 divide-y divide-line">
        {hb.recent.map((r) => (
          <li key={r.at} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">
                {new Date(r.at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}, {clockOf(r.at)}
              </p>
              {r.reply && <p className="text-[14px] text-muted">{r.reply}</p>}
            </div>
            <div>
              <StatusPill status={r.onTime ? "done" : "needs"} label={r.onTime ? "On time" : "Late"} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FullLog({ id, runs, heartbeatLog }: { id: number; runs: Run[]; heartbeatLog: [string, string] | null }) {
  const [open, setOpen] = useState(false);
  const [runId, setRunId] = useState<number | null>(runs[0]?.id ?? null);
  const [text, setText] = useState("");
  async function load(rid: number | null) {
    if (rid === null) return;
    const r = await fetch(`/api/runs/${rid}/log`, { cache: "no-store" });
    setText(r.ok ? await r.text() : "Couldn't load the log.");
  }
  return (
    <section className="mt-6">
      <button
        className={btn.secondary}
        aria-expanded={open}
        aria-controls={`log-${id}`}
        onClick={() => {
          setOpen(!open);
          if (!open && !heartbeatLog) load(runId);
        }}
      >
        {open ? "Hide the full log" : "Show the full log"}
      </button>
      {open && (
        <div id={`log-${id}`} className="panel mt-4 p-4 sm:p-6">
          {heartbeatLog ? (
            <>
              <p className="text-[14px] font-semibold">Output log</p>
              <pre className="mt-2 max-h-80 overflow-auto rounded-[14px] bg-soft p-4 text-[12px] whitespace-pre-wrap">{heartbeatLog[0] || "(empty)"}</pre>
              <p className="mt-4 text-[14px] font-semibold">Error log</p>
              <pre className="mt-2 max-h-80 overflow-auto rounded-[14px] bg-soft p-4 text-[12px] whitespace-pre-wrap">{heartbeatLog[1] || "(empty)"}</pre>
            </>
          ) : runs.length === 0 ? (
            <p className="text-[15px] text-muted">There's no log yet.</p>
          ) : (
            <>
              <label className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="text-[14px] font-semibold">Which run?</span>
                <select
                  className="min-h-11 rounded-[14px] border border-[#C9CDD4] bg-white px-3 text-[14px]"
                  value={runId ?? ""}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setRunId(v);
                    load(v);
                  }}
                >
                  {runs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {clockOf(r.startedAt)} · {r.task.slice(0, 60)}
                    </option>
                  ))}
                </select>
                <button className="min-h-11 px-2 text-[14px] font-medium underline" onClick={() => load(runId)}>
                  Refresh
                </button>
              </label>
              <pre className="mt-4 max-h-[32rem] overflow-auto rounded-[14px] bg-soft p-4 text-[12px] leading-relaxed whitespace-pre-wrap">{text || "Loading…"}</pre>
            </>
          )}
        </div>
      )}
    </section>
  );
}
