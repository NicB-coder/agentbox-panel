// Workflow building blocks shared by the browser and the server: step types, templates,
// the plain-English sentence for a whole flow, and turning anything into a clean workflow.
import type { CheckKind, Freedom, Model, StartTrigger, StepType, WfLimits, WfStep, WorkflowInput, WorkMode } from "./types";
import { clock, scheduleWords, times } from "./words";

export type AgentRef = { id: number; name: string; color: string; icon: string; slug?: string; allowed?: string; archived?: boolean };

export const STEP_INFO: Record<StepType, { title: string; icon: string; color: string; help: string }> = {
  start: { title: "Start", icon: "play", color: "#2B8A3E", help: "What starts the workflow." },
  agent: { title: "Build", icon: "hammer", color: "#2F4FD8", help: "An agent does a piece of the work: builds or changes something, or just takes a look." },
  research: { title: "Research", icon: "book", color: "#7048C8", help: "Looks things up and writes research.md for the later steps to use." },
  review: { title: "Review", icon: "eye", color: "#0F7B6C", help: "A reviewer checks the work against the task and the research. Passed, or needs work." },
  check: { title: "Check", icon: "check", color: "#0E7490", help: "Hard tests, not opinions: tests pass, the page loads, no errors." },
  ask: { title: "Ask me", icon: "hand", color: "#B45309", help: "Waits for you in the Inbox: Approve, Send back or Stop." },
  ship: { title: "Ship", icon: "rocket", color: "#BE185D", help: "Merges the pull request into main." },
  tell: { title: "Tell me", icon: "bell", color: "#2F4FD8", help: "Sends you a Discord message with a summary and links." },
};

export const ADDABLE: StepType[] = ["agent", "research", "review", "check", "ask", "ship", "tell"];

export const TRIGGER_WORDS: Record<StartTrigger, string> = {
  manual: "When I start it",
  schedule: "On a schedule",
  issue_label: "When a GitHub issue gets a label",
  pr_opened: "When a pull request opens",
};

export const CHECK_WORDS: Record<CheckKind, string> = {
  tests: "Tests pass",
  page: "Page loads in a real browser",
  console: "No errors in the browser console",
};

// The longest goal a workflow can save. It used to be 8,000 and longer goals were cut off without a word (Lookout, Oct 23).
export const GOAL_MAX = 40_000;

export const DEFAULT_LIMITS: WfLimits = { maxLoops: 2, maxMinutes: 120, maxUsagePct: 25 };

export function newId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function newStep(type: StepType, agents: AgentRef[] = []): WfStep {
  const id = newId();
  switch (type) {
    case "start":
      return { id, type, trigger: "manual" };
    case "agent":
      return { id, type, agentId: null, prompt: "", freedom: "auto", careful: false, maxMinutes: 30, model: "sonnet" };
    case "research":
      return { id, type, prompt: "", maxMinutes: 20, model: "sonnet" };
    case "review":
      return { id, type, prompt: "", maxMinutes: 15, model: "opus", onFail: "stop" };
    case "check":
      return { id, type, checks: ["tests"], pagePath: "/", onFail: "stop" };
    case "ask":
      return { id, type, question: "" };
    case "ship":
      return { id, type, shipMode: "ask" };
    case "tell":
      return { id, type, tellWhen: "always", openIssue: false };
  }
}

// The title on a step tile, e.g. "Builder" or "Review".
export function stepTitle(s: WfStep, agents: AgentRef[]): string {
  if (s.type === "agent") {
    if (s.agentId == null) return (s.freedom ?? (s.mode === "look" ? "look" : "auto")) === "look" ? "Look" : "Build";
    return agents.find((a) => a.id === s.agentId)?.name ?? "Missing agent";
  }
  return STEP_INFO[s.type].title;
}

// The small line under the title.
export function stepSubtitle(s: WfStep, steps: WfStep[], agents: AgentRef[]): string {
  switch (s.type) {
    case "start":
      if (s.trigger === "schedule") return scheduleWords(s.scheduleKind ?? "daily", s.scheduleDays ?? [], s.scheduleTime ?? "02:00");
      if (s.trigger === "issue_label") return `Issue labeled “${s.label || "agent"}”`;
      return TRIGGER_WORDS[s.trigger ?? "manual"];
    case "agent":
      return s.agentId == null ? short(s.prompt) || "Write what it should do" : short(s.prompt) || "Does its usual job";
    case "research":
      return short(s.prompt) || "Looks things up";
    case "review":
      return failWords(s, steps, agents);
    case "check":
      return (s.checks ?? []).map((c) => CHECK_WORDS[c]).join(", ") || "Pick a check";
    case "ask":
      return short(s.question) || "Waits for your OK";
    case "ship":
      return s.shipMode === "auto" ? "Ships automatically" : "Asks before shipping";
    case "tell":
      return s.tellWhen === "problems" ? "Only if there are problems" : "Discord message";
  }
}

