"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { StepType, WfLimits, WfStep, WorkflowInput, WorkflowRun, WorkflowVersion } from "@/lib/types";
import { ADDABLE, STEP_INFO, flowSentence, hasFailPath, newStep, stepTitle, workflowProblems } from "@/lib/wf";
import type { WorkflowPageState } from "@/lib/workflowViews";
import { ago, clockOf, duration } from "@/lib/words";
import { BackLink, Confirm, ErrorBox, InfoTip, Label, Switch, post } from "../bits";
import { refreshHeader } from "../Header";
import ProjectSelect from "../ProjectSelect";
import { Icon, StatusPill, btn, field } from "../ui";
import { usePoll } from "../usePoll";
import Canvas, { type LiveInfo } from "./Canvas";
import RunStepPanel from "./RunStepPanel";
import StepPanel from "./StepPanel";

const asInput = (w: WorkflowPageState["workflow"]): WorkflowInput => ({ name: w.name, project: w.project, steps: w.steps, limits: w.limits });

// "Needs work" can only go back to an earlier step; fix anything a move broke.
function normalize(steps: WfStep[]): WfStep[] {
  return steps.map((s, i) => {
    if (!hasFailPath(s) || !s.onFail || s.onFail === "stop") return s;
    const t = steps.findIndex((x) => x.id === s.onFail);
    return t >= 1 && t < i ? s : { ...s, onFail: "stop" };
  });
}

