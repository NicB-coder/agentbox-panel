"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { StepType, WfLimits, WfStep, WorkflowInput, WorkflowRun, WorkflowVersion } from "@/lib/types";
import { ADDABLE, STEP_INFO, type AgentRef, briefLabel, flowSentence, hasFailPath, newStep, stepTitle, workflowProblems } from "@/lib/wf";
import type { WorkflowPageState } from "@/lib/workflowViews";
import type { ChangeDraft } from "@/lib/changeView";
import { ago, clockOf, duration } from "@/lib/words";
import { WF_TIME_TIP, WF_USAGE_TIP } from "@/lib/job";
import { BackLink, Confirm, ErrorBox, InfoTip, Label, Switch, post } from "../bits";
import { refreshHeader } from "../Header";
import BriefPicker, { MissingFileBox, TextViewer, missingOf, type MissingInfo } from "../BriefPicker";
import ProjectSelect from "../ProjectSelect";
import { Icon, StatusPill, btn, field } from "../ui";
import { usePoll } from "../usePoll";
import { useHelperContext } from "../helper/helperStore";
import Canvas, { type LiveInfo } from "./Canvas";
import ChangeBox from "./ChangeBox";
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
  const fresh = params.get("new") === "1";
  const copied = params.get("copied") === "1";
  // The Helper's "Draft this change" opens the editor with ?change=…: it's drafted straight away (never applied).
  const helperChange = params.get("change") ?? "";
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
  const [missing, setMissing] = useState<MissingInfo | null>(null);
  const openBrief = useRef<(() => void) | null>(null);
  const [flash, setFlash] = useState("");

  const steps = live ? viewing!.steps : def.steps;
  const selIndex = steps.findIndex((s) => s.id === selected);
  const sel = selIndex >= 0 ? steps[selIndex] : null;
  const sentence = flowSentence(live ? { steps: viewing!.steps, limits: def.limits } : def, agents);
  // Tell the Helper which step is open, and which run is on the canvas.
  const goalNow = def.steps[0]?.task ?? "";
  useHelperContext(
    {
      workflowId: id, wfRunId: viewing?.id, stepId: sel?.id, stepLabel: sel ? stepTitle(sel, agents) : undefined,
      editing: [`the workflow editor. "What do you want to make?" box says: "${goalNow.slice(0, 1200)}"${def.steps[0]?.brief ? ` · Brief attached: ${def.steps[0].brief.name}` : " · no brief attached"}`, dirtyNote(def, saved)].filter(Boolean).join(" · "),
      fill: live ? undefined : 'the workflow\'s "What do you want to make?" box',
    },
    (t) => update({ ...def, steps: def.steps.map((x, i) => (i === 0 ? { ...x, task: t } : x)) }, "task"),
  );
  // The Helper's "Start a test run" button opens this page with ?test=1: start it once, then drop the ?test=1.
  const helperTest = useRef(false);
  useEffect(() => {
    if (params.get("test") !== "1" || helperTest.current) return;
    helperTest.current = true;
    router.replace(`/workflows/${id}`, { scroll: false });
    if (!data.active) runNow(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  async function save(note = "Saved", what: WorkflowInput = def, done = "Saved."): Promise<boolean> {
    setBusy("save");
    setError(null);
    try {
      await post(`/api/workflows/${id}`, { ...what, note }, "PUT");
      setSaved(JSON.stringify(what));
      setFlash(done);
      await refresh();
      return true;
    } catch (e) {
      setError({ msg: (e as Error).message, retry: () => save(note, what, done) });
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
  const savedGoal = (def.steps[0]?.task ?? "").trim();
  // Run now and Test run start straight away with the saved goal. No goal yet: point at the goal box instead.
  function runNow(test: boolean) {
    if (manualStart && !savedGoal) {
      document.getElementById("wf-task")?.focus();
      return setError({ msg: "Write what you want to make in the box above first. Then press " + (test ? "Test run" : "Run now") + " again." });
    }
    startRun(test, "");
  }
  // goal: only when Nic typed a different goal for this one run (the saved goal stays as it is).
  async function startRun(test: boolean, goal: string) {
    if (dirty && !(await save())) return;
    setBusy(test ? "test" : "run");
    setError(null);
    setMissing(null);
    try {
      const g = goal.trim() && goal.trim() !== savedGoal ? goal.trim() : undefined;
      const r = await post<WorkflowRun>(`/api/workflows/${id}/run`, { test, goal: g });
      setRunDialog(null);
      setSelected(null);
      router.replace(`/workflows/${id}?run=${r.id}`, { scroll: false });
      refreshHeader();
    } catch (e) {
      const m = missingOf(e);
      if (m) setMissing(m);
      else setError({ msg: (e as Error).message, retry: () => startRun(test, goal) });
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
  // Apply and Restore save straight away (each becomes a version), and Undo still brings the old steps back.
  function applyChange(d: ChangeDraft, text: string) {
    const next = { ...def, steps: normalize(d.steps), limits: d.limits };
    update(next);
    setSelected(null);
    save(`Changed in your own words: ${text}`.slice(0, 80), next, "Changed and saved. Press Undo to go back.");
  }
  function restore(v: WorkflowVersion) {
    const next = { ...v.def, steps: normalize(v.def.steps) };
    update(next);
    setVersions(false);
    setSelected(null);
    save(`Restored the version from ${whenOf(v.savedAt)}`, next, "Restored that version and saved it. Press Undo to go back.");
  }
  async function duplicate() {
    try {
      const w = await post<{ id: number }>(`/api/workflows/${id}/duplicate`, { def });
      router.push(`/workflows/${w.id}?copied=1`);
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
            <RunButton
              label={busy === "run" ? "Starting…" : "Run now"}
              primary
              onRun={() => runNow(false)}
              onOther={() => setRunDialog("run")}
              other="Run with a different goal…"
              disabled={!!busy || !!data.active}
            />
          )}
          <RunButton
            label={busy === "test" ? "Starting…" : "Test run"}
            onRun={() => runNow(true)}
            onOther={() => setRunDialog("test")}
            other={manualStart ? "Test with a different goal…" : ""}
            disabled={!!busy || !!data.active}
            tip={`A safe try: it does every step for real${def.steps.some((x) => x.type === "ship") ? ", but stops before Ship" : ""} and never sends Discord messages. It still uses some Claude usage and may open a draft pull request you can close.`}
          />
          <button type="button" className={btn.primary} onClick={() => save()} disabled={!dirty || !!busy}>
            {busy === "save" ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
        </div>
      </div>

      {!live && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-0 border-y border-line py-1" role="toolbar" aria-label="Edit tools">
          <button type="button" className={btn.link} onClick={undo} disabled={!past.current.length} aria-keyshortcuts="Meta+Z Control+Z">
            Undo
          </button>
          <button type="button" className={btn.link} onClick={redo} disabled={!future.current.length} aria-keyshortcuts="Meta+Shift+Z Control+Y">
            Redo
          </button>
          <span className="text-line" aria-hidden="true">|</span>
          <button type="button" className={btn.link} onClick={() => setVersions(true)}>
            Version history
          </button>
          <span className="text-line" aria-hidden="true">|</span>
          <button type="button" className={btn.link} onClick={duplicate}>
            Make a copy
          </button>
          <InfoTip text="Undo and Redo step back and forward through your changes. Version history keeps every saved version, so you can bring an old one back. Make a copy makes a new workflow just like this one (switched off) to try ideas on." label="Edit tools" />
        </div>
      )}
      {!live && data.active && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-[#EEF1FD] px-4 py-2 text-[15px] font-medium text-[#2A3F9E]">
          <span>It's running right now. You can still change it: changes apply to the next run, not the one that's going.</span>
          <button type="button" className={btn.link + " !text-[#2A3F9E]"} onClick={() => viewRun(data.active!.id)}>
            Watch the run
          </button>
        </div>
      )}
      {!live && (
        <div className="mt-6 flex flex-col gap-2">
          <Label as="label" htmlFor="wf-task" tip="The goal. Every run works on this: Run now, Test run and automatic runs. To try something else just once, use “Run with a different goal…” under Run now.">
            What do you want to make?
          </Label>
          <textarea
            id="wf-task"
            value={def.steps[0]?.task ?? ""}
            onChange={(e) => update({ ...def, steps: def.steps.map((x, i) => (i === 0 ? { ...x, task: e.target.value } : x)) }, "task")}
            rows={3}
            placeholder="For example: An arcade website with 4 small games that work on phones too."
            className="max-w-[860px] rounded-[14px] border border-[#C9CDD4] p-4 text-[16px] leading-relaxed"
          />
          <div className="mt-2 max-w-[860px]">
            <BriefPicker
              project={def.project}
              value={def.steps[0]?.brief ?? null}
              onChange={(b) => {
                setMissing(null);
                update({ ...def, steps: def.steps.map((x, i) => (i === 0 ? { ...x, brief: b ?? undefined } : x)) });
              }}
              openRef={openBrief}
              tip="A longer file that says exactly what to make, like a CLAUDE.md. It's copied into the workflow's copy of the project at the start of every run, so every step sees it. Remember to Save."
            />
          </div>
        </div>
      )}
      <p className="mt-5 max-w-[860px] text-[17px] font-medium leading-relaxed" aria-live="polite">
        {sentence}
      </p>
      {copied && !live && (
        <p className="mt-4 rounded-[14px] bg-[#EEF1FD] px-4 py-3 text-[15px] font-medium text-[#2A3F9E]">
          This is your copy. It's switched off, so change anything you like. The original stays as it was.
        </p>
      )}
      {!live && (
        <ChangeBox
          id={id}
          def={def}
          agents={agents}
          onApply={applyChange}
          start={helperChange || undefined}
          onStarted={() => router.replace(`/workflows/${id}${runParam !== null ? `?run=${runParam}` : ""}`, { scroll: false })}
          running={!!data.active}
        />
      )}
      {fresh && !live && (
        <p className="mt-4 rounded-[14px] bg-[#EEF1FD] px-4 py-3 text-[15px] font-medium text-[#2A3F9E]">
          Your workflow is ready. Check the goal and the steps, then press Test run to try it safely. Turn it on when you're happy, and Run now appears.
        </p>
      )}
      {drafted && !live && (
        <p className="mt-4 rounded-[14px] bg-[#EEF1FD] px-4 py-3 text-[15px] font-medium text-[#2A3F9E]">
          Claude drafted these steps from what you wrote. Click each one to check it, then try a Test run before you turn it on.
        </p>
      )}
      {missing && !live && (
        <div className="mt-4 max-w-[860px]">
          <MissingFileBox missing={missing} onAttach={() => openBrief.current?.()} onClose={() => setMissing(null)} />
        </div>
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
              <button type="button" className={btn.secondary} onClick={() => viewRun(null)}>
                Edit
              </button>
            </div>
          ) : (
            null
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
        {live && viewing!.status === "done" && viewing!.quiet && (
          <div className="mx-4 mb-4 rounded-[14px] bg-[#FDF0DC] px-4 py-3 text-[15px] text-[#8A4600] sm:mx-6">
            <p className="font-semibold">{viewing!.quiet.why}</p>
            <p className="mt-1">{viewing!.quiet.next}</p>
          </div>
        )}
        {live && <WhatItWasTold run={viewing!} savedGoal={data.workflow.steps[0]?.task ?? ""} />}
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
        agents={agents}
        onRestore={restore}
      />
      <GoalDialog
        kind={runDialog}
        busy={busy === "run" || busy === "test"}
        onClose={() => setRunDialog(null)}
        onStart={(goal) => startRun(runDialog === "test", goal)}
        goal={def.steps[0]?.task ?? ""}
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

// The first thing the run's agents were told: the saved goal, the brief's name, and anything typed for this run.
function WhatItWasTold({ run, savedGoal }: { run: WorkflowRun; savedGoal: string }) {
  const [open, setOpen] = useState(false);
  const goal = (run.steps[0]?.task ?? "").trim();
  const extra = run.input.trim() !== goal ? run.input.trim() : "";
  const brief = run.steps[0]?.brief;
  const [view, setView] = useState<null | { title: string; text: string | null }>(null);
  async function viewBrief() {
    if (!brief) return;
    setView({ title: brief.name, text: null });
    const j = await post<{ text: string }>(`/api/briefs/${brief.hash}`, {}, "GET").catch((e: Error) => ({ text: e.message }));
    setView({ title: brief.name, text: j.text });
  }
  return (
    <div className="mx-4 mb-4 sm:mx-6">
      <button type="button" className={btn.link} aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide what it was told" : "What it was told"}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-3 rounded-[14px] bg-soft p-4 text-[15px] leading-relaxed">
          <div>
            <p className="font-semibold">{goal && savedGoal.trim() && goal !== savedGoal.trim() ? "The goal (different from the one saved now)" : "The goal"}</p>
            <p className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap text-muted">{goal || "No goal was saved, so it only had each step's own instructions."}</p>
          </div>
          {brief && (
            <div>
              <p className="font-semibold">The brief</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-muted">
                {briefLabel(brief)}
                <button type="button" className={btn.link} onClick={viewBrief}>
                  View
                </button>
              </p>
              <TextViewer view={view} onClose={() => setView(null)} />
            </div>
          )}
          {extra && (
            <div>
              <p className="font-semibold">You added for this run</p>
              <p className="mt-1 whitespace-pre-wrap text-muted">{extra}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
          <input type="range" aria-label="“Needs work” rounds" min={0} max={5} value={limits.maxLoops} onChange={(e) => onChange({ ...limits, maxLoops: Number(e.target.value) }, "loops")} className="h-11 accent-[#15171B]" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="flex items-baseline justify-between">
            <Label tip={WF_TIME_TIP}>Longest run</Label>
            <span className="font-semibold">{duration(limits.maxMinutes * 60000)}</span>
          </span>
          <input type="range" aria-label="Longest run" aria-valuetext={duration(limits.maxMinutes * 60000)} min={10} max={480} step={10} value={limits.maxMinutes} onChange={(e) => onChange({ ...limits, maxMinutes: Number(e.target.value) }, "mins")} className="h-11 accent-[#15171B]" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="flex items-baseline justify-between">
            <Label tip={WF_USAGE_TIP}>Most usage per run</Label>
            <span className="font-semibold">about {limits.maxUsagePct}%</span>
          </span>
          <input type="range" aria-label="Most usage per run" aria-valuetext={`about ${limits.maxUsagePct}%`} min={5} max={100} step={5} value={limits.maxUsagePct} onChange={(e) => onChange({ ...limits, maxUsagePct: Number(e.target.value) }, "usage")} className="h-11 accent-[#15171B]" />
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
                  {runTitle(r)}
                  {r.test && runTitle(r) !== "Test run" ? " · test run" : ""}
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

const whenOf = (t: number) => `${new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${clockOf(t)}`;

function Versions({ open, id, agents, onClose, onRestore }: { open: boolean; id: number; agents: AgentRef[]; onClose: () => void; onRestore: (v: WorkflowVersion) => void }) {
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
        <p className="text-[15px] text-muted">Every time you save, a version is kept, newest first. Restore brings an old one back (and keeps the one you have now in this list, so nothing is lost).</p>
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
                    {whenOf(v.savedAt)}
                    {i === 0 ? " · the saved one now" : ""}
                  </p>
                  <p className="text-[14px] text-muted">{v.note}</p>
                  <p className="truncate text-[14px] text-muted">{v.def.steps.slice(1).map((s) => stepTitle(s, agents)).join(" → ") || "No steps yet"}</p>
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

// One run, one goal: "Run with a different goal…" opens with the saved goal filled in. The saved goal doesn't change.
function GoalDialog({ kind, busy, onClose, onStart, goal }: { kind: null | "test" | "run"; busy: boolean; onClose: () => void; onStart: (goal: string) => void; goal: string }) {
  const ref = useDialog(kind !== null);
  const titleId = useId();
  const boxId = useId();
  const [text, setText] = useState(goal);
  useEffect(() => {
    if (kind !== null) setText(goal);
  }, [kind, goal]);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onClose} className="m-auto w-[min(560px,calc(100vw-32px))] rounded-[24px] p-0 backdrop:bg-black/30">
      <form
        className="flex flex-col gap-4 p-6 sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onStart(text);
        }}
      >
        <h2 id={titleId} className="text-[22px] font-bold">
          {kind === "test" ? "Test with a different goal" : "Run with a different goal"}
        </h2>
        <p className="text-[15px] leading-relaxed text-muted">Change it just for this {kind === "test" ? "test run" : "run"}. Your saved goal stays the same.</p>
        <div className="flex flex-col gap-2">
          <label htmlFor={boxId} className="text-[15px] font-semibold">
            What do you want to make this time?
          </label>
          <textarea id={boxId} value={text} onChange={(e) => setText(e.target.value)} rows={6} className="rounded-[14px] border border-[#C9CDD4] p-3 text-[15px] leading-relaxed" />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btn.primary} disabled={busy || !text.trim()}>
            {busy ? "Starting…" : kind === "test" ? "Start test run" : "Start"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function RunButton({ label, primary, onRun, onOther, other, disabled, tip }: { label: string; primary?: boolean; onRun: () => void; onOther: () => void; other: string; disabled: boolean; tip?: string }) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="flex items-center">
        <button type="button" className={primary ? btn.primary : btn.secondary} onClick={onRun} disabled={disabled}>
          {label}
        </button>
        {tip && <InfoTip text={tip} label={label} />}
      </span>
      {other && (
        <button type="button" className="min-h-11 px-1 text-[14px] text-muted underline underline-offset-2 hover:text-ink disabled:opacity-50" onClick={onOther} disabled={disabled}>
          {other}
        </button>
      )}
    </div>
  );
}

// A run's name in the history: what was added for it, else its goal, else just "Run".
function runTitle(r: WorkflowRun): string {
  const line = (t: string) => t.trim().split("\n").find((l) => l.trim())?.trim().replace(/^#+\s*/, "") ?? "";
  return line(r.input) || line(r.steps[0]?.task ?? "") || (r.test ? "Test run" : "Run");
}

export { field };

function dirtyNote(def: WorkflowInput, saved: string): string | undefined {
  return JSON.stringify(def) !== saved ? "this workflow has changes that aren't saved yet" : undefined;
}
