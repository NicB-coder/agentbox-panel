"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { InboxState } from "@/lib/inbox";
import type { InboxItem } from "@/lib/types";
import { ago } from "@/lib/words";
import { Confirm, EmptyState, ErrorBox, InfoTip, PageTitle, post } from "./bits";
import { refreshHeader } from "./Header";
import { openNewTask } from "./NewTaskButton";
import { AgentIcon, btn, field } from "./ui";
import { usePoll } from "./usePoll";

type Wf = { id: number; name: string };

export default function InboxClient({ initial, workflows }: { initial: InboxState; workflows: Wf[] }) {
  const { data, refresh } = usePoll<InboxState>("/api/inbox", initial);
  const [error, setError] = useState<{ msg: string; retry?: () => void } | null>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    const again = () => refresh();
    window.addEventListener("agentbox:changed", again);
    return () => window.removeEventListener("agentbox:changed", again);
  }, [refresh]);

  async function act(key: string, url: string, body?: unknown, after?: (j: Record<string, unknown>) => void) {
    setBusy(key);
    setError(null);
    try {
      const j = await post(url, body);
      after?.(j);
      await refresh();
      refreshHeader();
    } catch (e) {
      setError({ msg: (e as Error).message, retry: () => act(key, url, body, after) });
    } finally {
      setBusy("");
    }
  }

  const n = data.items.length;
  return (
    <div>
      <PageTitle title="Inbox" sub={n ? `${n} ${n === 1 ? "thing needs" : "things need"} you. Newest first.` : "Everything that needs you shows up here."} />
      {error && (
        <div className="mb-6">
          <ErrorBox message={error.msg} onRetry={error.retry} where="the Inbox" />
        </div>
      )}
      <section aria-labelledby="needs-h">
        <h2 id="needs-h" className="sr-only">
          Needs you
        </h2>
        {n === 0 ? (
          <EmptyState
            icon="inbox"
            title="Nothing needs you. Nice."
            text="When an agent asks for your OK, opens a pull request, or something goes wrong, it lands here."
            action={
              <Link href="/" className={btn.secondary}>
                Go to your agents
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {data.items.map((it) => (
              <li key={it.key}>
                <Row it={it} act={act} busy={busy} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Ideas ideas={data.ideas} workflows={workflows} refresh={refresh} />
    </div>
  );
}

type Act = (key: string, url: string, body?: unknown, after?: (j: Record<string, unknown>) => void) => Promise<void>;

const KIND_WORD: Record<InboxItem["kind"], string> = {
  approval: "Wants your OK",
  plan: "Has a plan for you",
  pr: "Pull request ready",
  failed: "Stopped",
  wf_ask: "Waiting for you",
  wf_ship: "Ready to ship",
  wf_failed: "Workflow stopped",
};

function Row({ it, act, busy }: { it: InboxItem; act: Act; busy: string }) {
  const [more, setMore] = useState(false);
  const [note, setNote] = useState("");
  const [noting, setNoting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState("");
  const b = !!busy;
  const tone = it.kind === "failed" || it.kind === "wf_failed" ? "#A11B12" : "#8A4600";

  return (
    <article className="panel p-5 sm:p-6" aria-labelledby={`${it.key}-t`}>
      <div className="flex items-start gap-4">
        <AgentIcon name={it.icon} color={it.color} size={40} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-[14px]">
            <span className="font-semibold" style={{ color: tone }}>
              {KIND_WORD[it.kind]}
            </span>
            <span className="text-muted">
              · {it.who} · {ago(it.at)}
            </span>
            {"test" in it && it.test && <span className="rounded-full bg-soft px-2 py-0.5 text-[13px] font-semibold text-[#4A4F57]">Test run</span>}
          </p>
          <h3 id={`${it.key}-t`} className="mt-1 text-[17px] font-semibold leading-snug">
            {it.title}
          </h3>

          {it.kind === "approval" && (
            <p className="mt-2 text-[16px]">
              It wants to: <strong>{it.text}</strong>
            </p>
          )}
          {it.kind === "plan" && (
            <div className={`mt-3 overflow-hidden rounded-[14px] bg-soft p-4 text-[15px] leading-relaxed whitespace-pre-wrap ${more ? "" : "max-h-40"}`}>{it.text}</div>
          )}
          {(it.kind === "pr" || it.kind === "failed" || it.kind === "wf_ask" || it.kind === "wf_ship" || it.kind === "wf_failed") && (
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{it.text}</p>
          )}
          {it.kind === "approval" && more && it.detail && <pre className="mt-3 max-h-72 overflow-auto rounded-[14px] bg-soft p-4 text-[12px] whitespace-pre-wrap">{it.detail}</pre>}

          {noting && (
            <form
              className="mt-4 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (it.kind === "plan" && note.trim()) act(it.key, `/api/runs/${it.runId}/plan`, { approve: false, message: note });
                if (it.kind === "wf_ask") act(it.key, `/api/workflow-runs/${it.wfRunId}/answer`, { action: "send_back", note });
              }}
            >
              <label className="flex flex-col gap-2">
                <span className="text-[15px] font-semibold">{it.kind === "plan" ? "What should it change?" : "What should it fix? (optional)"}</span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="rounded-[14px] border border-[#C9CDD4] p-3 text-[15px]" autoFocus />
              </label>
              <div className="flex flex-wrap gap-3">
                <button type="submit" className={btn.primary} disabled={b || (it.kind === "plan" && !note.trim())}>
                  {it.kind === "plan" ? "Send" : "Send it back"}
                </button>
                <button type="button" className={btn.secondary} onClick={() => setNoting(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {!noting && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {it.kind === "approval" && (
                <>
                  <button className={btn.primary} disabled={b} onClick={() => act(it.key, `/api/approvals/${it.approvalId}`, { allow: true })}>
                    Allow
                  </button>
                  <button className={btn.secondary} disabled={b} onClick={() => act(it.key, `/api/approvals/${it.approvalId}`, { allow: false })}>
                    Deny
                  </button>
                  {it.detail && (
                    <button className={btn.link} aria-expanded={more} onClick={() => setMore(!more)}>
                      {more ? "Hide the details" : "Show the details"}
                    </button>
                  )}
                </>
              )}
              {it.kind === "plan" && (
                <>
                  <button className={btn.primary} disabled={b} onClick={() => act(it.key, `/api/runs/${it.runId}/plan`, { approve: true })}>
                    Approve plan
                  </button>
                  <button className={btn.secondary} disabled={b} onClick={() => setNoting(true)}>
                    Change it
                  </button>
                  <button className={btn.link} aria-expanded={more} onClick={() => setMore(!more)}>
                    {more ? "Show less" : "Read the whole plan"}
                  </button>
                </>
              )}
              {it.kind === "pr" && (
                <>
                  <a href={it.prUrl} target="_blank" rel="noreferrer" className={btn.primary}>
                    Look at the pull request
                  </a>
                  <button className={btn.secondary} disabled={b} onClick={() => setConfirm(true)}>
                    Merge it
                  </button>
                  {done ? (
                    <span className="text-[14px] font-medium text-[#1E6B34]">{done}</span>
                  ) : (
                    <button className={btn.secondary} disabled={b} onClick={() => act(it.key, `/api/runs/${it.runId}/ask-review`, {}, () => setDone("Reviewer is on it."))}>
                      Ask Reviewer to check it
                    </button>
                  )}
                  <Confirm
                    open={confirm}
                    title="Merge this pull request?"
                    text="Its changes go into main, the real version of your project. You can't undo this from here."
                    yes="Merge it"
                    onYes={() => {
                      setConfirm(false);
                      act(it.key, `/api/runs/${it.runId}/merge`);
                    }}
                    onClose={() => setConfirm(false)}
                  />
                </>
              )}
              {it.kind === "failed" && (
                <>
                  {it.canRetry && (
                    <button className={btn.primary} disabled={b} onClick={() => act(it.key, `/api/runs/${it.runId}/retry`)}>
                      Try again
                    </button>
                  )}
                  <FixButton error={`${it.who} stopped while doing "${it.title}": ${it.text}`} />
                  <button className={btn.link} disabled={b} onClick={() => act(it.key, `/api/runs/${it.runId}/dismiss`)}>
                    Dismiss
                  </button>
                </>
              )}
              {(it.kind === "wf_ask" || it.kind === "wf_ship") && (
                <>
                  <button className={btn.primary} disabled={b} onClick={() => act(it.key, `/api/workflow-runs/${it.wfRunId}/answer`, { action: "approve" })}>
                    {it.kind === "wf_ship" ? "Ship it" : "Approve"}
                  </button>
                  {it.kind === "wf_ask" && (
                    <button className={btn.secondary} disabled={b} onClick={() => setNoting(true)}>
                      Send back
                    </button>
                  )}
                  <button className={btn.secondary} disabled={b} onClick={() => act(it.key, `/api/workflow-runs/${it.wfRunId}/answer`, { action: "stop" })}>
                    Stop
                  </button>
                  {it.prUrl && (
                    <a href={it.prUrl} target="_blank" rel="noreferrer" className={btn.link}>
                      Pull request
                    </a>
                  )}
                </>
              )}
              {it.kind === "wf_failed" && (
                <>
                  <button className={btn.primary} disabled={b} onClick={() => act(it.key, `/api/workflow-runs/${it.wfRunId}/resume`)}>
                    Pick up where it stopped
                  </button>
                  <button className={btn.secondary} disabled={b} onClick={() => act(it.key, `/api/workflow-runs/${it.wfRunId}/retry`)}>
                    Start over
                  </button>
                  <FixButton error={`The workflow "${it.who}" stopped: ${it.text}`} />
                  <button className={btn.link} disabled={b} onClick={() => act(it.key, `/api/workflow-runs/${it.wfRunId}/dismiss`)}>
                    Dismiss
                  </button>
                </>
              )}
              <Link href={it.link} className={btn.link}>
                Open
              </Link>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function FixButton({ error }: { error: string }) {
  const [state, setState] = useState<"" | "busy" | number>("");
  const [err, setErr] = useState("");
  if (typeof state === "number")
    return (
      <Link href={`/agents/${state}`} className={btn.link}>
        Builder is on it
      </Link>
    );
  return (
    <>
      <button
        className={btn.secondary}
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          setErr("");
          try {
            const j = await post<{ agentId: number }>("/api/fix", { error, where: "the Inbox" });
            setState(j.agentId);
          } catch (e) {
            setErr((e as Error).message);
            setState("");
          }
        }}
      >
        {state === "busy" ? "Asking…" : "Ask Claude to fix this"}
      </button>
      {err && (
        <span role="alert" className="w-full text-[14px] font-medium text-[#A11B12]">
          {err}
        </span>
      )}
    </>
  );
}

// ---------- ideas ----------

function Ideas({ ideas, workflows, refresh }: { ideas: InboxState["ideas"]; workflows: Wf[]; refresh: () => Promise<void> }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return setErr("Write the idea first.");
    setBusy(true);
    setErr("");
    try {
      await post("/api/ideas", { text });
      setText("");
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-14" aria-labelledby="ideas-h">
      <h2 id="ideas-h" className="flex items-center text-[24px] font-bold tracking-tight">
        Ideas
        <InfoTip text="A place to jot things down. Any idea can become a task for an agent, or start a workflow, with one click." label="Ideas" />
      </h2>
      <p className="mt-1 text-[15px] text-muted">Jot it down now, hand it to an agent later.</p>
      <form onSubmit={add} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">New idea</span>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="For example: a dark mode for my portfolio" className={`${field} min-h-12 w-full`} maxLength={2000} />
        </label>
        <button type="submit" className={btn.primary} disabled={busy}>
          Add idea
        </button>
      </form>
      {err && (
        <p role="alert" className="mt-2 text-[14px] font-medium text-[#A11B12]">
          {err}
        </p>
      )}
      {ideas.length === 0 ? (
        <p className="mt-4 text-[15px] text-muted">No ideas yet. Type one above and press Add idea.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {ideas.map((i) => (
            <IdeaRow key={i.id} idea={i} workflows={workflows} refresh={refresh} />
          ))}
        </ul>
      )}
    </section>
  );
}

function IdeaRow({ idea, workflows, refresh }: { idea: InboxState["ideas"][number]; workflows: Wf[]; refresh: () => Promise<void> }) {
  const [picking, setPicking] = useState(false);
  const [wf, setWf] = useState<number>(workflows[0]?.id ?? 0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function startWf() {
    setBusy(true);
    setErr("");
    try {
      await post(`/api/workflows/${wf}/run`, { input: idea.text, ideaId: idea.id });
      location.href = `/workflows/${wf}`;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <li className="panel p-4 sm:p-5">
      <p className="text-[16px] leading-snug">
        <span aria-hidden="true">💡 </span>
        {idea.text}
      </p>
      <p className="mt-0.5 text-[13px] text-muted">{ago(idea.createdAt)}</p>
      {picking ? (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[14px] font-semibold">Which workflow?</span>
            <select value={wf} onChange={(e) => setWf(Number(e.target.value))} className={`${field} min-h-11`}>
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button className={btn.primary} onClick={startWf} disabled={busy}>
              {busy ? "Starting…" : "Start"}
            </button>
            <button className={btn.secondary} onClick={() => setPicking(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={btn.secondary} onClick={() => openNewTask({ task: idea.text, ideaId: idea.id })}>
            Make it a task
          </button>
          {workflows.length ? (
            <button className={btn.secondary} onClick={() => setPicking(true)}>
              Start a workflow
            </button>
          ) : (
            <Link href="/workflows/new" className={btn.secondary}>
              Make a workflow for it
            </Link>
          )}
          <button
            className={btn.link + " !text-muted"}
            onClick={async () => {
              await fetch(`/api/ideas/${idea.id}`, { method: "DELETE" });
              refresh();
            }}
          >
            Delete
          </button>
        </div>
      )}
      {err && (
        <p role="alert" className="mt-2 text-[14px] font-medium text-[#A11B12]">
          {err}
        </p>
      )}
    </li>
  );
}
