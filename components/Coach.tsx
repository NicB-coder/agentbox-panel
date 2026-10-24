"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { BriefRef } from "@/lib/types";
import type { CoachCheck, CoachIdea, CoachImproved, CoachQuestion, CoachWhere, Suggestion, SuggestionKey } from "@/lib/coach";
import { post } from "./bits";
import { Chip } from "./controls";
import { btn } from "./ui";

// The prompt coach, shared by the workflow start screen and the Start a task panel (lib/coach.ts does the
// asking). It never changes Nic's goal by itself: every change is a button he presses.

export const SUGGESTION_LABEL: Record<SuggestionKey, string> = {
  research_first: "Research first",
  more_time: "Give the build 2 hours",
  smartest: "Use the Smartest model",
  big_job: "Make it a Big job",
  research_kind: "Make it a research question",
  look_only: "Look only",
  careful: "Careful mode",
};

type Phase =
  | { at: "checking" }
  | { at: "questions"; check: CoachCheck }
  | { at: "good"; check: CoachCheck }
  | { at: "improving"; check: CoachCheck | null }
  | { at: "improved"; result: CoachImproved; check: CoachCheck | null }
  | { at: "error"; message: string; retry: () => void };

function Working({ text, onSkip, skipLabel }: { text: string; onSkip: () => void; skipLabel: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="flex items-center gap-2 text-[15px] text-muted" role="status">
        <span className="pulse h-2.5 w-2.5 rounded-full bg-[#2F4FD8]" aria-hidden="true" /> {text}
      </span>
      <button type="button" className={btn.link} onClick={onSkip}>
        {skipLabel}
      </button>
    </div>
  );
}

