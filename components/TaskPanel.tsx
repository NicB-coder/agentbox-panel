"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { BriefRef, Freedom, JobKind, Model, NotifyOn } from "@/lib/types";
import { BIG_TIME_NOTE, BIG_USAGE_TIP, DEFAULT_JOB, FREEDOM_WORDS, defaultMinutes } from "@/lib/job";
import { scheduleWords } from "@/lib/words";
import { useHelperContext } from "./helper/helperStore";
import { ErrorBox, Label, Switch, post } from "./bits";
import { CarefulPicker, Chip, FreedomPicker, MinutesSlider, ModelPicker, PercentSlider, NotifyPicker, WhenPicker, type When } from "./controls";
import BriefPicker, { MissingFileBox, missingOf, type MissingInfo } from "./BriefPicker";
import { CoachBox, IdeaHelp } from "./Coach";
import type { SuggestionKey } from "@/lib/coach";
import ProjectSelect, { defaultProjectOf, rememberProject } from "./ProjectSelect";
import Segmented from "./Segmented";
import { Icon, btn } from "./ui";

// The one "Start a task" panel. New task, follow-ups, Inbox ideas and the Helper all open it.

export type Connector = { id: string; name: string; connected: boolean; risky: boolean };

export type TaskPanelOpen = {
  task?: string;
  kind?: JobKind;
  project?: string;
  ideaId?: number;
  followUpId?: number; // fetches the job, then opens as a follow-up
  coach?: boolean; // open with the prompt coach already checking the task (the Helper's "Improve it")
  ideas?: boolean; // open with "Help me think of ideas" showing
  simple?: boolean; // first time (from the welcome tour): just the goal and the project, the rest folded away
  followUp?: { id: number; name: string; project: string; kind: JobKind; freedom: Freedom; careful: boolean; model: Model; connectors: string[] };
};

export function openTaskPanel(detail: TaskPanelOpen = {}) {
  window.dispatchEvent(new CustomEvent("agentbox:task-panel", { detail }));
}

// Kept for older callers (the Helper's "Set up this task", Inbox ideas).
export function openNewTask(detail: { task?: string; ideaId?: number; agentId?: number } = {}) {
  openTaskPanel({ task: detail.task, ideaId: detail.ideaId, followUpId: detail.agentId });
}

type AgentLite = { id: number; name: string; project: string; kind: string; archived: boolean; mode: string; allowed: string; model: Model; job: { kind: JobKind; careful: boolean; connectors: string[] } };

// The follow-up details of a job, or null if it isn't one Nic can follow up on.
async function followUpOf(id: number): Promise<TaskPanelOpen["followUp"] | null> {
  try {
    const r = await fetch(`/api/agents/${id}`, { cache: "no-store" });
    if (!r.ok) return null;
    const a = (await r.json()) as AgentLite;
    if (a.kind !== "claude" || a.archived) return null;
    const freedom: Freedom = a.mode === "look" || a.allowed === "look" ? "look" : a.mode === "plan" ? "check" : "auto";
    return { id: a.id, name: a.name, project: a.project, kind: a.job.kind, freedom, careful: a.job.careful, model: a.model, connectors: a.job.connectors };
  } catch {
    return null;
  }
}

// Features that switch on as they're finished (never show a half-built one).
export const TASK_FEATURES = { research: true, big: true, connectors: true };


