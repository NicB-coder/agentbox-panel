// Shared types. Safe to import from client components (no server-only code here).

export type ScheduleKind = "manual" | "hourly" | "daily" | "days";
export type Allowed = "look" | "suggest" | "make";
export type WorkMode = "auto" | "plan" | "ask" | "look";
export type Model = "sonnet" | "opus";
export type NotifyOn = "finished" | "needs_ok" | "problems";
export type AgentKind = "claude" | "heartbeat" | "helper"; // helper: hidden, runs workflow steps that have no agent of their own

export type Agent = {
  id: number;
  slug: string;
  name: string;
  color: string;
  icon: string;
  prompt: string;
  project: string;
  scheduleKind: ScheduleKind;
  scheduleDays: number[]; // 0 = Sunday
  scheduleTime: string; // "HH:MM", 24h
  allowed: Allowed;
  mode: WorkMode;
  maxMinutes: number;
  model: Model;
  notify: NotifyOn[]; // empty = never
  enabled: boolean;
  paused: boolean;
  kind: AgentKind;
  nextRunAt: number | null;
  createdAt: number;
};

export type AgentInput = Omit<Agent, "id" | "slug" | "kind" | "nextRunAt" | "createdAt" | "paused">;

export type RunStatus = "queued" | "working" | "waiting" | "review" | "done" | "stopped";

export type StepState = "done" | "now" | "todo";
export type Step = { label: string; state: StepState };

export type Run = {
  id: number;
  agentId: number;
  task: string;
  mode: WorkMode;
  trigger: "manual" | "schedule" | "workflow";
  status: RunStatus;
  stopReason: string | null;
  result: string | null;
  plan: string | null;
  sessionId: string | null;
  branch: string | null;
  worktree: string | null;
  prUrl: string | null;
  steps: Step[];
  activity: string | null;
  pid: number | null;
  startedAt: number;
  endedAt: number | null;
  workflowRunId: number | null;
  stepId: string | null;
  costUsd: number;
  tokens: number;
  dismissed: boolean;
  extra: RunExtra;
};

// Per-run overrides, used by workflow steps (and saved so a queued run can start after a restart).
export type RunExtra = {
  label?: string; // what the run is called in the panel, e.g. "Review"
  role?: "agent" | "research" | "review" | "quick";
  prompt?: string; // replaces the agent's own prompt
  allowed?: Allowed;
  model?: Model;
  maxMinutes?: number;
  worktree?: string; // reuse this folder (workflow runs share one)
  branch?: string;
  baseRef?: string;
  project?: string;
};

export type Approval = {
  id: number;
  runId: number;
  kind: "tool" | "plan";
  toolName: string | null;
  summary: string;
  detail: string | null;
  status: "pending" | "allowed" | "denied";
  message: string | null;
  createdAt: number;
  decidedAt: number | null;
};

export type PillStatus = "working" | "needs" | "done" | "stopped" | "scheduled" | "paused" | "off" | "ready" | "queued" | "running" | "on";

// What the home page and agent page need to draw one agent.
export type AgentView = {
  agent: Agent;
  status: PillStatus;
  task: string;
  summary: string;
  waitingForOk: boolean;
  timeLabel: string;
  activeRun: Run | null;
  pendingApproval: Approval | null;
};

export type HeartbeatRun = {
  at: number; // ms
  onTime: boolean;
  reply: string | null;
};

export type HeartbeatInfo = {
  loaded: boolean;
  running: boolean;
  lastExitCode: number | null;
  todayRuns: HeartbeatRun[];
  expectedToday: number;
  onTimeToday: number;
  recent: HeartbeatRun[];
  errLogTail: string;
  outLogTail: string;
};

// ---------- usage ----------

export type UsageWindow = { pct: number; resetsAt: number | null };

export type UsageState = {
  session: UsageWindow | null; // the 5-hour window Claude Code calls "current session"
  week: UsageWindow | null;
  limited: boolean; // out of usage right now
  limitedUntil: number | null;
  exact: boolean; // false = our best estimate, shown as "about"
  source: "usage-command" | "run" | "limit-error" | "none";
  updatedAt: number;
};

export type UsageBreakdown = { name: string; color: string; share: number; runs: number; unit?: [string, string] }[]; // unit: e.g. ["reply", "replies"]

