import { getRun, getWfRun, getWorkflow, listAgents, listVersions, listWfRuns, listWorkflows, pendingApprovalForRun } from "./db";
import { listProjects } from "./projects";
import type { PillStatus, Run, Workflow, WorkflowRun, WorkflowVersion } from "./types";
import { STEP_INFO, flowSentence, type AgentRef } from "./wf";
import { ago } from "./words";
import { activeWfRun } from "./workflowRunner";

export const agentRefs = (): AgentRef[] =>
  listAgents()
    .filter((a) => a.kind === "claude")
    .map((a) => ({ id: a.id, name: a.name, color: a.color, icon: a.icon, slug: a.slug, allowed: a.allowed }));

export type WorkflowTile = { id: number; name: string; sentence: string; status: PillStatus; timeLabel: string; note: string | null; chips: { icon: string; color: string }[] };

export function workflowTile(w: Workflow, agents = agentRefs()): WorkflowTile {
  const runs = listWfRuns(w.id, 1);
  const last = runs[0];
  const active = activeWfRun(w.id);
  let status: PillStatus = w.enabled ? "on" : "off";
  let note: string | null = null;
  if (active) {
    status = active.status === "needs" ? "needs" : active.status === "queued" ? "queued" : "running";
    const step = active.steps[active.current];
    note = active.status === "needs" ? active.waiting?.text ?? "Waiting for you" : step ? active.stepRuns[step.id]?.note ?? null : null;
  } else if (last && Date.now() - (last.endedAt ?? last.startedAt) < 24 * 3600_000 && last.summary !== "dismissed") {
    status = last.status === "stopped" ? "stopped" : last.status === "done" ? "done" : status;
    note = last.status === "stopped" ? last.stopReason : last.summary;
  }
  return {
    id: w.id, name: w.name, sentence: flowSentence(w, agents), status, note,
    chips: w.steps.map((s) => {
      const a = s.type === "agent" && s.agentId != null ? agents.find((x) => x.id === s.agentId) : null;
      return { icon: a?.icon ?? STEP_INFO[s.type].icon, color: a?.color ?? STEP_INFO[s.type].color };
    }),
    timeLabel: active ? `started ${ago(active.startedAt)}` : last ? `last run ${ago(last.endedAt ?? last.startedAt)}` : "never run",
  };
}

export function workflowsListState() {
  const agents = agentRefs();
  return { tiles: listWorkflows().map((w) => workflowTile(w, agents)) };
}
export type WorkflowsListState = ReturnType<typeof workflowsListState>;

export type StepRunInfo = Pick<Run, "id" | "status" | "activity" | "result" | "stopReason" | "startedAt" | "endedAt" | "mode" | "plan"> & {
  needsOk: boolean;
};

export type WorkflowPageState = {
  workflow: Workflow;
  agents: AgentRef[];
  projects: string[];
  runs: WorkflowRun[];
  active: WorkflowRun | null;
  viewing: WorkflowRun | null;
  stepRunInfo: Record<number, StepRunInfo>;
  versions: Pick<WorkflowVersion, "id" | "savedAt" | "note">[];
};

export function workflowPageState(id: number, viewRunId?: number | null): WorkflowPageState | null {
  const workflow = getWorkflow(id);
  if (!workflow) return null;
  const runs = listWfRuns(id, 25);
  const active = activeWfRun(id);
  let viewing: WorkflowRun | null = null;
  if (viewRunId) {
    const r = getWfRun(viewRunId);
    if (r && r.workflowId === id) viewing = r;
  }
  if (!viewing && viewRunId !== 0) viewing = active;
  const stepRunInfo: Record<number, StepRunInfo> = {};
  if (viewing) {
    for (const sr of Object.values(viewing.stepRuns))
      for (const rid of sr.runIds) {
        const r = getRun(rid);
        if (r)
          stepRunInfo[rid] = {
            id: r.id, status: r.status, activity: r.activity, result: r.result, stopReason: r.stopReason, startedAt: r.startedAt, endedAt: r.endedAt,
            mode: r.mode, plan: r.plan, needsOk: !!pendingApprovalForRun(r.id) || r.status === "waiting",
          };
      }
  }
  return {
    workflow, agents: agentRefs(), projects: listProjects(), runs, active, viewing, stepRunInfo,
    versions: listVersions(id).map((v) => ({ id: v.id, savedAt: v.savedAt, note: v.note })),
  };
}
