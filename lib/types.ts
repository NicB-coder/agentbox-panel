// Shared types. Safe to import from client components (no server-only code here).

export type ScheduleKind = "manual" | "hourly" | "daily" | "days";
export type Allowed = "look" | "suggest" | "make";
export type WorkMode = "auto" | "plan" | "ask" | "look";
export type Model = "sonnet" | "opus";
export type NotifyOn = "finished" | "needs_ok" | "problems";
export type AgentKind = "claude" | "heartbeat" | "helper"; // helper: hidden, runs workflow steps that have no agent of their own

// v3: one agent per job. "Freedom" replaces "allowed to do" + "how should it work with me".
export type Freedom = "look" | "check" | "auto";
export type JobKind = "build" | "research";

export type JobSettings = {
  kind: JobKind;
  careful: boolean; // build → review → fix → polish → final review
  askEachStep: boolean;
  connectors: string[]; // connector ids it may use
  big: boolean; // milestone by milestone, with a usage budget instead of a time cap
  budgetPct: number; // big jobs: most of the weekly usage it may use, in points
  holdSmall: boolean; // big jobs: hold small scheduled runs while it works
  autoInstall: boolean; // big jobs on agentbox-panel: install when finished
  saveReport: boolean; // research: save the report in the project as a pull request
  brief: string | null; // name of an attached brief file
};

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
  archived: boolean;
  job: JobSettings;
};

export type AgentInput = Omit<Agent, "id" | "slug" | "kind" | "nextRunAt" | "createdAt" | "paused" | "archived" | "job"> & { job?: JobSettings };

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
  // v3
  followUp?: boolean; // continues the job: same branch and pull request if one is open
  jobStart?: boolean; // the first run of a job: its task is the job itself
  careful?: boolean;
  connectors?: string[];
  big?: boolean;
  // the run engine (v3): which session is going, where it is in Careful mode, waits and limits
  flow?: Flow;
  proc?: ProcState;
  seq?: number; // how many sessions this run has started
  resume?: { phase: Phase; prompt: string; session: string | null; until: number; why: "usage" | "restart" | "signin" };
  last?: { phase: Phase; prompt: string; session: string | null }; // what was going when it stopped, for Keep going
  activeMs?: number; // time it has spent working (not waiting for Nic or for usage)
  lastTickAt?: number;
  stopReq?: string | null;
  outOfTime?: boolean;
  overBudget?: boolean;
  signIn?: "claude" | "github";
  held?: boolean; // a scheduled run held back while a big job works
  waitedFor?: string; // why it's queued, in words
  usageStartWeek?: number | null; // big jobs: the weekly meter when it started
  onBranch?: { branch: string; prUrl: string }; // work on someone else's pull request branch
  checkoutRef?: string; // look at this ref (e.g. a pull request's branch) instead of making a new branch
  prReview?: { prUrl: string; sourceRunId: number | null }; // this run reviews a pull request
  review?: { runId: number; status: "running" | "done" | "stopped"; verdict?: "passed" | "needs work"; text?: string; at: number }; // a review of this run's pull request
  // v3.1
  quiet?: Quiet; // it finished but didn't really do anything: the Inbox says so
  quick?: boolean; // it opened a pull request in under 2 minutes: worth a closer look
};

export type Phase = "plan" | "work" | "review" | "fix" | "polish" | "final" | "outline" | "milestone";

export type ReviewNote = { kind: "review" | "final"; verdict: "passed" | "needs work"; text: string; at: number; model: Model };

export type Milestone = { title: string; state: "todo" | "now" | "done"; summary?: string };

export type Flow = {
  careful: boolean;
  stage: Phase;
  round: number; // review rounds done
  fixes: number; // fix passes made
  reviews: ReviewNote[];
  polished: boolean;
  workSession: string | null; // the builder's conversation, continued for fixes and polish
  lastFix?: boolean;
  fixedSinceReview?: boolean; // a fix came after the last review
  workSummary?: string; // what the build itself did (fix and polish write their own summaries)
  subSteps?: Step[]; // the builder's own plan while it builds (Careful mode)
  big?: { milestones: Milestone[]; index: number; handoff: string; weekCarry: number; weekStart: number | null; lastWeek: number | null; budgetPct: number };
};

export type StreamState = { result: null | { text: string; isError: boolean; subtype: string }; sawStepMarker: boolean; edited: boolean; limited: boolean; authError: boolean };

export type ProcState = {
  key: string; label: string; out: string; err: string; exit: string; pidFile: string; plist: string | null; startedAt: number;
  phase: Phase; offset: number; state: StreamState; session: string | null; prompt: string;
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

export type PillStatus = "working" | "needs" | "done" | "stopped" | "scheduled" | "paused" | "off" | "ready" | "queued" | "running" | "on" | "timeout";

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
  pillLabel?: string; // e.g. "Ran out of time"
  progress?: { step: number; of: number; label: string } | null; // "step 3 of 5"
  elapsedMs?: number; // time so far
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
  task?: string; // start step: what this workflow should make (the default task for Run now, Test run and automatic runs)
  // agent / research / review
  agentId?: number | null; // null = quick step
  prompt?: string;
  mode?: WorkMode;
  maxMinutes?: number;
  model?: Model;
  freedom?: Freedom; // agent steps (v3): replaces mode
  careful?: boolean; // agent steps (v3): build → review → fix inside the step
  connectors?: string[]; // agent steps (v3): apps it may use
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
  quiet: Quiet | null; // it finished but didn't really do anything: the Inbox says so
};

// "It finished without changing anything": what happened and what to do next, in plain words.
export type Quiet = { why: string; next: string };

export type WorkflowVersion = { id: number; workflowId: number; savedAt: number; note: string; def: WorkflowInput };

export type Idea = { id: number; text: string; createdAt: number };

// ---------- inbox ----------

export type InboxItem =
  | { key: string; kind: "approval"; at: number; title: string; who: string; color: string; icon: string; approvalId: number; text: string; detail: string | null; link: string }
  | { key: string; kind: "plan"; at: number; title: string; who: string; color: string; icon: string; runId: number; text: string; link: string }
  | { key: string; kind: "pr"; at: number; title: string; who: string; color: string; icon: string; runId: number; prUrl: string; text: string; link: string; careful: string | null; reviewedHere: boolean; review: RunExtra["review"] | null; quick: boolean }
  | { key: string; kind: "failed"; at: number; title: string; who: string; color: string; icon: string; runId: number; agentId: number; text: string; link: string; canRetry: boolean; canContinue: boolean; stopKind: "time" | "budget" | "signin" | "error"; signIn?: "claude" | "github" }
  | { key: string; kind: "wf_ask" | "wf_ship"; at: number; title: string; who: string; color: string; icon: string; wfRunId: number; text: string; prUrl: string | null; link: string; test: boolean }
  | { key: string; kind: "wf_failed"; at: number; title: string; who: string; color: string; icon: string; wfRunId: number; workflowId: number; text: string; link: string }
  | { key: string; kind: "quiet"; at: number; title: string; who: string; color: string; icon: string; runId?: number; wfRunId?: number; text: string; next: string; said: string | null; link: string; canRetry: boolean };