export type UsageView = {
  state: UsageState;
  blocked: boolean; // new runs wait
  blockedReason: string | null;
  guardPct: number | null;
  queued: number;
  byAgent: UsageBreakdown;
  byWorkflow: UsageBreakdown;
};

export type HeaderState = {
  inboxCount: number;
  pausedAll: boolean;
  usage: UsageView;
  tourDone: boolean;
};

// ---------- workflows ----------

export type StepType = "start" | "agent" | "research" | "review" | "check" | "ask" | "ship" | "tell";
export type StartTrigger = "manual" | "schedule" | "issue_label" | "pr_opened";
export type CheckKind = "tests" | "page" | "console";

export type WfStep = {
  id: string;
  type: StepType;
  // start
  trigger?: StartTrigger;
  scheduleKind?: Exclude<ScheduleKind, "manual">;
  scheduleDays?: number[];
  scheduleTime?: string;
  label?: string; // GitHub issue label
  // agent / research / review
  agentId?: number | null; // null = quick step
  prompt?: string;
  mode?: WorkMode;
  maxMinutes?: number;
  model?: Model;
  // check
  checks?: CheckKind[];
  pagePath?: string; // "/" or a full https:// address
  // review + check: where "needs work" goes
  onFail?: string; // a step id, or "stop"
  // ask
  question?: string;
  // ship
  shipMode?: "ask" | "auto";
  // tell
  tellWhen?: "always" | "problems";
  openIssue?: boolean;
};

export type WfLimits = { maxLoops: number; maxMinutes: number; maxUsagePct: number };

export type Workflow = {
  id: number;
  name: string;
  project: string;
  enabled: boolean;
  steps: WfStep[];
  limits: WfLimits;
  nextRunAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type WorkflowInput = Pick<Workflow, "name" | "project" | "steps" | "limits">;

export type WfStepState = "todo" | "now" | "done" | "passed" | "needs_work" | "failed" | "skipped" | "waiting";

export type WfStepRun = {
  state: WfStepState;
  note: string | null; // the one-line "right now" text, or what it did
  runIds: number[];
  startedAt: number | null;
  endedAt: number | null;
  rounds: number;
  outcome?: "ok" | "problems";
};

export type WfRunStatus = "queued" | "running" | "needs" | "done" | "stopped";

export type WorkflowRun = {
  id: number;
  workflowId: number;
  status: WfRunStatus;
  test: boolean;
  input: string;
  trigger: "manual" | "schedule" | "issue" | "pr" | "test" | "idea";
  triggerRef: string | null;
  branch: string | null;
  worktree: string | null;
  prUrl: string | null;
  current: number;
  steps: WfStep[]; // snapshot of the workflow when the run started
  stepRuns: Record<string, WfStepRun>;
  loops: number;
  feedback: string | null;
  gates: Record<string, "passed" | "skipped" | "failed">;
  waiting: null | { kind: "ask" | "ship" | "usage" | "agent"; text: string; until?: number };
  stopReason: string | null;
  summary: string | null;
  usageStart: (UsageWindow & { carry?: number; last?: number }) | null;
  waitedMs: number;
  startedAt: number;
  endedAt: number | null;
};

export type WorkflowVersion = { id: number; workflowId: number; savedAt: number; note: string; def: WorkflowInput };

export type Idea = { id: number; text: string; createdAt: number };

// ---------- inbox ----------

export type InboxItem =
  | { key: string; kind: "approval"; at: number; title: string; who: string; color: string; icon: string; approvalId: number; text: string; detail: string | null; link: string }
  | { key: string; kind: "plan"; at: number; title: string; who: string; color: string; icon: string; runId: number; text: string; link: string }
  | { key: string; kind: "pr"; at: number; title: string; who: string; color: string; icon: string; runId: number; prUrl: string; text: string; link: string }
  | { key: string; kind: "failed"; at: number; title: string; who: string; color: string; icon: string; runId: number; agentId: number; text: string; link: string; canRetry: boolean }
  | { key: string; kind: "wf_ask" | "wf_ship"; at: number; title: string; who: string; color: string; icon: string; wfRunId: number; text: string; prUrl: string | null; link: string; test: boolean }
  | { key: string; kind: "wf_failed"; at: number; title: string; who: string; color: string; icon: string; wfRunId: number; workflowId: number; text: string; link: string };
