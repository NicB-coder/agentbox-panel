"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { InboxState } from "@/lib/inbox";
import type { InboxItem } from "@/lib/types";
import { ago, plainText } from "@/lib/words";
import { Confirm, EmptyState, ErrorBox, InfoTip, PageTitle, post } from "./bits";
import { refreshHeader } from "./Header";
import { openNewTask } from "./TaskPanel";
import { askHelper } from "./helper/helperStore";
import type { Notice } from "@/lib/notices";
import { AgentIcon, Icon, btn, field } from "./ui";
import { usePoll } from "./usePoll";

type Wf = { id: number; name: string };

export default function InboxClient({ initial, workflows }: { initial: InboxState; workflows: Wf[] }) {
  const { data, refresh } = usePoll<InboxState>("/api/inbox", initial);
  const [error, setError] = useState<{ msg: string; retry?: () => void } | null>(null);
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

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
  const fresh = data.notices.filter((x) => !x.openedAt).length;
  const shown = data.notices.filter((x) => (filter === "shipped" ? x.kind === "shipped" : filter === "reports" ? x.kind === "report" : filter === "all" ? !x.openedAt : false));
  const rows: ({ t: "item"; it: InboxItem; at: number } | { t: "notice"; nt: Notice; at: number })[] = [
    ...(filter === "all" || filter === "needs" ? data.items.map((it) => ({ t: "item" as const, it, at: it.at })) : []),
    ...shown.map((nt) => ({ t: "notice" as const, nt, at: nt.createdAt })),
  ].sort((a, b) => b.at - a.at);
  const FILTERS: [Filter, string][] = [
    ["all", "All"],
    ["needs", `Needs you${n ? ` (${n})` : ""}`],
    ["shipped", "Done & shipped"],
    ["reports", "Reports"],
  ];
  return (
    <div>
      <PageTitle
        title="Inbox"
        sub={n || fresh ? [n ? `${n} ${n === 1 ? "thing needs" : "things need"} you` : "", fresh ? `${fresh} new` : ""].filter(Boolean).join(" · ") + ". Newest first." : "Everything that needs you shows up here."}
      />
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Show">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-semibold ${filter === k ? "bg-ink text-white" : "bg-soft text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <div className="mb-6">
          <ErrorBox message={error.msg} onRetry={error.retry} where="the Inbox" />
        </div>
      )}
      <section aria-labelledby="needs-h">
        <h2 id="needs-h" className="sr-only">
          Needs you
        </h2>
        {rows.length === 0 ? (
          <EmptyState
            icon="inbox"
            title={filter === "shipped" ? "Nothing shipped this week yet" : filter === "reports" ? "No reports yet" : "Nothing needs you. Nice."}
            text={
              filter === "shipped"
                ? "When a pull request is merged, it shows up here with what changed and a Play button."
                : filter === "reports"
                  ? "Start a task and pick Research something. Its report lands here."
                  : "When an agent asks for your OK, opens a pull request, or something goes wrong, it lands here."
            }
            action={
              <Link href="/" className={btn.secondary}>
                Go to your agents
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {rows.map((r) =>
              r.t === "item" ? (
                <li key={r.it.key}>
                  <Row it={r.it} act={act} busy={busy} />
                </li>
              ) : (
                <li key={`n${r.nt.id}`}>
                  <NoticeRow n={r.nt} act={act} />
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <Ideas ideas={data.ideas} workflows={workflows} refresh={refresh} />
    </div>
  );
}

type Filter = "all" | "needs" | "shipped" | "reports";

// "Shipped: Arcade site" and finished reports: they stay until opened.
function NoticeRow({ n, act }: { n: Notice; act: Act }) {
  const open = () => fetch(`/api/notices/${n.id}`, { method: "POST" }).then(() => window.dispatchEvent(new Event("agentbox:refresh")));
  const isNew = !n.openedAt;
  return (
    <article className={`panel p-5 sm:p-6 ${isNew ? "border-[#B7DFC3] bg-[#F5FBF7]" : ""}`} aria-labelledby={`n${n.id}-t`}>
      <div className="flex items-start gap-4">
        <AgentIcon name={n.kind === "report" ? "book" : "rocket"} color={n.kind === "report" ? "#7048C8" : "#1E6B34"} size={40} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-[14px]">
            <span className="font-semibold text-[#1E6B34]">{n.kind === "report" ? "Report ready" : "Shipped"}</span>
            <span className="text-muted">· {ago(n.createdAt)}</span>
            {isNew && <span className="rounded-full bg-[#1E6B34] px-2 py-0.5 text-[12px] font-bold text-white">New</span>}
          </p>
          <h3 id={`n${n.id}-t`} className="mt-1 text-[17px] font-semibold leading-snug">
            {n.title.replace(/^(Shipped|Report): /, "")}
          </h3>
          {n.text && <p className="mt-2 text-[15px] leading-relaxed text-muted">{n.text}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {n.link && (
              <Link href={n.link} className={btn.primary} onClick={open}>
                {n.kind === "report" ? "Read the report" : "See what changed"}
              </Link>
            )}
            {n.playUrl && (
              <a href={n.playUrl} target="_blank" rel="noreferrer" className={btn.secondary} onClick={open}>
                <Icon name="play" color="#15171B" size={16} /> Play
              </a>
            )}
            {isNew && (
              <button className={btn.link} onClick={() => act(`n${n.id}`, `/api/notices/${n.id}`)}>
                Got it
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
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
  wf_done: "Finished",
  quiet: "Didn't do anything",
  file_pr: "A file to add",
};

function Row({ it, act, busy }: { it: InboxItem; act: Act; busy: string }) {
  const [more, setMore] = useState(false);
  const [note, setNote] = useState("");
  const [noting, setNoting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState("");
  const b = !!busy;
  const soft = it.kind === "failed" && (it.stopKind === "time" || it.stopKind === "budget");
  const tone = (it.kind === "failed" && !soft) || it.kind === "wf_failed" ? "#A11B12" : it.kind === "wf_done" ? "#1E6B34" : "#8A4600";
  const word = it.kind === "quiet" && it.prUrl ? "Finished very fast" : it.kind === "failed" ? (it.stopKind === "time" ? "Ran out of time" : it.stopKind === "budget" ? "Used its budget" : it.stopKind === "signin" ? "Needs signing in" : "Stopped") : KIND_WORD[it.kind];

  return (
    <article className="panel p-5 sm:p-6" aria-labelledby={`${it.key}-t`}>
      <div className="flex items-start gap-4">
        <AgentIcon name={it.icon} color={it.color} size={40} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-[14px]">
            <span className="font-semibold" style={{ color: tone }}>
              {word}
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
          {it.kind === "pr" && it.careful && <p className="mt-2 text-[15px] font-semibold text-[#1E6B34]">{it.careful}</p>}
          {it.kind === "pr" && !it.careful && it.review && <ReviewFindings review={it.review} />}
          {(it.kind === "pr" || it.kind === "failed" || it.kind === "wf_ask" || it.kind === "wf_ship" || it.kind === "wf_failed" || it.kind === "wf_done" || it.kind === "file_pr") && (
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{plainText(it.text)}</p>
          )}
          {it.kind === "pr" && it.quick && <p className="mt-2 text-[15px] font-semibold text-[#8A4600]">It finished in under 2 minutes. Check it did the whole job before you merge.</p>}
          {it.kind === "quiet" && (
            <>
              <p className="mt-2 text-[16px] leading-relaxed">{it.text}</p>
              {it.said && (
                <p className="mt-2 text-[15px] leading-relaxed text-muted">
                  It said: “{it.said}”
                </p>
              )}
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                <strong className="font-semibold text-ink">What to do next:</strong> {it.next}
              </p>
            </>
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
                  <Link href={`/changes?pr=${encodeURIComponent(it.prUrl)}`} className={btn.primary}>
                    Look at it
                  </Link>
                  <button className={btn.secondary} disabled={b} onClick={() => setConfirm(true)}>
                    Merge it
                  </button>
                  {done ? (
                    <span className="text-[14px] font-medium text-[#1E6B34]">{done}</span>
                  ) : it.review?.verdict === "needs work" && !it.careful ? (
                    <button className={btn.secondary} disabled={b} onClick={() => act(it.key, `/api/runs/${it.runId}/send-back`, {}, () => setDone("Sent back. It's fixing them."))}>
                      Send back to fix
                    </button>
                  ) : null}
                  {!done && it.review?.status !== "running" && (
                    <button className={btn.link} aria-expanded={more} onClick={() => setMore(!more)}>
                      More
                    </button>
                  )}
                  {more && !done && it.review?.status !== "running" && (
                    <button className={btn.secondary} disabled={b} onClick={() => act(it.key, `/api/runs/${it.runId}/ask-review`, {}, () => setDone("A second reviewer is on it."))}>
                      Get a second opinion
                    </button>
                  )}
                  <Confirm
                    open={confirm}
                    title="Put these changes into your project?"
                    text="This adds the changes to the real version of your project (this is called merging). If you change your mind later, start a task that says what to undo."
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
                  {it.stopKind === "time" && it.canContinue ? (
                    <button className={btn.primary} disabled={b} onClick={() => act(it.key, `/api/runs/${it.runId}/continue`, { addMinutes: 30 })}>
                      Keep going (+30 min)
                    </button>
                  ) : it.stopKind === "budget" && it.canContinue ? (
                    <button className={btn.primary} disabled={b} onClick={() => act(it.key, `/api/runs/${it.runId}/continue`, { addBudget: 20 })}>
                      Raise the budget (+20%)
                    </button>
                  ) : it.stopKind === "signin" ? (
                    <Link href="/machine#accounts" className={btn.primary}>
                      Sign in again
                    </Link>
                  ) : (
                    it.canRetry && (
                      <button className={btn.primary} disabled={b} onClick={() => act(it.key, `/api/runs/${it.runId}/retry`)}>
                        {it.canContinue ? "Pick up where it stopped" : "Try again"}
                      </button>
                    )
                  )}
                  {it.stopKind === "error" && <FixButton error={`${it.who} stopped while doing "${it.title}": ${it.text}`} />}
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
              {it.kind === "wf_done" && (
                <>
                  <Link href={`/changes?pr=${encodeURIComponent(it.prUrl)}`} className={btn.primary}>
                    Look at it
                  </Link>
                  <button className={btn.link} disabled={b} onClick={() => act(it.key, `/api/workflow-runs/${it.wfRunId}/dismiss`)}>
                    Dismiss
                  </button>
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
              {it.kind === "file_pr" && (
                <>
                  <button className={btn.primary} disabled={b} onClick={() => act(it.key, `/api/file-prs/${it.fileId}/merge`)}>
                    {busy === it.key ? "Merging…" : "Merge it"}
                  </button>
                  <button className={btn.secondary} disabled={b} onClick={() => act(it.key, `/api/file-prs/${it.fileId}/close`)}>
                    Don't add it
                  </button>
                  <a href={it.prUrl} target="_blank" rel="noreferrer" className={btn.link}>
                    See it on GitHub
                  </a>
                </>
              )}
              {it.kind === "quiet" && (
                <>
                  {it.prUrl && (
                    <Link href={`/changes?pr=${encodeURIComponent(it.prUrl)}`} className={btn.primary}>
                      Look at it
                    </Link>
                  )}
                  {it.canRetry && (
                    <button className={it.prUrl ? btn.secondary : btn.primary} disabled={b} onClick={() => act(it.key, it.runId ? `/api/runs/${it.runId}/retry` : `/api/workflow-runs/${it.wfRunId}/retry`)}>
                      Try again
                    </button>
                  )}
                  <button className={btn.secondary} onClick={() => askHelper(`Why did “${it.title.split("\n")[0].slice(0, 120)}” (${it.runId ? `run ${it.runId}` : `workflow run ${it.wfRunId}`}) finish without doing anything? What should I change?`)}>
                    Ask the Helper why
                  </button>
                  <button className={btn.link} disabled={b} onClick={() => act(it.key, it.runId ? `/api/runs/${it.runId}/dismiss` : `/api/workflow-runs/${it.wfRunId}/dismiss`)}>
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

function ReviewFindings({ review }: { review: NonNullable<Extract<InboxItem, { kind: "pr" }>["review"]> }) {
  const [open, setOpen] = useState(false);
  if (review.status === "running") return <p className="mt-2 text-[15px] font-medium text-[#2A3F9E]">A reviewer is reading it now…</p>;
  if (review.status === "stopped" || !review.verdict) return null;
  const ok = review.verdict === "passed";
  return (
    <div className="mt-2">
      <p className={`text-[15px] font-semibold ${ok ? "text-[#1E6B34]" : "text-[#8A4600]"}`}>{ok ? "Reviewed ✓ Nothing to fix." : "The reviewer found things to fix."}</p>
      {review.text && (
        <>
          <button className={btn.link + " !text-[14px]"} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "Hide what it found" : "What it found"}
          </button>
          {open && <div className="mt-1 max-h-80 overflow-auto rounded-[14px] bg-soft p-4 text-[14px] leading-relaxed whitespace-pre-wrap">{plainText(review.text)}</div>}
        </>
      )}
    </div>
  );
}

function FixButton({ error }: { error: string }) {
  const [state, setState] = useState<"" | "busy" | number>("");
  const [err, setErr] = useState("");
  if (typeof state === "number")
    return (
      <Link href={`/agents/${state}`} className={btn.link}>
        An agent is on it
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
