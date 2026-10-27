// "Change it in your own words": the parts that are safe on the page too. Claude's answer is merged onto
// the steps Nic has now (so settings it didn't mention stay as they are), and the before → after preview
// says which steps are new, changed, moved or gone.
import { modeFor } from "./job";
import type { Freedom, WfLimits, WfStep, WorkflowInput } from "./types";
import { STEP_INFO, cleanLimits, cleanSteps, stepIconOf, stepTitle, type AgentRef } from "./wf";

export type ChangeDraft = { steps: WfStep[]; limits: WfLimits; summary: string };

// A step Claude kept (same id, same type) starts from the step as it is now, so fields Claude left out
// (connectors, a brief, a custom prompt) aren't lost. The goal and the brief always stay Nic's own:
// they have their own boxes, and a change in words is about the steps.
export function mergeChange(before: WorkflowInput, raw: { steps?: unknown; maxLoops?: unknown; summary?: unknown }, agentIds: number[]): ChangeDraft {
  const old = new Map(before.steps.map((s) => [s.id, s]));
  const list = (Array.isArray(raw.steps) ? raw.steps : []) as Record<string, unknown>[];
  const merged = list.map((r) => {
    const b = typeof r?.id === "string" ? old.get(r.id) : undefined;
    const m: Record<string, unknown> = b && b.type === r.type ? { ...b, ...r } : { ...r };
    if (m.type === "agent" && typeof r?.freedom === "string") m.mode = modeFor(r.freedom as Freedom, false).mode;
    return m;
  });
  const steps = cleanSteps(merged, agentIds);
  const start = before.steps[0];
  if (start && steps[0]) {
    steps[0] = { ...steps[0], task: start.task ?? "" };
    if (start.brief) steps[0].brief = start.brief;
    else delete steps[0].brief;
  }
  // A step that comes back the same (once both are cleaned the same way) stays exactly as it was,
  // so the preview doesn't call it changed.
  const norm = new Map(cleanSteps(before.steps, agentIds).map((s) => [s.id, JSON.stringify(s)]));
  for (let i = 0; i < steps.length; i++) {
    const b = old.get(steps[i].id);
    if (b && norm.get(b.id) === JSON.stringify(steps[i])) steps[i] = b;
  }
  const limits = raw.maxLoops === undefined ? before.limits : { ...before.limits, maxLoops: cleanLimits({ maxLoops: raw.maxLoops }).maxLoops };
  const summary = String(raw.summary ?? "").trim().slice(0, 300);
  return { steps, limits, summary };
}

export type DiffChip = { id: string; title: string; icon: string; color: string; mark: "same" | "new" | "changed" | "moved" | "gone" };

const MARK_WORD: Record<DiffChip["mark"], string> = { same: "", new: "new", changed: "changed", moved: "moved", gone: "removed" };
export const markWord = (m: DiffChip["mark"]) => MARK_WORD[m];

// Steps are compared by id. Before shows what goes away; after shows what's new, changed or moved.
export function diffSteps(before: WfStep[], after: WfStep[], agents: AgentRef[]): { before: DiffChip[]; after: DiffChip[]; changed: boolean } {
  const chip = (s: WfStep, mark: DiffChip["mark"]): DiffChip => {
    const a = s.type === "agent" && s.agentId != null ? agents.find((x) => x.id === s.agentId) : null;
    return { id: s.id, title: stepTitle(s, agents), icon: a?.icon ?? stepIconOf(s), color: a?.color ?? STEP_INFO[s.type].color, mark };
  };
  const afterIds = new Set(after.map((s) => s.id));
  const beforeById = new Map(before.map((s) => [s.id, s]));
  // Order among the steps both sides share, to spot moves.
  const keptBefore = before.filter((s) => afterIds.has(s.id)).map((s) => s.id);
  const keptAfter = after.filter((s) => beforeById.has(s.id)).map((s) => s.id);
  const b = before.map((s) => chip(s, afterIds.has(s.id) ? "same" : "gone"));
  const a = after.map((s) => {
    const old = beforeById.get(s.id);
    if (!old) return chip(s, "new");
    if (JSON.stringify(old) !== JSON.stringify(s)) return chip(s, "changed");
    if (keptBefore.indexOf(s.id) !== keptAfter.indexOf(s.id)) return chip(s, "moved");
    return chip(s, "same");
  });
  const changed = b.some((c) => c.mark !== "same") || a.some((c) => c.mark !== "same");
  return { before: b, after: a, changed };
}

// "Lookout" → "Lookout (copy)", "Lookout (copy)" → "Lookout (copy 2)".
export function copyName(name: string): string {
  const m = name.match(/^(.*) \(copy(?: (\d+))?\)$/);
  const out = m ? `${m[1]} (copy ${m[2] ? Number(m[2]) + 1 : 2})` : `${name} (copy)`;
  return out.slice(0, 60);
}
