"use client";
import Link from "next/link";
import { useState } from "react";
import type { AgentPageState } from "@/lib/views";
import type { Agent, Approval, PillStatus, Run, Step } from "@/lib/types";
import { ago, clockOf, duration, agentSentence, plainText, planText, userStop } from "@/lib/words";
import { FREEDOM_WORDS, freedomOf } from "@/lib/job";
import { AgentIcon, StatusPill, btn } from "./ui";
import { usePoll } from "./usePoll";
import { Confirm, ErrorBox, post as call } from "./bits";
import { TextViewer } from "./BriefPicker";
import { openTaskPanel } from "./TaskPanel";

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
  const [archiveAsk, setArchiveAsk] = useState(false);
  const [stopping, setStopping] = useState(false);
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
              <StatusPill status={view.status} label={view.pillLabel} />
            </div>
            <p className="text-[15px] text-muted">{a.project}</p>
          </div>
        </div>
        {!isHeartbeat && (
          <div className="flex flex-wrap gap-3">
            {a.scheduleKind !== "manual" ? (
              <>
                <button className={btn.primary} disabled={working || !a.enabled || !!busy} onClick={() => act("run", `/api/agents/${id}/run`, {})}>
                  {busy === "run" ? "Starting…" : "Run now"}
                </button>
                <button className={btn.secondary} disabled={!!busy} onClick={() => act("pause", `/api/agents/${id}/pause`, { paused: !a.paused })}>
                  {a.paused ? "Resume" : "Pause"}
                </button>
              </>
            ) : (
              <button className={btn.primary} disabled={working || !!busy} onClick={() => openFollowUp(a)}>
                Add a follow-up
              </button>
            )}
            {working && (
              <button className={btn.danger} disabled={!!busy} onClick={() => setStopping(true)}>
                {busy === "stop" ? "Stopping…" : "Stop"}
              </button>
            )}
            <Link href={`/agents/${id}/edit`} className={btn.secondary}>
              Change this agent
            </Link>
            {!working && (
              <button className={btn.secondary} disabled={!!busy} onClick={() => (a.archived ? act("archive", `/api/agents/${id}/archive`, { archived: false }) : setArchiveAsk(true))}>
                {a.archived ? "Unarchive" : "Archive"}
              </button>
            )}
          </div>
        )}
      </div>
      {a.archived && <p className="mt-4 rounded-[14px] bg-soft px-4 py-3 text-[15px] text-muted">This job is archived. Its history is kept. Add a follow-up or press Unarchive to bring it back to the grid.</p>}
      <Confirm
        open={archiveAsk}
        title={`Archive ${a.name}?`}
        text="It leaves the grid and goes to Archived, with all its history. Schedules stop. You can bring it back any time."
        yes="Archive"
        onYes={() => {
          setArchiveAsk(false);
          act("archive", `/api/agents/${id}/archive`, { archived: true });
        }}
        onClose={() => setArchiveAsk(false)}
      />
      <Confirm
        open={stopping}
        title={`Stop ${a.name}?`}
        text="It stops what it's doing now. Its work so far is kept, and you can pick up where it stopped later."
        yes="Stop it"
        no="Keep it going"
        danger
        onYes={() => {
          setStopping(false);
          act("stop", `/api/agents/${id}/stop`);
        }}
        onClose={() => setStopping(false)}
      />
      {error && (
        <div className="mt-4">
          <ErrorBox message={error} onRetry={() => setError("")} where={`${a.name}'s page`} />
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          {isHeartbeat ? <HeartbeatNow data={data} /> : <RightNow data={data} act={act} busy={busy} />}
          {!isHeartbeat && !working && <FollowUp agent={a} disabled={false} />}
          {isHeartbeat ? <HeartbeatHistory data={data} /> : <History runs={runs} reports={data.reports} />}
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
              The job
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-muted">{a.prompt}</p>
            {a.job.brief && <JobBrief id={a.id} name={a.job.brief} />}
            {!isHeartbeat && <p className="mt-4 text-[15px] leading-relaxed">{agentSentence(a)}</p>}
            {isHeartbeat && <p className="mt-4 text-[14px] text-muted">This is the existing hourly job on this Mac. It's shown here to watch, not to change.</p>}
          </section>
        </aside>
      </div>

      <FullLog id={id} runs={runs} heartbeatLog={heartbeat ? [heartbeat.outLogTail, heartbeat.errLogTail] : null} />
    </div>
  );
}

// "Brief: CLAUDE.md · View": what the job was given to follow.
function JobBrief({ id, name }: { id: number; name: string }) {
  const [view, setView] = useState<null | { title: string; text: string | null }>(null);
  async function open() {
    setView({ title: name, text: null });
    const j = await call<{ text: string }>(`/api/agents/${id}/brief`, {}, "GET").catch((e: Error) => ({ text: e.message }));
    setView({ title: name, text: j.text });
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 text-[15px]">
      <span className="font-semibold">Brief: {name}</span>
      <button type="button" className={btn.link} onClick={open}>
        View
      </button>
      <TextViewer view={view} onClose={() => setView(null)} />
    </div>
  );
}

function StepLine({ steps, label }: { steps: Step[]; label?: string }) {
  if (!steps.length) return null;
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[15px]" aria-label={label ?? "Progress"}>
      {steps.map((s, i) => (
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

function Steps({ run }: { run: Run }) {
  const sub = run.extra.flow?.subSteps ?? [];
  const now = run.steps.find((s) => s.state === "now");
  return (
    <div className="mt-5 flex flex-col gap-3">
      <StepLine steps={run.steps} />
      {sub.length > 0 && now && (
        <div className="rounded-[14px] bg-soft px-4 py-3 text-[14px]">
          <p className="mb-1.5 text-[13px] font-semibold text-muted">{now.label}, step by step</p>
          <StepLine steps={sub} label={`${now.label}, step by step`} />
        </div>
      )}
    </div>
  );
}

export function ProgressBar({ p, color = "#2F4FD8" }: { p: { step: number; of: number; label: string }; color?: string }) {
  return (
    <div className="flex items-center gap-3 text-[14px]">
      <span className="shrink-0 font-semibold">
        Step {p.step} of {p.of}
      </span>
      <span className="relative h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-[#E6E8EC]" aria-hidden="true">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.round(((p.step - 0.5) / p.of) * 100)}%`, background: color }} />
      </span>
      <span className="truncate text-muted">{p.label}</span>
    </div>
  );
}

type Act = (l: string, u: string, b?: unknown) => Promise<void>;

// Writing (or rewriting) its plan: nothing is being built yet.
const planning = (run: Run) => run.status === "working" && (run.extra.proc?.phase ?? run.extra.flow?.stage) === "plan";

// After "Change it" on a plan, the job is what Nic changed it to: say so right under the task.
function Changed({ run }: { run: Run }) {
  const c = run.extra.planChanges;
  if (!c?.length) return null;
  return (
    <p className="mt-2 rounded-[14px] bg-[#EEF1FD] px-4 py-2 text-[15px] text-[#2A3F9E]">
      <span className="font-semibold">You changed it: </span>
      {c.at(-1)}
    </p>
  );
}

function RightNow({ data, act, busy }: { data: AgentPageState; act: Act; busy: string }) {
  const { view, runs } = data;
  const run = view.activeRun;
  const pending = view.pendingApproval;
  const last = runs[0];
  const review = last?.status === "stopped" ? undefined : runs.find((r) => r.status === "review");
  const freedom = (r: Run) => FREEDOM_WORDS[freedomOf({ mode: r.mode, allowed: r.extra.allowed ?? view.agent.allowed })].label;
  return (
    <section className="panel p-6 sm:p-8" aria-labelledby="now-h" aria-live="polite">
      <h2 id="now-h" className="text-[18px] font-semibold">
        Right now
      </h2>
      {run ? (
        <>
          <p className="clamp-3 mt-3 text-[20px] font-semibold leading-snug">{run.task}</p>
          <Changed run={run} />
          {run.status === "queued" ? (
            <p className="mt-2 rounded-[14px] bg-soft px-4 py-3 text-[15px] font-medium">
              {run.activity ?? "Waiting"}. {run.extra.resume ? "It carries on by itself, right where it left off." : "It starts by itself."}
            </p>
          ) : (
            <p className="mt-1 text-[15px] text-muted">
              {run.status === "waiting" ? "Waiting for you" : run.activity ?? "Working on it"} · {view.timeLabel} · {freedom(run)}
              {run.extra.flow?.careful ? " · Careful" : ""}
            </p>
          )}
          {planning(run) && (
            <p className="mt-3 rounded-[14px] bg-[#EEF1FD] px-4 py-3 text-[15px] font-medium text-[#2A3F9E]">
              It's writing its plan. It will wait for your OK before it changes anything.
            </p>
          )}
          {view.progress && run.status !== "waiting" && !planning(run) && (
            <div className="mt-4">
              <ProgressBar p={view.progress} color={view.agent.color} />
            </div>
          )}
          {!(run.status === "waiting" && run.plan) && !planning(run) && <Steps run={run} />}
          {run.extra.flow?.big && <BigJob run={run} used={data.bigUsed} held={data.held} act={act} busy={busy} />}
          {pending && pending.kind === "tool" && <AskBox approval={pending} act={act} busy={busy} />}
          {run.plan && run.status === "waiting" && !pending && <PlanBox run={run} act={act} busy={busy} />}
        </>
      ) : review ? (
        <ReadyBox run={review} act={act} busy={busy} />
      ) : last?.status === "stopped" && view.status === "timeout" ? (
        <>
          <p className="mt-3 text-[20px] font-semibold leading-snug">{last.task}</p>
          <div className="mt-4 rounded-[18px] bg-[#FDF0DC] p-5 text-[#8A4600]">
            <p className="text-[16px] font-semibold">{last.extra.overBudget ? "It used its usage budget." : `It ran out of time after ${duration(last.extra.activeMs ?? 0)} of work.`}</p>
            <p className="mt-1 text-[15px]">Its work so far is kept. It carries on right where it stopped.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {data.canContinue[last.id] ? (
                last.extra.overBudget ? (
                  <button className={btn.primary} disabled={!!busy} onClick={() => act("continue", `/api/runs/${last.id}/continue`, { addBudget: 20 })}>
                    Raise the budget (+20%)
                  </button>
                ) : (
                  <button className={btn.primary} disabled={!!busy} onClick={() => act("continue", `/api/runs/${last.id}/continue`, { addMinutes: 30 })}>
                    {busy === "continue" ? "Starting…" : "Keep going (+30 min)"}
                  </button>
                )
              ) : (
                <button className={btn.primary} disabled={!!busy} onClick={() => act("retry", `/api/runs/${last.id}/retry`)}>
                  Try again
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-[20px] font-semibold leading-snug">{view.task}</p>
          {!(view.status === "stopped" && last?.status === "stopped") && <p className="mt-1 text-[15px] text-muted">{view.summary}</p>}
          {data.reports[0] && last?.status === "done" && data.reports[0].runId === last.id && (
            <Link href={`/reports/${data.reports[0].id}`} className={`${btn.primary} mt-5`}>
              Read the report
            </Link>
          )}
          {view.status === "stopped" && last?.status === "stopped" && (
            <div className="mt-5">
              {last.extra.signIn ? (
                <div role="alert" className="rounded-[18px] bg-[#FDE8E6] p-5 text-[#A11B12]">
                  <p className="text-[15px] font-semibold">{last.extra.signIn === "github" ? "GitHub needs signing in again." : "Claude Code needs signing in again."}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href="/machine#accounts" className={btn.primary}>
                      Sign in again
                    </Link>
                    {data.canContinue[last.id] && (
                      <button className={btn.secondary} disabled={!!busy} onClick={() => act("retry", `/api/runs/${last.id}/retry`)}>
                        Pick up where it stopped
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <ErrorBox compact noFix={userStop(last.stopReason)} message={last.stopReason ?? "It stopped before finishing."} onRetry={() => act("retry", `/api/runs/${last.id}/retry`)} retryLabel={data.canContinue[last.id] ? "Pick up where it stopped" : undefined} where={`${view.agent.name}: "${last.task}"`} />
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// The pull request is ready: what the review said, and Look at it / Merge it / Send back with a note.
function ReadyBox({ run, act, busy }: { run: Run; act: Act; busy: string }) {
  const [confirm, setConfirm] = useState(false);
  const [install, setInstall] = useState(false);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState("");
  const careful = carefulText(run);
  const r = run.extra.review;
  return (
    <>
      <p className="clamp-3 mt-3 text-[20px] font-semibold leading-snug">{run.task}</p>
      <Changed run={run} />
      <p className="mt-1 text-[15px] text-muted">{run.result ? plainText(run.result) : "It finished and opened a pull request for you."}</p>
      {careful && <p className="mt-3 text-[15px] font-semibold text-[#1E6B34]">{careful}</p>}
      {!careful && r?.status === "running" && <p className="mt-3 text-[15px] font-medium text-[#2A3F9E]">A second AI is double-checking this change. Its notes appear here in a few minutes.</p>}
      {!careful && r?.status === "done" && (
        <div className="mt-3">
          <p className={`text-[15px] font-semibold ${r.verdict === "passed" ? "text-[#1E6B34]" : "text-[#8A4600]"}`}>{r.verdict === "passed" ? "Reviewed ✓ No problems found." : "The reviewer found things to fix:"}</p>
          {r.verdict !== "passed" && r.text && <div className="mt-2 max-h-72 overflow-auto rounded-[14px] bg-soft p-4 text-[14px] leading-relaxed whitespace-pre-wrap">{plainText(r.text)}</div>}
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        {run.prUrl && (
          <Link href={`/changes?pr=${encodeURIComponent(run.prUrl)}`} className={btn.primary}>
            Look at it
          </Link>
        )}
        {(run.extra.project ?? "") === "agentbox-panel" ? (
          <button className={btn.secondary} disabled={!!busy} onClick={() => setInstall(true)}>
            Install it
          </button>
        ) : (
          <button className={btn.secondary} disabled={!!busy} onClick={() => setConfirm(true)}>
            Put it in my project
          </button>
        )}
        {r?.verdict === "needs work" && !careful && (
          <button className={btn.secondary} disabled={!!busy} onClick={() => act("sendback", `/api/runs/${run.id}/send-back`, {})}>
            Send back to fix
          </button>
        )}
        <button className={btn.secondary} disabled={!!busy} onClick={() => setNoting(!noting)} aria-expanded={noting}>
          Send back with a note
        </button>
      </div>
      {noting && (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim()) act("note", `/api/runs/${run.id}/send-back`, { note }).then(() => setNoting(false));
          }}
        >
          <label className="flex flex-col gap-2">
            <span className="text-[15px] font-semibold">What should it change?</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="rounded-[14px] border border-[#C9CDD4] bg-white p-3 text-[15px]" />
          </label>
          <div>
            <button type="submit" className={btn.primary} disabled={!!busy || !note.trim()}>
              Send it back
            </button>
          </div>
        </form>
      )}
      <p className="mt-3 text-[14px] text-muted">When it's merged, this turns to Done by itself.</p>
      <Confirm
        open={install}
        title="Install it?"
        text="This merges it into agentbox, then updates and restarts the panel (a few minutes). If the new version doesn't come up, it goes back to the old one by itself. Watch it in Settings → Update agentbox."
        yes="Install it"
        onYes={() => {
          setInstall(false);
          act("install", `/api/runs/${run.id}/install`).then(() => location.assign("/settings#update"));
        }}
        onClose={() => setInstall(false)}
      />
      <Confirm
        open={confirm}
        title="Put these changes into your project?"
        text="This adds the changes to the real version of your project (this is called merging). If you change your mind later, start a task that says what to undo."
        yes="Put it in"
        onYes={() => {
          setConfirm(false);
          act("merge", `/api/runs/${run.id}/merge`);
        }}
        onClose={() => setConfirm(false)}
      />
    </>
  );
}

function carefulText(run: Run): string | null {
  const f = run.extra.flow;
  if (!f?.careful || !f.reviews.length) return null;
  const last = f.reviews[f.reviews.length - 1];
  const bits = [last.verdict === "passed" ? "Reviewed ✓" : f.fixedSinceReview ? "Reviewed and corrected ✓" : "Reviewed: a few things still need a look"];
  if (f.fixes) bits.push(`${f.fixes} ${f.fixes === 1 ? "fix" : "fixes"} made`);
  if (f.polished) bits.push("polished");
  return bits.join(" · ");
}

// Big jobs: the milestone checklist, usage against its budget, and the small runs it's holding back.
function BigJob({ run, used, held, act, busy }: { run: Run; used: number | null; held: AgentPageState["held"]; act: Act; busy: string }) {
  const big = run.extra.flow!.big!;
  const budget = big.budgetPct;
  return (
    <div className="mt-6 flex flex-col gap-5 rounded-[18px] border border-line p-5">
      <div>
        <h3 className="text-[16px] font-semibold">Milestones</h3>
        {big.milestones.length === 0 ? (
          <p className="mt-1 text-[15px] text-muted">It's reading the job and splitting it into milestones.</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2">
            {big.milestones.map((m, i) => (
              <li key={i} className="flex gap-3 text-[15px]">
                <span aria-hidden="true" className={m.state === "now" ? "text-[#2A3F9E]" : m.state === "done" ? "text-[#1E6B34]" : "text-muted"}>
                  {m.state === "done" ? "✓" : m.state === "now" ? "●" : "○"}
                </span>
                <span className="min-w-0">
                  <span className={m.state === "now" ? "font-semibold text-[#2A3F9E]" : m.state === "done" ? "" : "text-muted"}>
                    {i + 1}. {m.title}
                  </span>
                  <span className="sr-only">{m.state === "done" ? " (done)" : m.state === "now" ? " (doing now)" : " (later)"}</span>
                  {m.summary && <span className="block text-[14px] text-muted">{m.summary}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div>
        <p className="flex flex-wrap items-center justify-between gap-2 text-[15px]">
          <span className="font-semibold">Usage</span>
          <span className="text-muted">{used === null ? "checking…" : `about ${used}% of this week's usage · budget ${budget}%`}</span>
        </p>
        <span className="mt-2 block h-2 overflow-hidden rounded-full bg-[#E6E8EC]" aria-hidden="true">
          <span className="block h-full rounded-full bg-[#7048C8]" style={{ width: `${Math.min(100, ((used ?? 0) / Math.max(1, budget)) * 100)}%` }} />
        </span>
        <button className={`${btn.link} mt-1`} disabled={!!busy} onClick={() => act("budget", `/api/runs/${run.id}/budget`, { add: 20 })}>
          Raise the budget (+20%)
        </button>
      </div>
      {held.length > 0 && (
        <div>
          <h3 className="text-[16px] font-semibold">Waiting for it to finish</h3>
          <ul className="mt-1 text-[15px] text-muted">
            {held.map((h) => (
              <li key={h.id}>
                {h.name}: {h.task}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AskBox({ approval, act, busy }: { approval: Approval; act: Act; busy: string }) {
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

function PlanBox({ run, act, busy }: { run: Run; act: Act; busy: string }) {
  const [changing, setChanging] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="mt-6 rounded-[18px] bg-[#FDF0DC] p-5">
      <p className="text-[14px] font-semibold text-[#8A4600]">Here's its plan. Is this OK?</p>
      <div className="mt-3 max-h-[28rem] overflow-auto rounded-[14px] bg-white p-4 text-[15px] leading-relaxed whitespace-pre-wrap">{planText(run.plan ?? "")}</div>
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
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} placeholder="For example: Make it smaller, just one game." className="rounded-[14px] border border-[#C9CDD4] bg-white p-3 text-[15px]" />
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

export function openFollowUp(a: Agent, task?: string) {
  openTaskPanel({
    task,
    followUp: { id: a.id, name: a.name, project: a.project, kind: a.job.kind, freedom: freedomOf(a), careful: a.job.careful, model: a.model, connectors: a.job.connectors },
  });
}

// Follow-ups continue the same job; they open the shared Start a task panel.
function FollowUp({ agent, disabled, waiting }: { agent: Agent; disabled: boolean; waiting?: boolean }) {
  const [task, setTask] = useState("");
  return (
    <section className="panel p-6 sm:p-8" aria-labelledby="give-h">
      <h2 id="give-h" className="text-[18px] font-semibold">
        Add a follow-up
      </h2>
      <p className="mt-1 text-[15px] text-muted">
        {agent.job.kind === "research" ? "Ask more about the same topic. It builds on the earlier report." : "It carries on with this same job, so it remembers what it did and keeps working on the same change."}
      </p>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          openFollowUp(agent, task);
          setTask("");
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="sr-only">What should it do next?</span>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            rows={3}
            placeholder={agent.job.kind === "research" ? "For example: Which of these matters most on older iPhones?" : "For example: Make the buttons bigger on phones."}
            className="rounded-[14px] border border-[#C9CDD4] p-3 text-[15px] leading-relaxed"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={btn.primary} disabled={disabled}>
            Next
          </button>
          {disabled && <span className="text-[14px] text-muted">{waiting ? "It's waiting for your answer above. You can add a follow-up when it's done." : "It's working right now. You can add a follow-up when it's done."}</span>}
        </div>
      </form>
    </section>
  );
}

const RESULT: Record<Run["status"], { status: PillStatus; label: string }> = {
  queued: { status: "queued", label: "Waiting" },
  working: { status: "working", label: "Working" },
  waiting: { status: "needs", label: "Needs your OK" },
  review: { status: "needs", label: "Ready to look at" },
  done: { status: "done", label: "Done" },
  stopped: { status: "stopped", label: "Stopped" },
};

function History({ runs, reports }: { runs: Run[]; reports: AgentPageState["reports"] }) {
  const [all, setAll] = useState(false);
  const SHOW = 8;
  const shown = all ? runs : runs.slice(0, SHOW);
  return (
    <section className="panel p-6 sm:p-8" aria-labelledby="hist-h">
      <h2 id="hist-h" className="text-[18px] font-semibold">
        History
      </h2>
      {runs.length === 0 ? (
        <p className="mt-3 text-[15px] text-muted">No runs yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {shown.map((r, i) => {
            const res = RESULT[r.status];
            return (
              <li key={r.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="clamp-2 text-[15px] font-semibold leading-snug" title={r.task.slice(0, 600)}>{plainText(r.task.split("\n")[0])}</p>
                  <p className="mt-0.5 text-[14px] text-muted">
                    {new Date(r.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}, {clockOf(r.startedAt)}
                    {r.endedAt ? ` · took ${duration(r.endedAt - r.startedAt)}` : ""}
                    {r.status === "stopped" && r.stopReason ? ` · ${r.stopReason}` : ""}
                  </p>
                  {r.status === "stopped" && (
                    <p className="mt-0.5 text-[14px] text-muted">
                      {i === 0 ? "Its choices (like Pick up where it stopped) are in the Right now box above." : `Later runs came after it, so there's nothing to do.${/ran out of time/i.test(r.stopReason ?? "") ? " If this keeps happening, give it more time in Change this agent." : ""}`}
                    </p>
                  )}
                  {reports.find((x) => x.runId === r.id) ? (
                    <Link href={`/reports/${reports.find((x) => x.runId === r.id)!.id}`} className="inline-flex min-h-11 items-center text-[14px] font-semibold text-[#2A3F9E] underline">
                      Read the report: {reports.find((x) => x.runId === r.id)!.title}
                    </Link>
                  ) : (
                    r.result && r.status !== "stopped" && <Report text={r.result} />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={res.status} label={res.label} />
                  {r.prUrl && (
                    <Link href={`/changes?pr=${encodeURIComponent(r.prUrl)}`} className="inline-flex min-h-11 items-center text-[14px] font-semibold text-[#2A3F9E] underline">
                      See what changed
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {runs.length > SHOW && (
        <button type="button" className={btn.link + " mt-2"} aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show older runs (${runs.length - SHOW} more)`}
        </button>
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
      {hb.todayRuns.some((r) => r.outOfUsage) && (
        <p className="mt-1 text-[15px] font-medium text-[#8A4600]">
          {hb.todayRuns.filter((r) => r.outOfUsage).length} of them came in while Claude was out of usage, so they couldn't say more than that. That's not a problem with this Mac.
        </p>
      )}
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
              <StatusPill status={r.outOfUsage ? "needs" : r.onTime ? "done" : "needs"} label={r.outOfUsage ? "Out of usage" : r.onTime ? "On time" : "Late"} />
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
                      {new Date(r.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}, {clockOf(r.startedAt)} · {r.task.slice(0, 60)}
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