export default function WorkflowEditor({ initial, id }: { initial: WorkflowPageState; id: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const runParam = params.get("run");
  const drafted = params.get("drafted") === "1";
  const { data, refresh } = usePoll<WorkflowPageState>(`/api/workflows/${id}/state${runParam !== null ? `?run=${runParam}` : ""}`, initial);
  const agents = data.agents;

  // ---------- the editable copy, with undo ----------
  const [def, setDef] = useState<WorkflowInput>(() => asInput(initial.workflow));
  const [saved, setSaved] = useState(() => JSON.stringify(asInput(initial.workflow)));
  const past = useRef<WorkflowInput[]>([]);
  const future = useRef<WorkflowInput[]>([]);
  const lastKey = useRef<{ key: string; at: number } | null>(null);
  const [, force] = useState(0);
  const dirty = JSON.stringify(def) !== saved;

  const update = useCallback((next: WorkflowInput, key?: string) => {
    setDef((cur) => {
      const now = Date.now();
      const coalesce = key && lastKey.current?.key === key && now - lastKey.current.at < 1200;
      if (!coalesce) past.current = [...past.current.slice(-80), cur];
      future.current = [];
      lastKey.current = key ? { key, at: now } : null;
      return { ...next, steps: normalize(next.steps) };
    });
    force((n) => n + 1);
  }, []);
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    setDef((cur) => {
      future.current.push(cur);
      return prev;
    });
    lastKey.current = null;
    force((n) => n + 1);
  }, []);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    setDef((cur) => {
      past.current.push(cur);
      return next;
    });
    lastKey.current = null;
    force((n) => n + 1);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return; // let text boxes undo their own typing
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.ctrlKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [undo, redo]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // ---------- what's on screen ----------
  const viewing = data.viewing;
  const live = !!viewing;
  const [selected, setSelected] = useState<string | null>(null);
  const [picker, setPicker] = useState<number | null>(null);
  const [versions, setVersions] = useState(false);
  const [runDialog, setRunDialog] = useState<null | "test" | "run">(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<{ msg: string; retry?: () => void } | null>(null);
  const [flash, setFlash] = useState("");

  const steps = live ? viewing!.steps : def.steps;
  const selIndex = steps.findIndex((s) => s.id === selected);
  const sel = selIndex >= 0 ? steps[selIndex] : null;
  const sentence = flowSentence(live ? { steps: viewing!.steps, limits: def.limits } : def, agents);
  const problems = workflowProblems(def, agents, data.projects);
  const enabled = data.workflow.enabled;
  const manualStart = (def.steps[0]?.trigger ?? "manual") === "manual";

  const liveInfo: LiveInfo = useMemo(() => {
    if (!viewing) return null;
    const nowText: Record<string, string> = {};
    for (const s of viewing.steps) {
      const sr = viewing.stepRuns[s.id];
      const last = sr?.runIds.at(-1);
      const info = last ? data.stepRunInfo[last] : null;
      if (info && (info.status === "working" || info.status === "queued" || info.status === "waiting"))
        nowText[s.id] = info.needsOk ? "Waiting for your OK in the Inbox" : info.activity ?? sr.note ?? "";
    }
    return { stepRuns: viewing.stepRuns, current: viewing.current, nowText };
  }, [viewing, data.stepRunInfo]);

  function setStep(i: number, patch: Partial<WfStep>, key?: string) {
    const next = def.steps.map((s, j) => (j === i ? { ...s, ...patch } : s));
    update({ ...def, steps: next }, key ? `${def.steps[i].id}:${key}` : undefined);
  }
  function move(from: number, to: number) {
    if (from < 1 || to < 1 || to >= def.steps.length) return;
    const next = [...def.steps];
    const [s] = next.splice(from, 1);
    next.splice(to, 0, s);
    update({ ...def, steps: next });
    setFlash(`Moved ${stepTitle(s, agents)} to step ${to + 1}.`);
  }
  function insert(index: number, type: StepType) {
    const s = newStep(type, agents);
    if (hasFailPath(s)) {
      const back = [...def.steps.slice(0, index)].reverse().find((x) => x.type === "agent");
      if (back) s.onFail = back.id;
    }
    const next = [...def.steps.slice(0, index), s, ...def.steps.slice(index)];
    update({ ...def, steps: next });
    setPicker(null);
    setSelected(s.id);
  }
  function remove(i: number) {
    const gone = def.steps[i];
    update({ ...def, steps: def.steps.filter((_, j) => j !== i) });
    setSelected(null);
    setFlash(`Removed ${stepTitle(gone, agents)}. Press Undo to bring it back.`);
  }

  async function save(note = "Saved"): Promise<boolean> {
    setBusy("save");
    setError(null);
    try {
      await post(`/api/workflows/${id}`, { ...def, note }, "PUT");
      setSaved(JSON.stringify(def));
      setFlash("Saved.");
      await refresh();
      return true;
    } catch (e) {
      setError({ msg: (e as Error).message, retry: () => save(note) });
      return false;
    } finally {
      setBusy("");
    }
  }
  async function toggle(on: boolean) {
    if (on && dirty && !(await save())) return;
    setBusy("toggle");
    setError(null);
    try {
      await post(`/api/workflows/${id}/enabled`, { enabled: on });
      await refresh();
      setFlash(on ? "It's on." : "It's off. It won't start by itself.");
    } catch (e) {
      setError({ msg: (e as Error).message, retry: () => toggle(on) });
    } finally {
      setBusy("");
    }
  }
  async function startRun(test: boolean, input: string) {
    if (dirty && !(await save())) return;
    setBusy("run");
    setError(null);
    try {
      const r = await post<WorkflowRun>(`/api/workflows/${id}/run`, { test, input });
      setRunDialog(null);
      setSelected(null);
      router.replace(`/workflows/${id}?run=${r.id}`, { scroll: false });
      refreshHeader();
    } catch (e) {
      setError({ msg: (e as Error).message, retry: () => startRun(test, input) });
      setRunDialog(null);
    } finally {
      setBusy("");
    }
  }
  async function stopRun() {
    if (!viewing) return;
    await post(`/api/workflow-runs/${viewing.id}/stop`).catch(() => {});
    await refresh();
    refreshHeader();
  }
  async function resume() {
    if (!viewing) return;
    setBusy("resume");
    setError(null);
    try {
      await post(`/api/workflow-runs/${viewing.id}/resume`);
      await refresh();
      refreshHeader();
    } catch (e) {
      setError({ msg: (e as Error).message, retry: resume });
    } finally {
      setBusy("");
    }
  }
  async function duplicate() {
    try {
      const w = await post<{ id: number }>(`/api/workflows/${id}/duplicate`);
      router.push(`/workflows/${w.id}`);
    } catch (e) {
      setError({ msg: (e as Error).message, retry: duplicate });
    }
  }
  async function del() {
    setConfirmDelete(false);
    try {
      await post(`/api/workflows/${id}`, {}, "DELETE");
      router.push("/workflows");
      router.refresh();
    } catch (e) {
      setError({ msg: (e as Error).message });
    }
  }
  const viewRun = (rid: number | null) => {
    setSelected(null);
    router.replace(rid === null ? `/workflows/${id}?run=0` : `/workflows/${id}?run=${rid}`, { scroll: false });
  };

  return (
    <div className="pt-8 sm:pt-10">
      <BackLink href="/workflows">All workflows</BackLink>

      {/* Top: name, project, On/Off, Test run, Save */}
      <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[14px] font-semibold text-muted">Workflow name</span>
            <input
              value={def.name}
              onChange={(e) => update({ ...def, name: e.target.value }, "name")}
              className="min-h-12 rounded-[14px] border border-transparent px-2 -mx-2 text-[28px] font-bold tracking-tight hover:border-line focus:border-[#C9CDD4] sm:text-[32px]"
              maxLength={60}
              disabled={live}
            />
          </label>
          <div className="sm:w-[240px]">
            <ProjectSelect value={def.project} onChange={(p) => update({ ...def, project: p })} projects={data.projects} tip="The code this workflow works on. All its steps share one copy of it and one pull request." />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[150px]">
            <Switch label={enabled ? "On" : "Off"} checked={enabled} onChange={toggle} disabled={!!busy} tip="When it's on, it starts by itself (on its schedule or from GitHub). When it's off, only Test run works." />
          </div>
          {enabled && manualStart && (
            <button type="button" className={btn.primary} onClick={() => setRunDialog("run")} disabled={!!busy || !!data.active}>
              Run now
            </button>
          )}
          <button type="button" className={btn.secondary} onClick={() => setRunDialog("test")} disabled={!!busy || !!data.active}>
            Test run
          </button>
          <button type="button" className={btn.primary} onClick={() => save()} disabled={!dirty || !!busy}>
            {busy === "save" ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
        </div>
      </div>

      <p className="mt-5 max-w-[860px] text-[17px] font-medium leading-relaxed" aria-live="polite">
        {sentence}
      </p>
      {drafted && !live && (
        <p className="mt-4 rounded-[14px] bg-[#EEF1FD] px-4 py-3 text-[15px] font-medium text-[#2A3F9E]">
          Claude drafted these steps from what you wrote. Click each one to check it, then try a Test run before you turn it on.
        </p>
      )}
      {error && (
        <div className="mt-4">
          <ErrorBox message={error.msg} onRetry={error.retry} where={`the workflow editor (${def.name})`} />
        </div>
      )}
      {!live && problems.length > 0 && def.steps.length > 1 && (
        <p className="mt-4 text-[15px] font-medium text-[#8A4600]">Before it can run: {problems[0]}</p>
      )}
      <p className="sr-only" aria-live="polite">
        {flash}
      </p>

      {/* Canvas */}
      <section className="mt-6 rounded-[24px] border border-line bg-[#FAFAFB]" aria-labelledby="canvas-h">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2 sm:px-6">
          <h2 id="canvas-h" className="text-[16px] font-semibold">
            {live ? <LiveTitle run={viewing!} /> : "Steps"}
          </h2>
          {live ? (
            <div className="flex flex-wrap items-center gap-2">
              {["running", "needs", "queued"].includes(viewing!.status) && (
                <button type="button" className={btn.danger} onClick={stopRun}>
                  Stop
                </button>
              )}
              {viewing!.status === "stopped" && viewing!.worktree && !data.active && (
                <button type="button" className={btn.primary} onClick={resume} disabled={!!busy}>
                  Pick up where it stopped
                </button>
              )}
              {viewing!.prUrl && (
                <a href={viewing!.prUrl} target="_blank" rel="noreferrer" className={btn.secondary}>
                  Pull request
                </a>
              )}
              <button type="button" className={btn.link} onClick={() => viewRun(null)}>
                Back to editing
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1">
              <button type="button" className={btn.link} onClick={undo} disabled={!past.current.length} aria-keyshortcuts="Meta+Z Control+Z">
                Undo
              </button>
              <button type="button" className={btn.link} onClick={redo} disabled={!future.current.length} aria-keyshortcuts="Meta+Shift+Z Control+Y">
                Redo
              </button>
              <button type="button" className={btn.link} onClick={() => setVersions(true)}>
                Version history
              </button>
            </div>
          )}
        </div>
        <div className="px-2 py-6 sm:px-4">
          <Canvas
            steps={steps}
            agents={agents}
            selected={selected}
            onSelect={(sid) => setSelected(sid === selected ? null : sid)}
            onInsert={(i) => setPicker(i)}
            onMove={move}
            live={liveInfo}
          />
        </div>
        {!live && <p className="px-6 pb-4 text-[14px] text-muted">Click a step to change it. Use + to add one. Drag the dots on a step to move it.</p>}
        {live && viewing!.status === "stopped" && viewing!.stopReason && (
          <p className="mx-4 mb-4 rounded-[14px] bg-[#FDE8E6] px-4 py-3 text-[15px] font-medium text-[#A11B12] sm:mx-6">{viewing!.stopReason}</p>
        )}
        {live && viewing!.status === "needs" && viewing!.waiting && (
          <WaitingBox run={viewing!} onDone={refresh} />
        )}
      </section>

      {/* Limits */}
      {!live && <Limits limits={def.limits} onChange={(l, key) => update({ ...def, limits: l }, key)} />}

      {/* History */}
      <History runs={data.runs} viewingId={viewing?.id ?? null} onView={viewRun} />

      {!live && (
        <div className="mt-10 flex flex-wrap gap-4 border-t border-line pt-6">
          <button type="button" className={btn.link} onClick={duplicate}>
            Make a copy
          </button>
          <button type="button" className={btn.link + " !text-[#A11B12]"} onClick={() => setConfirmDelete(true)}>
            Delete this workflow
          </button>
        </div>
      )}

      {/* Panels and dialogs */}
      {sel && !live && (
        <StepPanel
          key={sel.id}
          step={sel}
          index={selIndex}
          steps={def.steps}
          agents={agents}
          project={def.project}
          onChange={(patch, key) => setStep(selIndex, patch, key)}
          onDelete={() => remove(selIndex)}
          onMove={(d) => move(selIndex, selIndex + d)}
          onClose={() => setSelected(null)}
        />
      )}
      {sel && live && <RunStepPanel step={sel} run={viewing!} info={data.stepRunInfo} agents={agents} onClose={() => setSelected(null)} />}
      <StepPicker open={picker !== null} onPick={(t) => picker !== null && insert(picker, t)} onClose={() => setPicker(null)} />
      <Versions
        open={versions}
        id={id}
        onClose={() => setVersions(false)}
        onRestore={(v) => {
          update(v.def);
          setVersions(false);
          setFlash("Restored that version. Press Save to keep it.");
        }}
      />
      <RunDialog
        kind={runDialog}
        busy={busy === "run"}
        onClose={() => setRunDialog(null)}
        onStart={(input) => startRun(runDialog === "test", input)}
        hasShip={def.steps.some((s) => s.type === "ship")}
      />
      <Confirm
        open={confirmDelete}
        title={`Delete ${def.name}?`}
        text="The workflow and its run history go. Pull requests it opened stay on GitHub. This can't be undone."
        yes="Delete it"
        danger
        onYes={del}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}

const RUN_PILL = { queued: "queued", running: "running", needs: "needs", done: "done", stopped: "stopped" } as const;
const RUN_WORD = { queued: "Waiting", running: "Running", needs: "Needs you", done: "Done", stopped: "Stopped" };

function LiveTitle({ run }: { run: WorkflowRun }) {
  const active = ["running", "needs", "queued"].includes(run.status);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <StatusPill status={RUN_PILL[run.status]} label={RUN_WORD[run.status]} />
      <span>
        {active ? "Live" : "A past run"}
        {run.test ? " · test run" : ""} · started {ago(run.startedAt)}
      </span>
    </span>
  );
}

function WaitingBox({ run, onDone }: { run: WorkflowRun; onDone: () => Promise<void> }) {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const act = async (action: string) => {
    setErr("");
    try {
      await post(`/api/workflow-runs/${run.id}/answer`, { action, note });
      await onDone();
      refreshHeader();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <div className="mx-4 mb-4 rounded-[18px] bg-[#FDF0DC] p-5 sm:mx-6">
      <p className="text-[14px] font-semibold text-[#8A4600]">{run.waiting!.kind === "ship" ? "Ready to ship" : "It's waiting for you"}</p>
      <p className="mt-1 text-[17px] font-semibold">{run.waiting!.text}</p>
      {sending ? (
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-[15px] font-semibold">What should it fix? (optional)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="rounded-[14px] border border-[#C9CDD4] bg-white p-3 text-[15px]" />
          </label>
          <div className="flex gap-2">
            <button className={btn.primary} onClick={() => act("send_back")}>
              Send it back
            </button>
            <button className={btn.secondary} onClick={() => setSending(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={btn.primary} onClick={() => act("approve")}>
            {run.waiting!.kind === "ship" ? "Ship it" : "Approve"}
          </button>
          {run.waiting!.kind === "ask" && (
            <button className={btn.secondary} onClick={() => setSending(true)}>
              Send back
            </button>
          )}
          <button className={btn.secondary} onClick={() => act("stop")}>
            Stop
          </button>
        </div>
      )}
      {err && <p className="mt-2 text-[14px] font-medium text-[#A11B12]">{err}</p>}
    </div>
  );
}

function Limits({ limits, onChange }: { limits: WfLimits; onChange: (l: WfLimits, key: string) => void }) {
  return (
    <section className="panel mt-6 p-6 sm:p-8" aria-labelledby="limits-h">
      <h2 id="limits-h" className="flex items-center text-[18px] font-semibold">
        Limits
        <InfoTip text="Safety limits for every run of this workflow, so it can't loop or run forever." label="Limits" />
      </h2>
      <div className="mt-4 grid gap-6 md:grid-cols-3">
        <label className="flex flex-col gap-2">
          <span className="flex items-baseline justify-between">
            <Label tip="How many times a Review or Check can send work back before the workflow stops and tells you.">“Needs work” rounds</Label>
            <span className="font-semibold">{limits.maxLoops}</span>
          </span>
          <input type="range" min={0} max={5} value={limits.maxLoops} onChange={(e) => onChange({ ...limits, maxLoops: Number(e.target.value) }, "loops")} className="h-11 accent-[#15171B]" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="flex items-baseline justify-between">
            <Label tip="The longest one run can take, start to finish. Time spent waiting for you doesn't count.">Longest run</Label>
            <span className="font-semibold">{duration(limits.maxMinutes * 60000)}</span>
          </span>
          <input type="range" min={10} max={480} step={10} value={limits.maxMinutes} onChange={(e) => onChange({ ...limits, maxMinutes: Number(e.target.value) }, "mins")} className="h-11 accent-[#15171B]" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="flex items-baseline justify-between">
            <Label tip="Stops a run that uses more than about this much of your Claude usage (the session meter at the top).">Most usage per run</Label>
            <span className="font-semibold">about {limits.maxUsagePct}%</span>
          </span>
          <input type="range" min={5} max={100} step={5} value={limits.maxUsagePct} onChange={(e) => onChange({ ...limits, maxUsagePct: Number(e.target.value) }, "usage")} className="h-11 accent-[#15171B]" />
        </label>
      </div>
    </section>
  );
}

function History({ runs, viewingId, onView }: { runs: WorkflowRun[]; viewingId: number | null; onView: (id: number) => void }) {
  return (
    <section className="panel mt-6 p-6 sm:p-8" aria-labelledby="wf-hist-h">
      <h2 id="wf-hist-h" className="text-[18px] font-semibold">
        Run history
      </h2>
      {runs.length === 0 ? (
        <p className="mt-3 text-[15px] text-muted">No runs yet. Press Test run to try it safely: it stops before shipping and sends no messages.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {runs.map((r) => (
            <li key={r.id} className={`flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:gap-4 ${viewingId === r.id ? "bg-soft -mx-3 rounded-[14px] px-3" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-snug">
                  {r.input ? r.input.split("\n")[0] : r.test ? "Test run" : "Run"}
                  {r.test && r.input ? " · test run" : ""}
                </p>
                <p className="mt-0.5 text-[14px] text-muted">
                  {new Date(r.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}, {clockOf(r.startedAt)}
                  {r.endedAt ? ` · took ${duration(r.endedAt - r.startedAt)}` : ""}
                  {r.status === "stopped" && r.stopReason ? ` · ${r.stopReason}` : r.summary && r.summary !== "dismissed" ? ` · ${r.summary}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill status={RUN_PILL[r.status]} label={RUN_WORD[r.status]} />
                {r.prUrl && (
                  <a href={r.prUrl} target="_blank" rel="noreferrer" className={btn.link + " !text-[14px] !text-[#2A3F9E]"}>
                    Pull request
                  </a>
                )}
                <button type="button" className={btn.secondary} onClick={() => onView(r.id)} aria-pressed={viewingId === r.id}>
                  {["running", "needs", "queued"].includes(r.status) ? "Watch" : "See it"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function useDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return ref;
}

function StepPicker({ open, onPick, onClose }: { open: boolean; onPick: (t: StepType) => void; onClose: () => void }) {
  const ref = useDialog(open);
  const id = useId();
  return (
    <dialog ref={ref} aria-labelledby={id} onClose={onClose} className="m-auto w-[min(560px,calc(100vw-32px))] rounded-[24px] p-0 backdrop:bg-black/30">
      <div className="flex flex-col gap-4 p-6 sm:p-8">
        <h2 id={id} className="text-[22px] font-bold">
          Add a step
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {ADDABLE.map((t) => (
            <li key={t}>
              <button type="button" onClick={() => onPick(t)} className="flex h-full min-h-11 w-full items-start gap-3 rounded-[18px] border border-line p-4 text-left hover:border-ink hover:bg-soft">
                <span className="relative mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                  <span className="absolute inset-0 rounded-full" style={{ background: STEP_INFO[t].color, opacity: 0.1 }} />
                  <span className="relative">
                    <Icon name={STEP_INFO[t].icon} color={STEP_INFO[t].color} size={18} />
                  </span>
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">{STEP_INFO[t].title}</span>
                  <span className="block text-[13px] leading-snug text-muted">{STEP_INFO[t].help}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <button type="button" className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}

function Versions({ open, id, onClose, onRestore }: { open: boolean; id: number; onClose: () => void; onRestore: (v: WorkflowVersion) => void }) {
  const ref = useDialog(open);
  const titleId = useId();
  const [list, setList] = useState<WorkflowVersion[] | null>(null);
  useEffect(() => {
    if (!open) return;
    setList(null);
    fetch(`/api/workflows/${id}/versions`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setList)
      .catch(() => setList([]));
  }, [open, id]);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onClose} className="m-auto w-[min(560px,calc(100vw-32px))] rounded-[24px] p-0 backdrop:bg-black/30">
      <div className="flex max-h-[80vh] flex-col gap-4 p-6 sm:p-8">
        <h2 id={titleId} className="text-[22px] font-bold">
          Version history
        </h2>
        <p className="text-[15px] text-muted">Every time you save, a version is kept. Restoring one puts it in the editor; press Save to keep it.</p>
        <ul className="-mx-2 flex flex-col overflow-y-auto">
          {list === null ? (
            <li className="px-2 py-4 text-muted">Loading…</li>
          ) : list.length === 0 ? (
            <li className="px-2 py-4 text-muted">No saved versions yet.</li>
          ) : (
            list.map((v, i) => (
              <li key={v.id} className="flex items-center gap-3 rounded-[14px] px-2 py-3 hover:bg-soft">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">
                    {new Date(v.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}, {clockOf(v.savedAt)}
                    {i === 0 ? " · current" : ""}
                  </p>
                  <p className="truncate text-[14px] text-muted">
                    {v.note} · {v.def.steps.length} steps · {v.def.name}
                  </p>
                </div>
                {i > 0 && (
                  <button type="button" className={btn.secondary} onClick={() => onRestore(v)}>
                    Restore
                  </button>
                )}
              </li>
            ))
          )}
        </ul>
        <div className="flex justify-end">
          <button type="button" className={btn.secondary} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}

function RunDialog({ kind, busy, onClose, onStart, hasShip }: { kind: null | "test" | "run"; busy: boolean; onClose: () => void; onStart: (input: string) => void; hasShip: boolean }) {
  const ref = useDialog(kind !== null);
  const titleId = useId();
  const [input, setInput] = useState("");
  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onClose} className="m-auto w-[min(560px,calc(100vw-32px))] rounded-[24px] p-0 backdrop:bg-black/30">
      <form
        className="flex flex-col gap-4 p-6 sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          onStart(input);
        }}
      >
        <h2 id={titleId} className="text-[22px] font-bold">
          {kind === "test" ? "Test run" : "Run now"}
        </h2>
        {kind === "test" && (
          <p className="text-[15px] leading-relaxed text-muted">
            A test run does every step for real{hasShip ? ", but stops before Ship" : ""} and never sends Discord messages. It still uses some Claude usage and may open a draft pull request you can close.
          </p>
        )}
        <label className="flex flex-col gap-2">
          <span className="text-[15px] font-semibold">What should it work on? (optional)</span>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={4} placeholder="For example: Add a dark mode switch to the settings page." className="rounded-[14px] border border-[#C9CDD4] p-3 text-[15px] leading-relaxed" />
        </label>
        <div className="flex justify-end gap-3">
          <button type="button" className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btn.primary} disabled={busy}>
            {busy ? "Starting…" : kind === "test" ? "Start test run" : "Start"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export { field };
