"use client";
import { useEffect, useId, useRef, useState } from "react";
import { diffSteps, markWord, type ChangeDraft, type DiffChip } from "@/lib/changeView";
import type { WfStep, WorkflowInput } from "@/lib/types";
import type { AgentRef } from "@/lib/wf";
import { ErrorBox, post } from "../bits";
import { Icon, btn } from "../ui";

// "Change it in your own words": Nic says what to change, Claude drafts it, and he sees the steps
// before → after. Nothing changes until he presses Apply.

const EXAMPLES = ["Add a step that tests it on a phone", "Make the review stricter", "Don't ship, just tell me"];

export default function ChangeBox({
  id, def, agents, onApply, start, onStarted, running,
}: {
  id: number;
  def: WorkflowInput;
  agents: AgentRef[];
  onApply: (d: ChangeDraft, text: string) => void;
  start?: string; // the Helper opened the editor with a change already written: draft it straight away
  onStarted?: () => void;
  running: boolean;
}) {
  const boxId = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<{ d: ChangeDraft & { before?: WfStep[] }; text: string; before: WorkflowInput } | null>(null);
  const asked = useRef(0);

  async function ask(t = text) {
    const words = t.trim();
    if (words.length < 4) return setError("Say what to change, for example: Add a step that tests it on a phone.");
    const n = ++asked.current;
    setBusy(true);
    setError("");
    setDraft(null);
    const before = def;
    try {
      const d = await post<ChangeDraft & { before?: WfStep[] }>(`/api/workflows/${id}/change`, { text: words, def: before });
      if (n === asked.current) setDraft({ d, text: words, before });
    } catch (e) {
      if (n === asked.current) setError((e as Error).message);
    } finally {
      if (n === asked.current) setBusy(false);
    }
  }
  const started = useRef("");
  useEffect(() => {
    if (!start) {
      started.current = "";
      return;
    }
    if (started.current === start) return;
    started.current = start;
    setText(start);
    ask(start);
    onStarted?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  function cancel() {
    asked.current++;
    setBusy(false);
    setDraft(null);
    setError("");
  }

  const diff = draft ? diffSteps(draft.d.before ?? draft.before.steps, draft.d.steps, agents) : null;
  // The editor changed while Claude was drafting (an undo, a click on a step): the preview may be out of date.
  const stale = !!draft && JSON.stringify(draft.before) !== JSON.stringify(def);

  return (
    <section className="mt-6 max-w-[860px] rounded-[24px] border border-line bg-[#FAFAFB] p-5 sm:p-6" aria-labelledby={`${boxId}-h`}>
      <h2 id={`${boxId}-h`} className="text-[17px] font-semibold">
        <label htmlFor={boxId}>Change it in your own words</label>
      </h2>
      <p className="mt-1 text-[14px] text-muted">
        Say what should be different. You'll see the steps before and after, and nothing changes until you press Apply.
        {running ? " Changes apply to the next run." : ""}
      </p>
      <form
        className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start"
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <textarea
          id={boxId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask();
            }
          }}
          rows={2}
          maxLength={2000}
          placeholder="For example: Add a step that tests it on a phone"
          className="min-h-12 flex-1 rounded-[14px] border border-[#C9CDD4] bg-white p-3 text-[15px] leading-relaxed"
        />
        <button type="submit" className={btn.primary} disabled={busy || text.trim().length < 4}>
          {busy ? "Drafting…" : "Draft the change"}
        </button>
      </form>
      {!text && !busy && !draft && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[14px] text-muted">Try:</span>
          {EXAMPLES.map((x) => (
            <button key={x} type="button" className="min-h-11 rounded-full border border-[#C9CDD4] bg-white px-4 text-[14px] font-medium hover:bg-soft" onClick={() => setText(x)}>
              {x}
            </button>
          ))}
        </div>
      )}
      {busy && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-2 text-[15px] text-muted" role="status">
            <span className="pulse h-2.5 w-2.5 rounded-full bg-[#2F4FD8]" aria-hidden="true" /> Claude is drafting the change. This takes about half a minute.
          </span>
          <button type="button" className={btn.link} onClick={cancel}>
            Cancel
          </button>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <ErrorBox message={error} onRetry={text.trim().length >= 4 ? () => ask() : undefined} where="Change it in your own words" compact />
        </div>
      )}
      {draft && diff && (
        <div className="mt-4 flex flex-col gap-4 rounded-[18px] border border-line bg-white p-4 sm:p-5" role="region" aria-label="The change, before and after">
          <p className="text-[16px] font-semibold leading-snug">{draft.d.summary || (diff.changed ? "Here's the change." : "Nothing would change.")}</p>
          {diff.changed ? (
            <>
              <Row label="Before" chips={diff.before} />
              <Row label="After" chips={diff.after} />
              {draft.d.limits.maxLoops !== draft.before.limits.maxLoops && (
                <p className="text-[14px] text-muted">
                  “Needs work” rounds: {draft.before.limits.maxLoops} → {draft.d.limits.maxLoops}
                </p>
              )}
            </>
          ) : (
            <p className="text-[15px] text-muted">The steps would stay exactly as they are. Try saying it another way.</p>
          )}
          {stale && <p className="text-[14px] font-medium text-[#8A4600]">You changed the workflow while this was being drafted. Applying it replaces those changes (you can Undo).</p>}
          <div className="flex flex-wrap gap-3">
            {diff.changed && (
              <button
                type="button"
                className={btn.primary}
                onClick={() => {
                  onApply(draft.d, draft.text);
                  setDraft(null);
                  setText("");
                }}
              >
                Apply
              </button>
            )}
            <button type="button" className={btn.secondary} onClick={cancel}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ label, chips }: { label: string; chips: DiffChip[] }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
      <p className="w-16 shrink-0 pt-1 text-[14px] font-semibold text-muted">{label}</p>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2" aria-label={`${label}: the steps`}>
        {chips.map((c, i) => (
          <li key={c.id} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-[12px] text-[#9AA0A8]" aria-hidden="true">
                →
              </span>
            )}
            <span
              className={`flex min-h-9 items-center gap-1.5 rounded-[11px] border px-2.5 text-[14px] font-medium ${
                c.mark === "gone" ? "border-[#F2C4BF] bg-[#FDE8E6] text-[#A11B12] line-through" : c.mark === "same" ? "border-line bg-white" : "border-[#2A3F9E] bg-[#EEF1FD] text-[#2A3F9E]"
              }`}
            >
              <Icon name={c.icon} color={c.mark === "gone" ? "#A11B12" : c.mark === "same" ? c.color : "#2A3F9E"} size={14} />
              {c.title}
              {c.mark !== "same" && <span className="text-[12px] font-semibold no-underline">({markWord(c.mark)})</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