export default function TaskPanel({ projects, connectors = [], defaultProject, usagePct = null }: { projects: string[]; connectors?: Connector[]; defaultProject?: string; usagePct?: number | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const titleId = useId();
  const taskId = useId();

  const [follow, setFollow] = useState<TaskPanelOpen["followUp"] | null>(null);
  const [ideaId, setIdeaId] = useState<number | null>(null);
  const [kind, setKind] = useState<JobKind>("build");
  const [task, setTask] = useState("");
  const [project, setProject] = useState(defaultProject ?? projects[0] ?? "");
  const [when, setWhen] = useState<When>({ scheduleKind: "manual", scheduleDays: [1, 2, 3, 4, 5], scheduleTime: "18:00" });
  const [freedom, setFreedom] = useState<Freedom>("auto");
  const [careful, setCareful] = useState(true);
  const [more, setMore] = useState(false);
  const [minutes, setMinutes] = useState(60);
  const [minutesTouched, setMinutesTouched] = useState(false);
  const [model, setModel] = useState<Model>("sonnet");
  const [picked, setPicked] = useState<string[]>([]);
  const [notify, setNotify] = useState<NotifyOn[]>(["finished", "needs_ok", "problems"]);
  const [askEach, setAskEach] = useState(false);
  const [big, setBig] = useState(false);
  const [budget, setBudget] = useState(DEFAULT_JOB.budgetPct);
  const [holdSmall, setHoldSmall] = useState(true);
  const [autoInstall, setAutoInstall] = useState(false);
  const [saveReport, setSaveReport] = useState(false);
  const [brief, setBrief] = useState<BriefRef | null>(null);
  const [missing, setMissing] = useState<MissingInfo | null>(null);
  const openBrief = useRef<(() => void) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [coach, setCoach] = useState(false);
  const [coachKey, setCoachKey] = useState(0); // a fresh coach each time it opens
  const [coached, setCoached] = useState(false);
  const [ideas, setIdeas] = useState(false);
  const [live, setLive] = useState<Connector[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  // What was typed when the panel closed without starting (Escape, Cancel, a tap outside): it comes back next time.
  const draft = useRef("");
  const started = useRef(false);
  const [restored, setRestored] = useState(false);
  const [simple, setSimple] = useState(false);
  // While it's open, the Helper sees exactly what's in it and can fill the goal box (on Nic's click).
  useHelperContext(
    isOpen
      ? {
          panels: [
            `${follow ? `Follow-up panel for ${follow.name}` : "Start a task panel"} · What kind: ${kind === "research" ? "Research something" : "Build something"} · goal box says: "${task.slice(0, 1000)}" · Project: ${project || "none"} · When: ${when.scheduleKind === "manual" ? "Now" : scheduleWords(when.scheduleKind, when.scheduleDays, when.scheduleTime)} · Freedom: ${FREEDOM_WORDS[freedom].label} · ${careful ? "Careful" : "Quick"} · Model: ${model === "opus" ? "Smartest" : "Fast"} · Time limit: ${big ? "doesn't apply (Big job)" : `${minutes} min`}${big ? ` · Big job on, usage budget ${budget}%` : ""}${askEach ? " · Ask me each step on" : ""} · Brief: ${brief ? brief.name : "none"}${coach ? " · the prompt coach is open" : ""}${ideas ? " · Help me think of ideas is open" : ""}${more ? " · More options is unfolded" : ""}`,
          ],
          fill: `the goal box of the ${follow ? "Follow-up" : "Start a task"} panel`,
        }
      : null,
    (t) => {
      setTask(t);
      setCoached(true); // the Helper already improved it with him; Start goes straight on
    },
  );
  useEffect(() => {
    // The newest list of connected apps, when More options opens.
    if (!more || live) return;
    fetch("/api/connectors")
      .then((r) => r.json())
      .then((list: { id: string; name: string; state: string }[]) => setLive(list.map((c) => ({ id: c.id, name: c.name, connected: c.state === "connected", risky: false }))))
      .catch(() => {});
  }, [more, live]);

  // Sensible time limit for the kind of work, until Nic moves the slider himself.
  useEffect(() => {
    if (!minutesTouched) setMinutes(defaultMinutes(kind, careful, freedom));
  }, [kind, careful, freedom, minutesTouched]);

  useEffect(() => {
    const open = async (e: Event) => {
      const d = (e as CustomEvent<TaskPanelOpen>).detail ?? {};
      const f = d.followUp ?? (d.followUpId ? await followUpOf(d.followUpId) : null) ?? null;
      setFollow(f);
      setIdeaId(d.ideaId ?? null);
      const keep = !d.task && !f && !d.ideaId && !d.coach && !d.ideas ? draft.current : "";
      setTask(d.task ?? keep);
      setRestored(!!keep);
      const k = f?.kind ?? (TASK_FEATURES.research ? d.kind ?? "build" : "build");
      setKind(k);
      setProject(f?.project ?? d.project ?? (projects.includes(defaultProject ?? "") ? defaultProject! : defaultProjectOf(projects)));
      setWhen({ scheduleKind: "manual", scheduleDays: [1, 2, 3, 4, 5], scheduleTime: "18:00" });
      setFreedom(f?.freedom ?? (k === "research" ? "look" : "auto"));
      setCareful(f?.careful ?? true);
      setModel(f?.model ?? (k === "research" ? "opus" : "sonnet"));
      setPicked(f?.connectors ?? []);
      setMinutesTouched(false);
      setMore(false);
      setAskEach(false);
      setBig(false);
      setBudget(DEFAULT_JOB.budgetPct);
      setBrief(null);
      setMissing(null);
      setSaveReport(false);
      setError("");
      // Follow-ups and ideas Nic already picked don't need coaching.
      setCoached(!!f || !!d.ideaId);
      setCoach(!!d.coach && !f && !!(d.task ?? "").trim());
      setCoachKey((k) => k + 1);
      setIdeas(!!d.ideas && !f);
      setSimple(!!d.simple && !f);
      ref.current?.showModal();
      setIsOpen(true);
      setTimeout(() => document.getElementById(taskId)?.focus(), 30);
    };
    window.addEventListener("agentbox:task-panel", open);
    return () => window.removeEventListener("agentbox:task-panel", open);
  }, [projects, defaultProject, taskId]);

  function switchKind(k: JobKind) {
    setKind(k);
    setFreedom(k === "research" ? "look" : "auto");
    setModel(k === "research" ? "opus" : "sonnet");
    if (k === "research") setBig(false);
  }

  // Start: the prompt coach checks the task first (once), then it starts.
  function next(e?: React.FormEvent) {
    e?.preventDefault();
    if (task.trim().length < 3 && !brief) return setError(kind === "research" ? "Write your question first." : "Write what it should do first.");
    if (!project && kind !== "research") return setError("Pick a project first.");
    if (coached) return start();
    setError("");
    setIdeas(false);
    setCoachKey((k) => k + 1);
    setCoach(true);
  }

  function coachDone(t: string) {
    setCoach(false);
    setCoached(true);
    if (t !== task) setTask(t);
    start(t);
  }

  function applyTweak(k: SuggestionKey) {
    if (k === "big_job") (setBig(true), setMore(true));
    if (k === "research_kind") switchKind("research");
    if (k === "smartest") setModel("opus");
    if (k === "look_only") setFreedom("look");
    if (k === "careful") setCareful(true);
  }
  const on: SuggestionKey[] = [
    ...(big ? (["big_job"] as const) : []),
    ...(kind === "research" ? (["research_kind"] as const) : []),
    ...(model === "opus" ? (["smartest"] as const) : []),
    ...(freedom === "look" ? (["look_only"] as const) : []),
    ...(careful ? (["careful"] as const) : []),
  ];

  async function start(withTask?: string) {
    const task_ = withTask ?? task;
    setBusy(true);
    setError("");
    setMissing(null);
    try {
      const j = await post<{ agentId: number }>("/api/tasks", {
        kind, task: task_, project, ...when, freedom, careful, maxMinutes: minutes, model, connectors: picked, notify, askEachStep: askEach,
        big, budgetPct: budget, holdSmall, autoInstall, saveReport, brief, followUpOf: follow?.id, ideaId,
      });
      rememberProject(project);
      started.current = true;
      ref.current?.close();
      window.dispatchEvent(new Event("agentbox:changed"));
      router.push(`/agents/${j.agentId}`);
      router.refresh();
    } catch (err) {
      const m = missingOf(err);
      if (m) setMissing(m);
      else setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const research = kind === "research";
  const scheduled = when.scheduleKind !== "manual" && !follow;
  const usable = (live ?? connectors).filter((c) => c.connected);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => {
        setIsOpen(false);
        if (!follow) draft.current = !started.current && task.trim() ? task : "";
        started.current = false;
      }}
      className="m-0 h-[100dvh] max-h-none w-full max-w-none p-0 backdrop:bg-black/30 sm:m-auto sm:h-auto sm:max-h-[calc(100dvh-48px)] sm:w-[min(640px,calc(100vw-32px))] sm:rounded-[24px]"
    >
      <form onSubmit={next} className="flex min-h-full flex-col">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-white px-5 py-3 sm:px-8 sm:py-4">
          <h2 id={titleId} className="min-w-0 truncate text-[20px] font-bold sm:text-[22px]">
            {follow ? `Follow-up: ${follow.name}` : "Start a task"}
          </h2>
          <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-soft" aria-label="Close" onClick={() => ref.current?.close()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-7 px-5 py-6 sm:px-8">
          {TASK_FEATURES.research && !follow && (
            <Segmented<JobKind>
              legend="What kind?"
              tip="Build something: it makes or changes things in a project, and you look at the change before it goes in. Research something: it looks things up across many sources and writes you a report with every source linked."
              value={kind}
              onChange={switchKind}
              options={[
                { value: "build", label: "Build something" },
                { value: "research", label: "Research something" },
              ]}
            />
          )}

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-x-4">
            <Label as="label" htmlFor={taskId} tip={follow ? "What it should do next on this same job. It already knows what it did before." : research ? "Your question in plain words. Say what you'll use the answer for, so it knows what matters." : "Say what you want, what a good result looks like, and anything it should never do."}>
              {follow ? (research ? "What else do you want to know?" : "What should it do next?") : research ? "What do you want to know?" : "What should it do?"}
            </Label>
              {!follow && !ideas && (
                <button type="button" className={btn.link + " !text-[14px]"} onClick={() => (setIdeas(true), setCoach(false))}>
                  Help me think of ideas
                </button>
              )}
            </div>
            {ideas && (
              <IdeaHelp
                where={research ? "research" : "build"}
                onClose={() => setIdeas(false)}
                onPick={(t) => {
                  setTask(t);
                  setIdeas(false);
                  setTimeout(() => document.getElementById(taskId)?.focus(), 30);
                }}
              />
            )}
            <textarea
              id={taskId}
              value={task}
              onChange={(e) => {
                setTask(e.target.value);
                if (coach) setCoach(false);
              }}
              rows={6}
              placeholder={
                follow
                  ? follow.kind === "research"
                    ? "For example: Which of these matters most on older iPhones?"
                    : "For example: The snake game is too fast on phones. Slow it down a bit."
                  : research
                    ? "For example: Which free website hosts are best for a student's portfolio, and what are the catches?"
                    : "For example: Make an arcade website with 4 small games. It should work on phones too."
              }
              className="rounded-[14px] border border-[#C9CDD4] p-4 text-[16px] leading-relaxed"
            />
            {restored && task && (
              <p className="text-[14px] text-muted">
                This is what you typed last time.{" "}
                <button type="button" className="font-semibold underline" onClick={() => (setTask(""), setRestored(false), (draft.current = ""))}>
                  Clear it
                </button>
              </p>
            )}
          </div>

          {/* The quick questions show right under the goal, where Nic is looking. */}
          {coach && (
            <CoachBox
              key={coachKey}
              where={research ? "research" : "build"}
              goal={task}
              brief={brief}
              current={on}
              onApply={applyTweak}
              onDone={coachDone}
              onEdit={(t) => {
                setTask(t);
                setCoach(false);
                setCoached(true);
                setTimeout(() => document.getElementById(taskId)?.focus(), 30);
              }}
              onClose={() => {
                setCoach(false);
                setTimeout(() => document.getElementById(taskId)?.focus(), 30);
              }}
              doneLabel={scheduled ? "Save" : "Start"}
            />
          )}
          {follow ? (
            <p className="text-[15px] text-muted">
              {follow.kind === "research" ? "It builds on the earlier report." : `Same project (${follow.project || "none"}). It carries on with the same change.`}
            </p>
          ) : (
            <ProjectSelect
              value={project}
              onChange={setProject}
              projects={projects}
              optional={research}
              tip={research ? "Optional. Pick one if the question is about a project, or to save the report there." : "Which app, game or site it works on. It works on its own copy, so your real project only changes when you say so."}
            />
          )}

          {!follow && (
            <BriefPicker
              project={project}
              value={brief}
              onChange={(b) => {
                setBrief(b);
                setMissing(null);
              }}
              openRef={openBrief}
              tip="Optional. A text file with longer instructions (for example a list of what the game must have). The agent reads it before it starts."
            />
          )}

          {simple && !more && (
            <p className="text-[15px] text-muted">The other choices are set to good defaults: it starts now, works on its own and checks its work carefully. You can change them under More options.</p>
          )}
          {!follow && !(simple && !more) && <WhenPicker value={when} onChange={setWhen} />}

          {!(simple && !more) && (research ? (
            <p className="flex items-center text-[15px] text-muted">
              Research only reads and reports. It never changes anything.
            </p>
          ) : (
            <FreedomPicker value={freedom} onChange={setFreedom} />
          ))}
          {!(simple && !more) && <CarefulPicker value={careful} onChange={setCareful} />}

          <div>
            <button type="button" className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold" aria-expanded={more} onClick={() => setMore(!more)}>
              <span aria-hidden="true" className={`inline-block transition-transform ${more ? "rotate-90" : ""}`}>
                ›
              </span>
              More options
            </button>
            {more && (
              <div className="mt-4 flex flex-col gap-6 rounded-[18px] bg-soft p-4 sm:p-5">
                <MinutesSlider value={minutes} onChange={(v) => (setMinutes(v), setMinutesTouched(true))} off={big ? BIG_TIME_NOTE : undefined} />
                <ModelPicker value={model} onChange={setModel} />
                {TASK_FEATURES.connectors && (
                  <fieldset>
                    <Label as="legend" tip="Apps it may use for this task, like your email or calendar. Anything that sends, deletes or books something still asks you first.">
                      Connectors
                    </Label>
                    {usable.filter((c) => c.id !== "github").length === 0 ? (
                      <p className="text-[14px] text-muted">
                        None connected yet.{" "}
                        <a href="/connectors" className="inline-flex min-h-11 items-center font-semibold underline">
                          Connect one
                        </a>
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {usable.filter((c) => c.id !== "github").map((c) => (
                          <Chip key={c.id} checked={picked.includes(c.id)} onChange={(v) => setPicked(v ? [...picked, c.id] : picked.filter((x) => x !== c.id))}>
                            {c.name}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </fieldset>
                )}
                <NotifyPicker value={notify} onChange={setNotify} />
                {freedom !== "look" && <Switch label="Ask me each step" tip="Even stricter than Check with me first: it stops before every single change and waits for you to press Allow or Deny. Slow, but you see everything." checked={askEach} onChange={setAskEach} />}
                {TASK_FEATURES.big && !follow && !research && (
                  <Switch
                    label="Big job"
                    tip="Only for jobs that take hours; most tasks leave this off. It works in stages, saves its work after each one, and waits out usage limits. Instead of a time limit it may use up to about 75% of your weekly usage (you can change that)."
                    checked={big}
                    onChange={setBig}
                  />
                )}
                {big && (
                  <div className="flex flex-col gap-5 border-l-2 border-line pl-4">
                    <PercentSlider label="Most usage per run" tip={BIG_USAGE_TIP} value={budget} onChange={setBudget} />
                    <Switch label="Hold small runs" tip="While it works, small scheduled runs wait, so they don't eat its usage. They start again when it's done." checked={holdSmall} onChange={setHoldSmall} />
                    {project === "agentbox-panel" && (
                      <Switch label="Install when finished" tip="When it's done and reviewed, merge it and update this panel to the new version. If the new version doesn't start, it goes back to the old one by itself." checked={autoInstall} onChange={setAutoInstall} />
                    )}
                  </div>
                )}
                {research && project && <Switch label="Save the report in the project" tip="Also adds the report to the project's reports folder (you OK it in the Inbox first)." checked={saveReport} onChange={setSaveReport} />}
              </div>
            )}
          </div>
          {missing && <MissingFileBox missing={missing} onAttach={() => openBrief.current?.()} />}
          {error && <ErrorBox compact message={error} onRetry={() => start()} where="the Start a task panel" />}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-line bg-white px-5 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:px-8 sm:py-4">
          {usagePct !== null && (
            <p className={`mr-auto text-[13px] leading-tight ${usagePct >= 80 ? "font-semibold text-[#8A4600]" : "text-muted"}`}>
              {usagePct >= 80 ? `Usage is high (${usagePct}% of this session). It may wait for the reset.` : `${usagePct}% of this session's usage used so far.`}
            </p>
          )}
          <button type="button" className={btn.secondary} onClick={() => ref.current?.close()}>
            Cancel
          </button>
          {!coach ? (
            <button type="submit" className={btn.primary} disabled={busy}>
              {busy ? "Starting…" : scheduled ? "Save" : "Start"}
            </button>
          ) : null}
        </div>
      </form>
    </dialog>
  );
}