function Suggestions({ list, applied, onApply }: { list: Suggestion[]; applied: string[]; onApply: (k: SuggestionKey) => void }) {
  if (list.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[15px] font-semibold">Settings I'd suggest</p>
      <ul className="flex flex-col gap-2">
        {list.map((s) => {
          const on = applied.includes(s.key);
          return (
            <li key={s.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[14px] border border-line bg-white px-4 py-2">
              <span className="min-w-0 flex-1 text-[15px]">
                <span className="font-semibold">{SUGGESTION_LABEL[s.key]}</span>
                <span className="text-muted"> · {s.why}</span>
              </span>
              <button type="button" className={`${btn.secondary} !min-h-11 !px-4 !text-[14px]`} disabled={on} onClick={() => onApply(s.key)}>
                {on ? "✓ Done" : "Use this"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Question({ q, value, onChange, index }: { q: CoachQuestion; value: { picked: string[]; other: string; otherOn: boolean }; onChange: (v: { picked: string[]; other: string; otherOn: boolean }) => void; index: number }) {
  const otherId = useId();
  const pick = (c: string, on: boolean) =>
    onChange({ ...value, picked: q.multi ? (on ? [...value.picked, c] : value.picked.filter((x) => x !== c)) : on ? [c] : [], otherOn: q.multi ? value.otherOn : on ? false : value.otherOn });
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[15px] font-semibold">
        {index + 1}. {q.q}
        {q.multi && <span className="font-normal text-muted"> (pick any)</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {q.choices.map((c) => (
          <Chip key={c} checked={value.picked.includes(c)} onChange={(on) => pick(c, on)}>
            {c}
          </Chip>
        ))}
        <Chip checked={value.otherOn} onChange={(on) => onChange({ picked: q.multi ? value.picked : [], other: value.other, otherOn: on })}>
          Other
        </Chip>
      </div>
      {value.otherOn && (
        <>
          <label htmlFor={otherId} className="sr-only">
            Your own answer to: {q.q}
          </label>
          <input id={otherId} value={value.other} onChange={(e) => onChange({ ...value, other: e.target.value })} placeholder="Type your own answer" className="min-h-11 max-w-[420px] rounded-[14px] border border-[#C9CDD4] bg-white px-3 text-[15px]" autoFocus />
        </>
      )}
    </fieldset>
  );
}

// Shown when Nic presses Next/Start the first time. onDone(goal) carries on with that goal.
export function CoachBox(props: {
  where: CoachWhere;
  goal: string;
  brief: BriefRef | null;
  current: SuggestionKey[]; // settings that are already on, so it doesn't suggest them
  onApply: (k: SuggestionKey) => void;
  onDone: (goal: string) => void;
  onEdit: (goal: string) => void; // put this text in the goal box so Nic can change it
  onClose: () => void;
  doneLabel: string; // "Next" or "Start"
}) {
  const { where, goal, brief, current, onApply, onDone, onEdit, onClose, doneLabel } = props;
  const [phase, setPhase] = useState<Phase>({ at: "checking" });
  const [answers, setAnswers] = useState<Record<number, { picked: string[]; other: string; otherOn: boolean }>>({});
  const [applied, setApplied] = useState<string[]>([]);
  const box = useRef<HTMLElement>(null);
  const alive = useRef(true);
  const started = useRef(false); // one check per opening, even when React mounts it twice in dev
  const briefArg = brief ? { name: brief.name, hash: brief.hash } : null;

  async function check() {
    setPhase({ at: "checking" });
    try {
      const r = await post<CoachCheck & { skip?: string }>("/api/coach", { step: "check", goal, where, brief: briefArg, current });
      if (!alive.current) return;
      if (r.skip) return onDone(goal);
      setPhase(r.detailed ? { at: "good", check: r } : { at: "questions", check: r });
    } catch (e) {
      if (alive.current) setPhase({ at: "error", message: (e as Error).message, retry: check });
    }
  }

  async function improve(check: CoachCheck | null, withAnswers: boolean) {
    setPhase({ at: "improving", check });
    const list = withAnswers && check
      ? check.questions.map((q, i) => {
          const v = answers[i];
          const a = [...(v?.picked ?? []), ...(v?.otherOn && v.other.trim() ? [v.other.trim()] : [])].join(", ");
          return { q: q.q, a };
        }).filter((x) => x.a)
      : [];
    try {
      const r = await post<CoachImproved & { skip?: string }>("/api/coach", { step: "improve", goal, where, brief: briefArg, answers: list, current: [...current, ...applied] });
      if (!alive.current) return;
      if (r.skip) return onDone(goal);
      setPhase({ at: "improved", result: r, check });
    } catch (e) {
      if (alive.current) setPhase({ at: "error", message: (e as Error).message, retry: () => improve(check, withAnswers) });
    }
  }

  useEffect(() => {
    alive.current = true;
    if (!started.current) {
      started.current = true;
      check();
      box.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    return () => {
      alive.current = false;
    };
    // Runs once each time the coach opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function apply(k: SuggestionKey) {
    setApplied((a) => [...a, k]);
    onApply(k);
  }

  const skip = () => onDone(goal);
  const answered = phase.at === "questions" && Object.values(answers).some((v) => v.picked.length || (v.otherOn && v.other.trim()));

  return (
    <section ref={box} className="flex flex-col gap-5 rounded-[24px] border border-[#C9D3F5] bg-[#F6F8FE] p-5 sm:p-6" aria-labelledby="coach-h" aria-live="polite">
      <h2 id="coach-h" className="text-[18px] font-bold">
        {phase.at === "good" ? "Looks good ✓" : phase.at === "improved" ? "Here's an improved version" : phase.at === "questions" ? "A few quick questions" : "Checking your goal"}
      </h2>

      {phase.at === "checking" && <Working text="Reading what you wrote. This takes a few seconds." onSkip={skip} skipLabel={`Skip this and ${doneLabel.toLowerCase()}`} />}

      {phase.at === "questions" && (
        <>
          <p className="text-[15px] text-muted">Tap an answer for each. They help the agent build the right thing. You can skip any.</p>
          {phase.check.questions.map((q, i) => (
            <Question key={i} index={i} q={q} value={answers[i] ?? { picked: [], other: "", otherOn: false }} onChange={(v) => setAnswers({ ...answers, [i]: v })} />
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={btn.primary} onClick={() => improve(phase.check, true)} disabled={!answered}>
              Improve my goal
            </button>
            <button type="button" className={btn.secondary} onClick={() => improve(phase.check, false)}>
              Skip the questions
            </button>
            <button type="button" className={btn.link} onClick={skip}>
              Keep mine and {doneLabel.toLowerCase()}
            </button>
          </div>
        </>
      )}

      {phase.at === "good" && (
        <>
          <p className="text-[15px]">{phase.check.verdict}</p>
          <Suggestions list={phase.check.suggestions} applied={applied} onApply={apply} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={btn.primary} onClick={skip}>
              {doneLabel}
            </button>
            <button type="button" className={btn.secondary} onClick={() => improve(phase.check, false)}>
              Make it more detailed
            </button>
            <button type="button" className={btn.link} onClick={onClose}>
              Change my goal
            </button>
          </div>
        </>
      )}

      {phase.at === "improving" && <Working text="Writing an improved version. About 20 seconds." onSkip={skip} skipLabel={`Keep mine and ${doneLabel.toLowerCase()}`} />}

      {phase.at === "improved" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <p className="text-[14px] font-semibold text-muted">What you wrote</p>
              <p className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-[14px] border border-line bg-white p-4 text-[15px] leading-relaxed text-muted">{goal}</p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[14px] font-semibold">Improved version</p>
              <p className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-[14px] border border-ink bg-white p-4 text-[15px] leading-relaxed">{phase.result.improved}</p>
            </div>
          </div>
          <Suggestions list={[...(phase.check?.suggestions ?? []), ...phase.result.suggestions.filter((s) => !phase.check?.suggestions.some((x) => x.key === s.key))]} applied={applied} onApply={apply} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={btn.primary} onClick={() => onDone(phase.result.improved)}>
              Use this and {doneLabel.toLowerCase()}
            </button>
            <button type="button" className={btn.secondary} onClick={() => onEdit(phase.result.improved)}>
              Edit it
            </button>
            <button type="button" className={btn.secondary} onClick={skip}>
              Keep mine
            </button>
          </div>
        </>
      )}

      {phase.at === "error" && (
        <>
          <p className="text-[15px]">{phase.message} Your goal is fine as it is, so you can carry on.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={btn.primary} onClick={skip}>
              {doneLabel} with my words
            </button>
            <button type="button" className={btn.secondary} onClick={phase.retry}>
              Try again
            </button>
          </div>
        </>
      )}
    </section>
  );
}

const INTERESTS = ["Games", "Music", "Sports", "School", "Friends", "Saving time", "Money", "Animals"];

// "Help me think of ideas": a couple of taps about what Nic likes, then 4 ideas sized for one overnight run.
export function IdeaHelp({ where, onPick, onClose }: { where: CoachWhere; onPick: (goal: string) => void; onClose: () => void }) {
  const [into, setInto] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [ideas, setIdeas] = useState<CoachIdea[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const intoId = useId();

  async function suggest() {
    setBusy(true);
    setError("");
    try {
      const r = await post<{ ideas?: CoachIdea[]; skip?: string }>("/api/coach", { step: "ideas", where, interests: [tags.join(", "), into.trim()].filter(Boolean).join(". ") });
      if (r.skip) setError(r.skip + " Try again later.");
      else setIdeas(r.ideas ?? []);
    } catch (e) {
      setError((e as Error).message + " Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-[24px] border border-[#C9D3F5] bg-[#F6F8FE] p-5 sm:p-6" aria-labelledby="ideas-h">
      <h2 id="ideas-h" className="text-[18px] font-bold">
        Let's find an idea
      </h2>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[15px] font-semibold">What are you into? (pick any)</legend>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((t) => (
            <Chip key={t} checked={tags.includes(t)} onChange={(on) => setTags(on ? [...tags, t] : tags.filter((x) => x !== t))} disabled={busy}>
              {t}
            </Chip>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <label htmlFor={intoId} className="text-[15px] font-semibold">
          Anything else you like, or something that annoys you? <span className="font-normal text-muted">(optional)</span>
        </label>
        <input id={intoId} value={into} onChange={(e) => setInto(e.target.value)} placeholder="For example: I never remember when homework is due" className="min-h-11 rounded-[14px] border border-[#C9CDD4] bg-white px-3 text-[15px]" disabled={busy} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btn.primary} onClick={suggest} disabled={busy}>
          {busy ? "Thinking of ideas…" : ideas ? "Show me different ideas" : "Show me ideas"}
        </button>
        <button type="button" className={btn.link} onClick={onClose} disabled={busy}>
          Close
        </button>
        {busy && (
          <span className="flex items-center gap-2 text-[14px] text-muted" role="status">
            <span className="pulse h-2.5 w-2.5 rounded-full bg-[#2F4FD8]" aria-hidden="true" /> About 20 seconds.
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[15px] font-medium text-[#A11B12]">
          {error}
        </p>
      )}
      {ideas && ideas.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[15px] text-muted">Each one fits in one overnight run. Tap one to put it in the goal box.</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {ideas.map((i) => (
              <li key={i.title}>
                <button type="button" onClick={() => onPick(i.goal)} className="flex h-full min-h-11 w-full flex-col gap-1.5 rounded-[18px] border border-line bg-white p-4 text-left hover:border-ink">
                  <span className="text-[15px] font-semibold">{i.title}</span>
                  <span className="text-[14px] leading-snug text-muted">{i.why}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
