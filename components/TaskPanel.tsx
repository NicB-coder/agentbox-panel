"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { Freedom, JobKind, Model, NotifyOn } from "@/lib/types";
import { defaultMinutes } from "@/lib/job";
import { ErrorBox, Label, Switch, post } from "./bits";
import { CarefulPicker, Chip, FreedomPicker, MinutesSlider, ModelPicker, NotifyPicker, WhenPicker, type When } from "./controls";
import ProjectSelect from "./ProjectSelect";
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
export const TASK_FEATURES = { research: true, big: true, connectors: false };

type Brief = { name: string; text: string };

export default function TaskPanel({ projects, connectors = [], defaultProject }: { projects: string[]; connectors?: Connector[]; defaultProject?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const titleId = useId();
  const taskId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

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
  const [budget, setBudget] = useState(40);
  const [holdSmall, setHoldSmall] = useState(true);
  const [autoInstall, setAutoInstall] = useState(false);
  const [saveReport, setSaveReport] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefPick, setBriefPick] = useState<null | { file: string }[]>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      setTask(d.task ?? "");
      const k = f?.kind ?? (TASK_FEATURES.research ? d.kind ?? "build" : "build");
      setKind(k);
      setProject(f?.project ?? d.project ?? (projects.includes(defaultProject ?? "") ? defaultProject! : projects[0] ?? ""));
      setWhen({ scheduleKind: "manual", scheduleDays: [1, 2, 3, 4, 5], scheduleTime: "18:00" });
      setFreedom(f?.freedom ?? (k === "research" ? "look" : "auto"));
      setCareful(f?.careful ?? true);
      setModel(f?.model ?? (k === "research" ? "opus" : "sonnet"));
      setPicked(f?.connectors ?? []);
      setMinutesTouched(false);
      setMore(false);
      setAskEach(false);
      setBig(false);
      setBrief(null);
      setBriefPick(null);
      setSaveReport(false);
      setError("");
      ref.current?.showModal();
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

  async function readFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 400_000) return setError("That file is too big. Keep a brief under about 400 KB.");
    if (!/\.(md|markdown|txt)$/i.test(f.name)) return setError("Pick a Markdown (.md) or text (.txt) file.");
    setBrief({ name: f.name, text: await f.text() });
    setError("");
  }

  async function listBriefs() {
    setError("");
    try {
      const j = await post<{ files: { file: string }[] }>(`/api/projects/${encodeURIComponent(project)}/briefs`, {}, "GET");
      setBriefPick(j.files);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function pickBrief(file: string) {
    try {
      const j = await post<Brief>(`/api/projects/${encodeURIComponent(project)}/briefs?file=${encodeURIComponent(file)}`, {}, "GET");
      setBrief(j);
      setBriefPick(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function start(e?: React.FormEvent) {
    e?.preventDefault();
    if (task.trim().length < 3 && !brief) return setError(kind === "research" ? "Write your question first." : "Write what it should do first.");
    if (!project && kind !== "research") return setError("Pick a project first.");
    setBusy(true);
    setError("");
    try {
      const j = await post<{ agentId: number }>("/api/tasks", {
        kind, task, project, ...when, freedom, careful, maxMinutes: minutes, model, connectors: picked, notify, askEachStep: askEach,
        big, budgetPct: budget, holdSmall, autoInstall, saveReport, brief, followUpOf: follow?.id, ideaId,
      });
      ref.current?.close();
      window.dispatchEvent(new Event("agentbox:changed"));
      router.push(`/agents/${j.agentId}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const research = kind === "research";
  const scheduled = when.scheduleKind !== "manual" && !follow;
  const usable = connectors.filter((c) => c.connected);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="m-0 h-[100dvh] max-h-none w-full max-w-none p-0 backdrop:bg-black/30 sm:m-auto sm:h-auto sm:max-h-[calc(100dvh-48px)] sm:w-[min(640px,calc(100vw-32px))] sm:rounded-[24px]"
    >
      <form onSubmit={start} className="flex min-h-full flex-col">
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
              tip="Build something: it makes or changes things in a project and gives you a pull request. Research something: it looks things up across many sources and writes you a report with every source linked."
              value={kind}
              onChange={switchKind}
              options={[
                { value: "build", label: "Build something" },
                { value: "research", label: "Research something" },
              ]}
            />
          )}

          <div className="flex flex-col gap-2">
            <Label as="label" htmlFor={taskId} tip={follow ? "What it should do next on this same job. It already knows what it did before." : research ? "Your question in plain words. Say what you'll use the answer for, so it knows what matters." : "Say what you want, what a good result looks like, and anything it should never do."}>
              {follow ? "What should it do next?" : research ? "What do you want to know?" : "What should it do?"}
            </Label>
            <textarea
              id={taskId}
              value={task}
              onChange={(e) => setTask(e.target.value)}
              rows={6}
              placeholder={
                follow
                  ? "For example: The snake game is too fast on phones. Slow it down a bit."
                  : research
                    ? "For example: Which free website hosts are best for a student's portfolio, and what are the catches?"
                    : "For example: Make an arcade website with 4 small games. It should work on phones too."
              }
              className="rounded-[14px] border border-[#C9CDD4] p-4 text-[16px] leading-relaxed"
            />
            {TASK_FEATURES.big && !follow && (
              <div className="flex flex-wrap items-center gap-2">
                {brief ? (
                  <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-soft px-4 text-[14px] font-semibold">
                    <Icon name="book" color="#15171B" size={18} />
                    {brief.name} · {Math.max(1, Math.round(brief.text.length / 1000))} KB
                    <button type="button" className="ml-1 min-h-11 px-1 underline" onClick={() => setBrief(null)}>
                      Remove
                    </button>
                  </span>
                ) : (
                  <>
                    <button type="button" className={btn.link} onClick={() => fileRef.current?.click()}>
                      Attach a brief file
                    </button>
                    {project && (
                      <button type="button" className={btn.link} onClick={listBriefs}>
                        Pick one from the project
                      </button>
                    )}
                    <input ref={fileRef} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => readFile(e.target.files?.[0])} />
                  </>
                )}
              </div>
            )}
            {briefPick && (
              <div className="rounded-[14px] border border-line p-3">
                {briefPick.length === 0 ? (
                  <p className="text-[14px] text-muted">There are no .md or .txt files in {project}.</p>
                ) : (
                  <ul className="flex max-h-56 flex-col overflow-auto">
                    {briefPick.map((f) => (
                      <li key={f.file}>
                        <button type="button" className="flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-[14px] hover:bg-soft" onClick={() => pickBrief(f.file)}>
                          {f.file}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {follow ? (
            <p className="text-[15px] text-muted">
              Same project ({follow.project || "none"}), same branch and pull request if one is open.
            </p>
          ) : (
            <ProjectSelect
              value={project}
              onChange={setProject}
              projects={projects}
              optional={research}
              tip={research ? "Optional. Pick one if the question is about a project, or to save the report there." : "The code it works on. It always works in its own copy, never straight in main."}
            />
          )}

          {!follow && <WhenPicker value={when} onChange={setWhen} />}

          <FreedomPicker value={freedom} onChange={setFreedom} />
          <CarefulPicker value={careful} onChange={setCareful} />

          <div>
            <button type="button" className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold" aria-expanded={more} onClick={() => setMore(!more)}>
              <span aria-hidden="true" className={`inline-block transition-transform ${more ? "rotate-90" : ""}`}>
                ›
              </span>
              More options
            </button>
            {more && (
              <div className="mt-4 flex flex-col gap-6 rounded-[18px] bg-soft p-4 sm:p-5">
                {!big && <MinutesSlider value={minutes} onChange={(v) => (setMinutes(v), setMinutesTouched(true))} />}
                <ModelPicker value={model} onChange={setModel} />
                {TASK_FEATURES.connectors && (
                  <fieldset>
                    <Label as="legend" tip="Apps it may use for this task, like your email or calendar. Anything that sends, deletes or books something still asks you first.">
                      Connectors
                    </Label>
                    {usable.length === 0 ? (
                      <p className="text-[14px] text-muted">
                        None connected yet.{" "}
                        <a href="/connectors" className="font-semibold underline">
                          Connect one
                        </a>
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {usable.map((c) => (
                          <Chip key={c.id} checked={picked.includes(c.id)} onChange={(v) => setPicked(v ? [...picked, c.id] : picked.filter((x) => x !== c.id))}>
                            {c.name}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </fieldset>
                )}
                <NotifyPicker value={notify} onChange={setNotify} />
                {freedom !== "look" && <Switch label="Ask me each step" tip="It stops before every command or change and waits for your Allow or Deny. Slow, but you see everything." checked={askEach} onChange={setAskEach} />}
                {TASK_FEATURES.big && !follow && !research && (
                  <Switch
                    label="Big job"
                    tip="For long jobs that take hours. No time limit: it works milestone by milestone, saves its work after each one, waits out usage limits, and keeps going after restarts. It stops if it uses more than its usage budget."
                    checked={big}
                    onChange={setBig}
                  />
                )}
                {big && (
                  <div className="flex flex-col gap-5 border-l-2 border-line pl-4">
                    <MinutesSlider
                      label="Usage budget"
                      tip="The most of your weekly Claude usage it may use, in points of the weekly meter. You can raise it while it runs."
                      value={budget}
                      onChange={setBudget}
                      min={5}
                      max={100}
                    />
                    <Switch label="Hold small runs" tip="While it works, small scheduled runs wait, so they don't eat its usage. They start again when it's done." checked={holdSmall} onChange={setHoldSmall} />
                    {project === "agentbox-panel" && (
                      <Switch label="Install when finished" tip="When it's done and reviewed, merge it and update this panel to the new version. If the new version doesn't start, it goes back to the old one by itself." checked={autoInstall} onChange={setAutoInstall} />
                    )}
                  </div>
                )}
                {research && project && <Switch label="Save the report in the project" tip="Also adds the report to the project's reports folder as a pull request." checked={saveReport} onChange={setSaveReport} />}
              </div>
            )}
          </div>
          {error && <ErrorBox compact message={error} onRetry={() => start()} where="the Start a task panel" />}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-line bg-white px-5 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:px-8 sm:py-4">
          <button type="button" className={btn.secondary} onClick={() => ref.current?.close()}>
            Cancel
          </button>
          <button type="submit" className={btn.primary} disabled={busy}>
            {busy ? "Starting…" : scheduled ? "Save" : "Start"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
