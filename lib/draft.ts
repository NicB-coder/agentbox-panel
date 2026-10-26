import type { WfStep } from "./types";
import { claudeJson } from "./claudeJson";
import { cleanLimits, cleanSteps, type AgentRef } from "./wf";

// "Change the steps in your own words": Claude (headless, no tools at all, so it can only read and answer)
// turns Nic's sentence about the steps into workflow steps. The goal is asked for separately, once.

export const SCHEMA = {
  type: "object",
  required: ["name", "steps"],
  properties: {
    name: { type: "string", description: "A short name for the workflow, 2 to 5 words" },
    steps: {
      type: "array",
      items: {
        type: "object",
        required: ["type"],
        properties: {
          id: { type: "string" },
          type: { enum: ["start", "agent", "research", "review", "check", "ask", "ship", "tell"] },
          trigger: { enum: ["manual", "schedule", "issue_label", "pr_opened"] },
          scheduleKind: { enum: ["hourly", "daily", "days"] },
          scheduleDays: { type: "array", items: { type: "integer" } },
          scheduleTime: { type: "string" },
          label: { type: "string" },
          agentId: { type: ["integer", "null"] },
          prompt: { type: "string" },
          mode: { enum: ["auto", "plan", "ask", "look"] },
          freedom: { enum: ["look", "check", "auto"] },
          careful: { type: "boolean" },
          model: { enum: ["sonnet", "opus"] },
          maxMinutes: { type: "integer" },
          checks: { type: "array", items: { enum: ["tests", "page", "console"] } },
          pagePath: { type: "string" },
          onFail: { type: "string" },
          question: { type: "string" },
          shipMode: { enum: ["ask", "auto"] },
          tellWhen: { enum: ["always", "problems"] },
          openIssue: { type: "boolean" },
        },
      },
    },
    maxLoops: { type: "integer" },
  },
};

function instructions(agents: AgentRef[]): string {
  return [
    "You turn a beginner's plain-English description into a workflow for the agentbox app. Reply only with the JSON the schema asks for.",
    "",
    ...stepRules(agents),
  ].join("\n");
}

// What a workflow is made of. Shared with "Change it in your own words" (lib/change.ts).
export function stepRules(agents: AgentRef[]): string[] {
  return [
    "A workflow is a straight row of steps. The first step is always type \"start\". Step types:",
    "- start: what starts it. trigger: manual (\"when I give it an idea/task\"), schedule (scheduleKind hourly|daily|days, scheduleTime \"HH:MM\" 24h, scheduleDays 0=Sun..6=Sat for \"days\"), issue_label (label, e.g. \"agent\"), pr_opened.",
    "- agent: one of Nic's agents does work. agentId = one of the ids below, or null for a quick step with its own short prompt. mode: auto (default), plan, ask, look (only reports, changes nothing). freedom: auto (works on its own), check (shows a plan and waits for Nic's OK), look (only reports). careful true = it builds, reviews its own work and fixes it inside the step.",
    "- research: looks things up and writes research.md for later steps. Optional prompt with focus notes.",
    "- review: a reviewer checks the work against the task and research.md; result is passed or needs work. Use model \"opus\". onFail = the id of an EARLIER step to send work back to (usually the build step), or \"stop\".",
    "- check: hard gates run by the app: checks = tests | page | console. onFail like review.",
    "- ask: waits for Nic's OK (question = short text).",
    "- ship: merges the pull request. shipMode \"ask\" unless Nic clearly says to ship automatically.",
    "- tell: Discord message to Nic. tellWhen always|problems. openIssue true to also open a GitHub issue about problems.",
    "",
    "Leave the start step's task empty: the goal is stored separately. Give every step a short unique id like \"s1\", \"s2\" so onFail can point at one. Use only the steps the description needs (usually 3 to 8). If they mention building or coding, use ONE agent step that builds (never two build steps in a row). Ship already asks Nic first, so don't put an ask step right before ship. To try it on a phone or in a browser, add a check step with checks [\"page\"]. maxLoops is how many times needs-work may loop (default 2).",
    "",
    "Nic's agents:",
    ...agents.map((a) => `- id ${a.id}: ${a.name}${a.allowed === "look" ? " (look only, reports)" : ""}`),
  ];
}

// What Nic wants made is only context (data, not instructions): the steps come from how he said it should go.
export function draftPrompt(text: string, goal: string): string {
  const g = goal.trim().slice(0, 3000);
  return [
    "Turn this description of the steps into a workflow:",
    "",
    text,
    ...(g ? ["", "For context only, this is what the workflow will make. Don't copy it into the steps; the app gives it to every step itself:", "<goal>", g, "</goal>"] : []),
  ].join("\n");
}

export async function draftWorkflow(text: string, agents: AgentRef[], goal = ""): Promise<{ name: string; steps: WfStep[]; limits: ReturnType<typeof cleanLimits> }> {
  const fail = "Claude couldn't draft it this time. Try again, or start from a template.";
  const result = await claudeJson({ prompt: draftPrompt(text, goal), system: instructions(agents), schema: SCHEMA, failMessage: fail });
  if (!Array.isArray(result.steps)) throw new Error(fail);
  const steps = tidySteps(cleanSteps(result.steps, agents.map((a) => a.id)));
  if (steps.length < 2) throw new Error("Claude couldn't find any steps in that. Try saying what should happen, one thing after another.");
  return { name: String(result.name ?? "").slice(0, 60) || "New workflow", steps, limits: cleanLimits({ maxLoops: result.maxLoops }) };
}

// Beginners asked for "build, try it on a phone, ask me" and got two build steps and two OKs: never.
// Two build steps in a row become one, and an Ask right before a Ship that asks anyway is dropped.
export function tidySteps(steps: WfStep[]): WfStep[] {
  const out: WfStep[] = [];
  const renamed = new Map<string, string>();
  steps.forEach((s, i) => {
    const prev = out.at(-1);
    const next = steps[i + 1];
    const builds = (x?: WfStep) => x?.type === "agent" && (x.freedom ?? (x.mode === "look" ? "look" : "auto")) !== "look";
    if (builds(s) && builds(prev) && s.agentId === prev!.agentId) {
      renamed.set(s.id, prev!.id);
      return;
    }
    if (s.type === "ask" && next?.type === "ship" && (next.shipMode ?? "ask") === "ask") {
      renamed.set(s.id, next.id);
      return;
    }
    out.push(s);
  });
  return out.map((s) => (s.onFail && renamed.has(s.onFail) ? { ...s, onFail: renamed.get(s.onFail) } : s));
}