function short(s?: string) {
  const t = (s ?? "").trim().replace(/\s+/g, " ");
  return t.length > 48 ? `${t.slice(0, 46)}…` : t;
}

function failWords(s: WfStep, steps: WfStep[], agents: AgentRef[]) {
  if (!s.onFail || s.onFail === "stop") return "If it needs work: stop";
  const t = steps.find((x) => x.id === s.onFail);
  return t ? `If it needs work: back to ${stepTitle(t, agents)}` : "If it needs work: stop";
}

// What a workflow run's agents are told it's about: the saved goal, plus anything typed for this one run.
// Both, never one instead of the other: Lookout's run "did nothing" because the typed line replaced the goal.
export function runTaskText(goal: string, extra: string): string {
  const g = goal.trim();
  const x = extra.trim();
  if (g && x && x !== g) return `What this workflow should make (Nic's saved goal):\n${g}\n\nFor this run, Nic adds:\n${x}`;
  if (g || x) return `The task for this run:\n${g || x}`;
  return "There's no extra task for this run: do the job described below.";
}

// "Run with a different goal…": the run's own copy of the steps carries that goal; the saved workflow keeps its own.
export function stepsWithGoal(steps: WfStep[], goal?: string): WfStep[] {
  const g = goal?.trim();
  return g ? steps.map((s, i) => (i === 0 ? { ...s, task: g } : s)) : steps;
}

// A save that would cut the goal off is refused instead (plain words for the editor).
export function goalTooLong(rawSteps: unknown): string | null {
  const first = Array.isArray(rawSteps) ? (rawSteps[0] as { task?: unknown } | undefined) : undefined;
  const len = typeof first?.task === "string" ? first.task.length : 0;
  return len > GOAL_MAX ? `The goal is too long (${len.toLocaleString("en-US")} characters). Keep it under ${GOAL_MAX.toLocaleString("en-US")}.` : null;
}

export const hasFailPath = (s: WfStep) => s.type === "review" || s.type === "check";

