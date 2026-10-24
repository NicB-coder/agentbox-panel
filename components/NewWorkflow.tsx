"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { BriefRef, WfLimits, WfStep } from "@/lib/types";
import { STEP_INFO, TEMPLATES, defaultWorkflow, nameFromGoal, stepIconOf, stepTitle, templateWorkflow, type AgentRef, type TemplateKey } from "@/lib/wf";
import { BackLink, ErrorBox, InfoTip, Label, post } from "./bits";
import BriefPicker from "./BriefPicker";
import ProjectSelect from "./ProjectSelect";
import { Icon, btn } from "./ui";

// The start screen asks one thing: what Nic wants to make. The steps come from a sensible default
// and only change if he opens "Change the steps".
type Steps = { from: "default" } | { from: "template"; key: TemplateKey } | { from: "words"; name: string; steps: WfStep[]; limits: WfLimits };

export default function NewWorkflow({ projects, agents }: { projects: string[]; agents: AgentRef[] }) {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [project, setProject] = useState(projects[0] ?? "");
  const [brief, setBrief] = useState<BriefRef | null>(null);
  const [choice, setChoice] = useState<Steps>({ from: "default" });
  const [changing, setChanging] = useState(false);
  const [words, setWords] = useState("");
  const [autoGoal, setAutoGoal] = useState(""); // a goal a template filled in, not typed by Nic
  const [busy, setBusy] = useState<"" | "make" | "words">("");
  const [error, setError] = useState<{ msg: string; retry?: () => void } | null>(null);

  // Made once per choice (step ids are random), not on every key press.
  const plan = useMemo(() => {
    if (choice.from === "template") return templateWorkflow(choice.key, agents, "");
    if (choice.from === "words") return { name: choice.name, project: "", steps: choice.steps, limits: choice.limits };
    return defaultWorkflow("", "");
  }, [choice, agents]);
  const planName = choice.from === "template" ? setName(choice.key) : choice.from === "words" ? "Your own steps" : DEFAULT_NAME;

  async function make(e?: React.FormEvent) {
    e?.preventDefault();
    // A brief on its own is enough: the goal then points at it.
    const g = goal.trim() || (plan.steps[0]?.task ?? "").trim() || (brief ? `Make what the attached brief (${brief.name}) describes.` : "");
    if (!g) {
      document.getElementById("nw-goal")?.focus();
      return setError({ msg: "Write what you want to make first. One sentence is enough." });
    }
    setBusy("make");
    setError(null);
    try {
      const steps = plan.steps.map((s, i) => (i === 0 ? { ...s, task: g, ...(brief ? { brief } : {}) } : s));
      const briefWords = brief ? brief.name.replace(/\.(md|markdown|txt)$/i, "").replace(/[-_]+/g, " ") : "";
      const fromBrief = briefWords && !/^(claude|brief|readme|agents|spec|plan)$/i.test(briefWords) && !goal.trim() && !(plan.steps[0]?.task ?? "").trim() ? nameFromGoal(briefWords) : "";
      const name = fromBrief || (!goal.trim() || (autoGoal && goal === autoGoal) ? plan.name : nameFromGoal(g));
      const w = await post<{ id: number }>("/api/workflows", { name, project, steps, limits: plan.limits });
      router.push(`/workflows/${w.id}?new=1`);
    } catch (err) {
      setError({ msg: (err as Error).message, retry: () => make() });
      setBusy("");
    }
  }

  async function draftSteps() {
    if (words.trim().length < 10) return setError({ msg: "Say how it should go in a sentence or two, for example: research first, then build, then ask me before shipping." });
    setBusy("words");
    setError(null);
    try {
      const d = await post<{ name: string; steps: WfStep[]; limits: WfLimits }>("/api/workflows/draft", { text: words, goal, project, preview: true });
      pickSteps({ from: "words", ...d });
    } catch (err) {
      setError({ msg: (err as Error).message, retry: draftSteps });
    } finally {
      setBusy("");
    }
  }

  // Templates that come with their own job (e.g. the nightly site check) fill an empty goal box,
  // and take that goal back out if Nic picks other steps without changing it.
  function pickSteps(next: Steps) {
    setChoice(next);
    setChanging(false);
    const task = next.from === "template" ? (templateWorkflow(next.key, agents, "").steps[0]?.task ?? "") : "";
    const untouched = !goal.trim() || (autoGoal && goal === autoGoal);
    if (untouched) {
      setGoal(task);
      setAutoGoal(task);
    }
  }

  return (
    <div className="pt-8 sm:pt-10">
      <BackLink href="/workflows">All workflows</BackLink>
      <h1 className="mt-4 text-[30px] font-bold leading-tight tracking-tight sm:text-[36px]">New workflow</h1>
      <p className="mt-2 text-[17px] text-muted">Say what you want. You'll see every step before anything runs.</p>

      <form onSubmit={make} className="panel mt-8 flex max-w-[860px] flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <Label as="label" htmlFor="nw-goal" tip="This is the goal. You only type it once: every run works on it, and you can change it later on the workflow's page.">
            What do you want to make?
          </Label>
          <textarea
            id="nw-goal"
            value={goal}
            onChange={(e) => {
              setGoal(e.target.value);
              if (error && !error.retry) setError(null);
            }}
            rows={4}
            placeholder="For example: An arcade website with 4 small games that work on phones too."
            className="rounded-[14px] border border-[#C9CDD4] p-4 text-[16px] leading-relaxed"
            disabled={busy === "make"}
          />
          <p className="text-[14px] text-muted">Say what it is, who it's for, and anything it must have.</p>
        </div>

        <div className="max-w-[420px]">
          <ProjectSelect value={project} onChange={setProject} projects={projects} tip="The code this workflow works on. All its steps share one copy of it." />
        </div>

        <BriefPicker project={project} value={brief} onChange={setBrief} disabled={busy === "make"} />

        <div className="flex flex-col gap-3" aria-labelledby="nw-steps-h">
          <p id="nw-steps-h" className="flex items-center text-[15px] font-semibold">
            The steps: {planName}
            <InfoTip text="What happens, in order, each time it runs. Build in Careful mode builds it, checks its own work and polishes it. Ship always asks you first." label="The steps" />
          </p>
          <StepRow steps={plan.steps} agents={agents} />
          {!changing && (
            <button type="button" className={btn.link + " self-start"} onClick={() => setChanging(true)} aria-expanded={false} disabled={!!busy}>
              Change the steps
            </button>
          )}
        </div>

        {changing && (
          <ChangeSteps
            words={words}
            setWords={setWords}
            busy={busy === "words"}
            disabled={!!busy}
            onDraft={draftSteps}
            onTemplate={(key) => pickSteps({ from: "template", key })}
            onDefault={() => pickSteps({ from: "default" })}
            onClose={() => setChanging(false)}
            agents={agents}
            current={choice}
          />
        )}

        {error && <ErrorBox message={error.msg} onRetry={error.retry} where="New workflow" />}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={btn.primary} disabled={!!busy}>
            {busy === "make" ? "Setting it up…" : "Next"}
          </button>
          <span className="text-[14px] text-muted">Nothing runs yet. Next shows you the workflow so you can check it.</span>
        </div>
      </form>
    </div>
  );
}

