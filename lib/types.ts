// Shared types. Safe to import from client components (no server-only code here).

export type ScheduleKind = "manual" | "hourly" | "daily" | "days";
export type Allowed = "look" | "suggest" | "make";
export type WorkMode = "auto" | "plan" | "ask" | "look";
export type Model = "sonnet" | "opus";
export type NotifyOn = "finished" | "needs_ok" | "problems";
export type AgentKind = "claude" | "heartbeat";

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

export type RunStatus = "working" | "waiting" | "review" | "done" | "stopped";

export type StepState = "done" | "now" | "todo";
export type Step = { label: string; state: StepState };

export type Run = {
  id: number;
  agentId: number;
  task: string;
  mode: WorkMode;
  trigger: "manual" | "schedule";
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

export type PillStatus = "working" | "needs" | "done" | "stopped" | "scheduled" | "paused" | "off" | "ready";

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