// "When you start it, it researches the task, Builder builds it, a reviewer checks it (back to Builder if it needs work, up to 2 times), ..."
export function flowSentence(w: Pick<WorkflowInput, "steps" | "limits">, agents: AgentRef[]): string {
  const steps = w.steps;
  if (!steps.length) return "Add a step to get started.";
  const start = steps[0];
  let when = "When you start it";
  if (start.trigger === "schedule") {
    const kind = start.scheduleKind ?? "daily";
    when = kind === "hourly" ? "Every hour" : kind === "daily" ? `Every day at ${clock(start.scheduleTime ?? "02:00")}` : scheduleWords("days", start.scheduleDays ?? [], start.scheduleTime ?? "02:00");
  } else if (start.trigger === "issue_label") when = `When a GitHub issue gets the “${start.label || "agent"}” label`;
  else if (start.trigger === "pr_opened") when = "When a pull request opens";

  const parts: string[] = [];
  for (const s of steps.slice(1)) {
    switch (s.type) {
      case "agent":
        {
          const a = agents.find((x) => x.id === s.agentId);
          const look = (s.freedom ?? (s.mode === "look" ? "look" : null)) === "look" || a?.allowed === "look";
          const how = s.careful ? " carefully" : "";
          parts.push(s.agentId == null ? (look ? "it takes a look" : `it builds it${how}`) : look ? `${stepTitle(s, agents)} takes a look` : `${stepTitle(s, agents)} works on it${how}`);
        }
        break;
      case "research":
        parts.push("it researches the task");
        break;
      case "review": {
        const t = s.onFail && s.onFail !== "stop" ? steps.find((x) => x.id === s.onFail) : null;
        parts.push(t ? `a reviewer checks it (back to ${stepTitle(t, agents)} if it needs work, up to ${times(w.limits.maxLoops)})` : "a reviewer checks it (stops if it needs work)");
        break;
      }
      case "check": {
        const c = (s.checks ?? []).map((k) => ({ tests: "the tests pass", page: "the page loads", console: "there are no errors" })[k]);
        parts.push(c.length ? `it makes sure ${joinAnd(c)}` : "it runs a check");
        break;
      }
      case "ask":
        parts.push("it asks for your OK");
        break;
      case "ship":
        parts.push(s.shipMode === "auto" ? "it ships automatically if every check passed" : "it ships after you say yes");
        break;
      case "tell":
        parts.push(s.tellWhen === "problems" ? "it tells you if something's wrong" : "it tells you on Discord");
        break;
    }
  }
  if (!parts.length) return `${when}, nothing happens yet. Add a step.`;
  const text = `${when}, ${joinAnd(parts)}.`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function joinAnd(xs: string[]) {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

// ---------- templates ----------

export type TemplateKey = "build-review-ship" | "nightly-site-check" | "research-report" | "issues-to-prs";

export const TEMPLATES: { key: TemplateKey; name: string; blurb: string }[] = [
  { key: "build-review-ship", name: "Build → Review → Ship", blurb: "Research an idea, build it, get it reviewed and tested, then ship it after you say yes." },
  { key: "nightly-site-check", name: "Nightly site check", blurb: "Every night it looks at your site in a real browser. If something's wrong, you get a message and a GitHub issue." },
  { key: "research-report", name: "Research report", blurb: "Research a topic and write a short report as a pull request in a reports folder." },
  { key: "issues-to-prs", name: "Ideas to pull requests", blurb: "When a GitHub issue gets the “agent” label, it gets built, a reviewer checks it, then it asks you." },
];

export function templateWorkflow(key: TemplateKey, agents: AgentRef[], project: string): WorkflowInput {
  void agents;
  const start = (trigger: StartTrigger, more: Partial<WfStep> = {}): WfStep => ({ id: newId(), type: "start", trigger, task: "", ...more });
  const build = (): WfStep => ({
    id: newId(), type: "agent", agentId: null, freedom: "auto", careful: false, model: "sonnet", maxMinutes: 45,
    prompt: "Build what the task asks for. Keep the change focused, test that it really works (run the tests, or open the page in a browser), and commit.",
  });
  const review = (to: string): WfStep => ({ id: newId(), type: "review", prompt: "", maxMinutes: 15, model: "opus", onFail: to });
  const limits = { ...DEFAULT_LIMITS };
  switch (key) {
    case "build-review-ship": {
      const b = build();
      return {
        name: "Build → Review → Ship",
        project,
        limits,
        steps: [
          start("manual"),
          { id: newId(), type: "research", prompt: "", maxMinutes: 20, model: "sonnet" },
          b,
          review(b.id),
          { id: newId(), type: "check", checks: ["tests"], pagePath: "/", onFail: b.id },
          { id: newId(), type: "ask", question: "It's built, reviewed and tested. Ship it?" },
          { id: newId(), type: "ship", shipMode: "ask" },
          { id: newId(), type: "tell", tellWhen: "always", openIssue: false },
        ],
      };
    }
    case "nightly-site-check": {
      return {
        name: "Nightly site check",
        project,
        limits,
        steps: [
          start("schedule", { scheduleKind: "daily", scheduleTime: "02:00", scheduleDays: [], task: "Check that my site works: every page loads, links work, images show, nothing looks broken." }),
          { id: newId(), type: "agent", agentId: null, prompt: "Open the site in a real browser at laptop and phone width and list anything broken, with where to find it. Don't change anything.", freedom: "look", careful: false, model: "sonnet", maxMinutes: 30 },
          { id: newId(), type: "tell", tellWhen: "problems", openIssue: true },
        ],
      };
    }
    case "research-report":
      return {
        name: "Research report",
        project,
        limits,
        steps: [
          start("manual"),
          { id: newId(), type: "research", prompt: "", maxMinutes: 20, model: "sonnet" },
          {
            id: newId(), type: "agent", agentId: null, freedom: "auto", careful: false, model: "sonnet", maxMinutes: 15,
            prompt: "Turn research.md into a short, friendly report (one page) and save it in the reports/ folder with a clear file name. Then delete research.md.",
          },
          { id: newId(), type: "tell", tellWhen: "always", openIssue: false },
        ],
      };
    case "issues-to-prs": {
      const b = build();
      return {
        name: "Ideas to pull requests",
        project,
        limits,
        steps: [start("issue_label", { label: "agent" }), b, review(b.id), { id: newId(), type: "ask", question: "It made a pull request for this issue. Look it over?" }],
      };
    }
  }
}

// The steps a new workflow gets when Nic only says what he wants to make (the start screen):
// Build (Careful mode) → Review → Ship, and Ship asks him first.
export function defaultWorkflow(goal: string, project: string): WorkflowInput {
  const b: WfStep = {
    id: newId(), type: "agent", agentId: null, freedom: "auto", careful: true, model: "sonnet", maxMinutes: 60,
    prompt: "Build what the task asks for. Keep the change focused, test that it really works (run the tests, or open the page in a browser), and commit.",
  };
  return {
    name: nameFromGoal(goal),
    project,
    limits: { ...DEFAULT_LIMITS },
    steps: [
      { id: newId(), type: "start", trigger: "manual", task: goal.trim() },
      b,
      { id: newId(), type: "review", prompt: "", maxMinutes: 15, model: "opus", onFail: b.id },
      { id: newId(), type: "ship", shipMode: "ask" },
    ],
  };
}

// A short workflow name from the goal: "Make an arcade website with 4 games" → "Arcade website with 4 games".
export function nameFromGoal(goal: string): string {
  const line = goal.trim().split("\n").find((l) => l.replace(/[#*>\-\s]/g, "")) ?? "";
  const words = line
    .replace(/[#*_`>]/g, " ")
    .replace(/^\s*(please\s+)?(i want( you)? to\s+|can you\s+)?(make|build|create|write|add|design|code)\s+(me\s+)?(an?|the|some|my)?\s*/i, "")
    .split(/[.!?]\s|\s+(?:that|which|who|so|where)\s/i)[0]
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
  // Don't end on a little joining word: "Snake game with" → "Snake game".
  while (words.length > 1 && /^(a|an|the|and|or|with|for|to|of|in|on|that|which|so|it|my)$/i.test(words[words.length - 1].replace(/[.,:;!?]+$/, ""))) words.pop();
  const name = words.join(" ").replace(/[.,:;!?]+$/, "");
  if (!name) return "New workflow";
  return (name.charAt(0).toUpperCase() + name.slice(1)).slice(0, 60);
}

// ---------- cleaning up anything into a valid workflow ----------

const TYPES: StepType[] = ["start", "agent", "research", "review", "check", "ask", "ship", "tell"];
const MODES: WorkMode[] = ["auto", "plan", "ask", "look"];
const MODELS: Model[] = ["sonnet", "opus"];
const CHECKS: CheckKind[] = ["tests", "page", "console"];
const TRIGGERS: StartTrigger[] = ["manual", "schedule", "issue_label", "pr_opened"];

const clampInt = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};

export function cleanSteps(raw: unknown, agentIds: number[]): WfStep[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: WfStep[] = [];
  const seen = new Set<string>();
  for (const r of list as Record<string, unknown>[]) {
    const type = r?.type as StepType;
    if (!TYPES.includes(type)) continue;
    let id = typeof r.id === "string" && /^[a-z0-9]{1,12}$/i.test(r.id) ? r.id : newId();
    if (seen.has(id)) id = newId();
    seen.add(id);
    const s: WfStep = { id, type };
    const text = (k: string, max = 2000) => (typeof r[k] === "string" ? (r[k] as string).slice(0, max) : "");
    if (type === "start") {
      s.trigger = TRIGGERS.includes(r.trigger as StartTrigger) ? (r.trigger as StartTrigger) : "manual";
      if (s.trigger === "schedule") {
        s.scheduleKind = (["hourly", "daily", "days"] as const).includes(r.scheduleKind as "daily") ? (r.scheduleKind as "daily") : "daily";
        s.scheduleDays = Array.isArray(r.scheduleDays) ? [...new Set((r.scheduleDays as unknown[]).map(Number).filter((d) => d >= 0 && d <= 6))] : [];
        s.scheduleTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(r.scheduleTime)) ? String(r.scheduleTime) : "02:00";
      }
      if (s.trigger === "issue_label") s.label = text("label", 50).trim() || "agent";
      s.task = text("task", GOAL_MAX);
    }
    if (type === "agent" || type === "research" || type === "review") {
      s.prompt = text("prompt");
      s.maxMinutes = clampInt(r.maxMinutes, 5, 120, type === "agent" ? 30 : 20);
      if (type !== "agent" || r.agentId == null) s.model = MODELS.includes(r.model as Model) ? (r.model as Model) : type === "review" ? "opus" : "sonnet";
    }
    if (type === "agent") {
      const aid = r.agentId == null ? null : Number(r.agentId);
      s.agentId = aid !== null && agentIds.includes(aid) ? aid : null;
      s.mode = MODES.includes(r.mode as WorkMode) ? (r.mode as WorkMode) : "auto";
      s.freedom = (["look", "check", "auto"] as const).includes(r.freedom as "auto") ? (r.freedom as Freedom) : s.mode === "look" ? "look" : s.mode === "plan" ? "check" : "auto";
      s.careful = r.careful === true;
      s.connectors = Array.isArray(r.connectors) ? (r.connectors as unknown[]).map(String).filter((c) => /^[a-z0-9_-]{1,40}$/i.test(c)).slice(0, 20) : [];
    }
    if (type === "check") {
      s.checks = Array.isArray(r.checks) ? [...new Set((r.checks as CheckKind[]).filter((c) => CHECKS.includes(c)))] : ["tests"];
      if (!s.checks.length) s.checks = ["tests"];
      s.pagePath = text("pagePath", 300).trim() || "/";
    }
    if (type === "review" || type === "check") s.onFail = typeof r.onFail === "string" ? r.onFail : "stop";
    if (type === "ask") s.question = text("question", 300);
    if (type === "ship") s.shipMode = r.shipMode === "auto" ? "auto" : "ask";
    if (type === "tell") {
      s.tellWhen = r.tellWhen === "problems" ? "problems" : "always";
      s.openIssue = !!r.openIssue;
    }
    out.push(s);
  }
  // Exactly one Start, and it comes first.
  const starts = out.filter((s) => s.type === "start");
  const rest = out.filter((s) => s.type !== "start");
  const steps = [starts[0] ?? newStep("start"), ...rest].slice(0, 16);
  // "Needs work" may only go back to an earlier step.
  steps.forEach((s, i) => {
    if (!hasFailPath(s)) return;
    const t = steps.findIndex((x) => x.id === s.onFail);
    if (t < 1 || t >= i) s.onFail = "stop";
  });
  return steps;
}

export function cleanLimits(raw: unknown): WfLimits {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    maxLoops: clampInt(r.maxLoops, 0, 5, DEFAULT_LIMITS.maxLoops),
    maxMinutes: clampInt(r.maxMinutes, 10, 480, DEFAULT_LIMITS.maxMinutes),
    maxUsagePct: clampInt(r.maxUsagePct, 5, 100, DEFAULT_LIMITS.maxUsagePct),
  };
}

// Problems that stop a workflow from being switched on or test-run, in plain words.
export function workflowProblems(w: WorkflowInput, agents: AgentRef[], projects: string[]): string[] {
  const p: string[] = [];
  if (!w.name.trim()) p.push("Give the workflow a name.");
  if (!projects.includes(w.project)) p.push("Pick a project.");
  if (w.steps.length < 2) p.push("Add at least one step after Start.");
  if ((w.steps[0]?.task ?? "").length > GOAL_MAX) p.push(`The goal is too long. Keep it under ${GOAL_MAX.toLocaleString("en-US")} characters.`);
  for (const s of w.steps) {
    if (s.type === "agent" && s.agentId != null && !agents.some((a) => a.id === s.agentId)) p.push("One step uses an agent that no longer exists. Pick another.");
    if (s.type === "agent" && s.agentId == null && !(s.prompt ?? "").trim()) p.push("A Build or Look step needs its instructions.");
    if (s.type === "start" && s.trigger === "schedule" && s.scheduleKind === "days" && !(s.scheduleDays ?? []).length) p.push("Pick at least one day for the schedule.");
  }
  return [...new Set(p)];
}

// A step's icon: Look steps (fresh agents that only look) get the eye.
export function stepIconOf(s: WfStep): string {
  if (s.type === "agent" && s.agentId == null && (s.freedom ?? (s.mode === "look" ? "look" : "auto")) === "look") return "eye";
  return STEP_INFO[s.type].icon;
}