const DEFAULT_NAME = "Build carefully → Review → Ship (recommended)";
// The ready-made sets, named by what they do so no two look alike.
const setName = (key: TemplateKey) => (key === "build-review-ship" ? "Research → Build → Review → Ship" : TEMPLATES.find((t) => t.key === key)!.name);

function StepRow({ steps, agents }: { steps: WfStep[]; agents: AgentRef[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2" aria-label="Steps, in order">
      {steps.map((s, i) => {
        const a = s.type === "agent" && s.agentId != null ? agents.find((x) => x.id === s.agentId) : null;
        const color = a?.color ?? STEP_INFO[s.type].color;
        const title = s.type === "start" ? "Start" : stepTitle(s, agents);
        const extra = s.type === "agent" && s.careful ? " (Careful)" : s.type === "ship" && s.shipMode !== "auto" ? " (asks you first)" : "";
        return (
          <li key={s.id} className="flex items-center gap-1.5">
            {i > 0 && (
              <span className="text-[#9AA0A8]" aria-hidden="true">
                →
              </span>
            )}
            <span className="flex items-center gap-1.5 rounded-full bg-soft py-1 pl-1 pr-3 text-[14px] font-medium">
              <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: `${color}1A` }} aria-hidden="true">
                <Icon name={a?.icon ?? stepIconOf(s)} color={color} size={14} />
              </span>
              {title}
              {extra}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ChangeSteps(props: {
  words: string;
  setWords: (s: string) => void;
  busy: boolean;
  disabled: boolean;
  onDraft: () => void;
  onTemplate: (k: TemplateKey) => void;
  onDefault: () => void;
  onClose: () => void;
  agents: AgentRef[];
  current: Steps;
}) {
  const { words, setWords, busy, disabled, onDraft, onTemplate, onDefault, onClose, agents, current } = props;
  return (
    <section className="flex flex-col gap-5 rounded-[24px] border border-line bg-[#FAFAFB] p-5 sm:p-6" aria-labelledby="nw-change-h">
      <h2 id="nw-change-h" className="text-[18px] font-bold">
        Change the steps
      </h2>

      <div className="flex flex-col gap-2">
        <Label as="label" htmlFor="nw-words" tip="Claude turns this into steps. It only changes how the work happens, not what gets made: that's the goal box above.">
          Change the steps in your own words
        </Label>
        <textarea
          id="nw-words"
          value={words}
          onChange={(e) => setWords(e.target.value)}
          rows={3}
          placeholder="For example: Research first, then build, then ask me before shipping."
          className="rounded-[14px] border border-[#C9CDD4] bg-white p-4 text-[16px] leading-relaxed"
          disabled={busy}
        />
        <p className="text-[14px] text-muted">Only say how it should go, in order. What to make goes in the box above.</p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={btn.secondary} onClick={onDraft} disabled={disabled}>
            {busy ? "Drafting the steps…" : "Make these steps"}
          </button>
          {busy && (
            <span className="flex items-center gap-2 text-[14px] text-muted" role="status">
              <span className="pulse h-2.5 w-2.5 rounded-full bg-[#2F4FD8]" aria-hidden="true" /> Claude is reading it. This takes about half a minute.
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-[15px] font-semibold">Or pick a ready-made set</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <PlanButton name={DEFAULT_NAME} blurb="Builds it carefully, has it reviewed, then asks you before shipping. Good for most things." on={current.from === "default"} onClick={onDefault} disabled={disabled} />
          </li>
          {TEMPLATES.map((t) => (
            <li key={t.key}>
              <PlanButton
                name={setName(t.key)}
                blurb={t.blurb}
                on={current.from === "template" && current.key === t.key}
                onClick={() => onTemplate(t.key)}
                disabled={disabled}
              />
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className={btn.link + " self-start"} onClick={onClose} disabled={busy}>
        Keep the steps as they are
      </button>
    </section>
  );
}

function PlanButton({ name, blurb, on, onClick, disabled }: { name: string; blurb: string; on: boolean; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`flex h-full min-h-11 w-full flex-col gap-1.5 rounded-[18px] border bg-white p-4 text-left hover:border-ink disabled:opacity-60 ${on ? "border-ink ring-1 ring-ink" : "border-line"}`}
    >
      <span className="text-[15px] font-semibold">
        {name}
        {on ? " ✓" : ""}
      </span>
      <span className="text-[14px] leading-snug text-muted">{blurb}</span>
    </button>
  );
}
