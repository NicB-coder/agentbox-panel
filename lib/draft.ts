import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import type { WfStep } from "./types";
import { addRunUsageless } from "./draftUsage";
import { cleanLimits, cleanSteps, type AgentRef } from "./wf";
import { ingestRateLimitEvent } from "./usage";

// "Change the steps in your own words": Claude (headless, no tools at all, so it can only read and answer)
// turns Nic's sentence about the steps into workflow steps. The goal is asked for separately, once.

const PATH = [path.join(os.homedir(), ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].join(":");

const SCHEMA = {
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
    "A workflow is a straight row of steps. The first step is always type \"start\". Step types:",
    "- start: what starts it. trigger: manual (\"when I give it an idea/task\"), schedule (scheduleKind hourly|daily|days, scheduleTime \"HH:MM\" 24h, scheduleDays 0=Sun..6=Sat for \"days\"), issue_label (label, e.g. \"agent\"), pr_opened.",
    "- agent: one of Nic's agents does work. agentId = one of the ids below, or null for a quick step with its own short prompt. mode: auto (default), plan, ask, look (only reports, changes nothing).",
    "- research: looks things up and writes research.md for later steps. Optional prompt with focus notes.",
    "- review: a reviewer checks the work against the task and research.md; result is passed or needs work. Use model \"opus\". onFail = the id of an EARLIER step to send work back to (usually the build step), or \"stop\".",
    "- check: hard gates run by the app: checks = tests | page | console. onFail like review.",
    "- ask: waits for Nic's OK (question = short text).",
    "- ship: merges the pull request. shipMode \"ask\" unless Nic clearly says to ship automatically.",
    "- tell: Discord message to Nic. tellWhen always|problems. openIssue true to also open a GitHub issue about problems.",
    "",
    "Leave the start step's task empty: the goal is stored separately. Give every step a short unique id like \"s1\", \"s2\" so onFail can point at one. Use only the steps the description needs (usually 3 to 8). If they mention building or coding, use an agent step with the builder agent. Prefer \"ask\" before \"ship\". maxLoops is how many times needs-work may loop (default 2).",
    "",
    "Nic's agents:",
    ...agents.map((a) => `- id ${a.id}: ${a.name}${a.allowed === "look" ? " (look only, reports)" : ""}`),
  ].join("\n");
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
  const env: NodeJS.ProcessEnv = { ...process.env, PATH };
  for (const k of Object.keys(env)) if (k === "CLAUDECODE" || k.startsWith("CLAUDE_CODE_") || k === "ANTHROPIC_API_KEY") delete env[k];
  const args = [
    "-p", draftPrompt(text, goal),
    "--output-format", "stream-json", "--verbose",
    "--model", "sonnet",
    "--tools", "",
    "--permission-mode", "dontAsk",
    "--no-session-persistence",
    "--append-system-prompt", instructions(agents),
    "--json-schema", JSON.stringify(SCHEMA),
  ];
  const stdout = await new Promise<string>((resolve, reject) => {
    execFile("claude", args, { cwd: os.tmpdir(), env, timeout: 180_000, maxBuffer: 20 * 1024 * 1024 }, (e, out, err) => {
      if (e && !out) reject(new Error(/usage limit|hit your limit/i.test(String(err) + String(out)) ? "You're out of Claude usage right now. Try again after it resets." : "Claude couldn't draft it this time. Try again, or start from a template."));
      else resolve(String(out));
    });
  });
  let result: Record<string, unknown> | null = null;
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const ev = JSON.parse(line);
      if (ev.type === "rate_limit_event") ingestRateLimitEvent(ev.rate_limit_info ?? {});
      if (ev.type === "result") {
        addRunUsageless(Number(ev.total_cost_usd ?? 0));
        if (ev.is_error) throw new Error(/limit/i.test(String(ev.result)) ? "You're out of Claude usage right now. Try again after it resets." : "Claude couldn't draft it this time. Try again, or start from a template.");
        result = (ev.structured_output as Record<string, unknown>) ?? null;
        if (!result && typeof ev.result === "string") {
          const m = ev.result.match(/\{[\s\S]*\}/);
          if (m) result = JSON.parse(m[0]);
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Claude")) throw e;
      if (e instanceof Error && e.message.startsWith("You're out")) throw e;
    }
  }
  if (!result || !Array.isArray(result.steps)) throw new Error("Claude couldn't draft it this time. Try again, or start from a template.");
  const steps = cleanSteps(result.steps, agents.map((a) => a.id));
  if (steps.length < 2) throw new Error("Claude couldn't find any steps in that. Try saying what should happen, one thing after another.");
  return { name: String(result.name ?? "").slice(0, 60) || "New workflow", steps, limits: cleanLimits({ maxLoops: result.maxLoops }) };
}
