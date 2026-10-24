// The Helper chat bubble. Safe to import from client components (no server-only code here).
import type { AgentInput, WorkflowInput } from "./types";

// Where Nic is and what's on screen. Sent with every message.
export type HelperContext = {
  path: string;
  title?: string; // the page's own heading
  agentId?: number;
  workflowId?: number;
  wfRunId?: number; // the workflow run being looked at
  runId?: number; // a run that's open (e.g. a step's details)
  stepId?: string; // the selected workflow step
  stepLabel?: string;
  editing?: string; // "a new agent", "Builder's settings"…
  errors: string[]; // plain-word errors showing on the page
};

// Clickable things the Helper mentions: [[agent:3|Builder]]
export type ChipKind = "agent" | "run" | "workflow" | "wfrun" | "pr" | "page";

// Buttons the Helper suggests: [[button:retry_run:12|Try again]]. Nothing happens until Nic clicks.
export type ActionKind =
  | "retry_run" // a stopped agent run: same task, fresh run
  | "approve_plan" // run id
  | "allow" // approval id
  | "deny" // approval id
  | "run_agent" // agent id: Run now (its usual job)
  | "new_task" // agent id: opens New task with the task text filled in (label holds the text)
  | "coach_goal" // opens Start a task with the text filled in and the prompt coach checking it
  | "idea_help" // opens Start a task with "Help me think of ideas" showing
  | "test_run" // workflow id: opens the workflow with the Test run window
  | "resume_wfrun" // workflow run id: Pick up where it stopped
  | "approve_wfrun" // workflow run id waiting at Ask me
  | "ship_wfrun" // workflow run id waiting at Ship (risky)
  | "merge_pr" // run id with a pull request (risky)
  | "pause_all" // (risky)
  | "resume_all"
  | "open"; // a page path

export type HelperAction = { kind: ActionKind; ref: string; label: string; task?: string; risky?: boolean; confirm?: string };

export type HelperCard =
  | { type: "agent"; draft: AgentInput; sentence: string; problem: string | null }
  | { type: "workflow"; draft: WorkflowInput; sentence: string; steps: { title: string; icon: string; color: string }[]; problem: string | null };

export type HelperMeta = {
  context?: string; // a short "on the Builder page" note on Nic's messages
  chips?: Record<string, { href: string; label: string; external?: boolean } | null>; // "agent:3" → link; null = doesn't exist
  actions?: HelperAction[];
  cards?: HelperCard[];
  created?: { index: number; kind: "agent" | "workflow"; id: number; href: string }[]; // cards Nic pressed Create it on
  tools?: string[]; // what it looked up, in plain words
  waiting?: { question: string; ctx: HelperContext; userMsgId: number; until: number }; // out of usage: answered by itself after the reset
};

export type HelperMessage = {
  id: number;
  chatId: number;
  role: "user" | "helper";
  text: string;
  status: "streaming" | "done" | "error";
  meta: HelperMeta;
  createdAt: number;
};

export type HelperChat = { id: number; title: string; createdAt: number; updatedAt: number };

export type HelperState = {
  chat: HelperChat | null;
  messages: HelperMessage[];
  chats: HelperChat[];
  outOfUsage: { until: number | null } | null;
  suggestions?: string[];
};

// One line of the reply stream.
export type HelperStreamEvent =
  | { t: "text"; text: string } // the whole reply so far
  | { t: "status"; text: string } // "Reading the log…"
  | { t: "done"; message: HelperMessage };
