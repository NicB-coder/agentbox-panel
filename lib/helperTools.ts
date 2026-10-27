import { execFile } from "node:child_process";
import { getAgent, getRun, getWfRun, getWorkflow, listRunsForWorkflowRun, listWfRuns, pendingApprovalForRun } from "./db";
import { readHeartbeat } from "./heartbeat";
import { agentRunsText, cleanLog, runLine, when, wfRunLine } from "./helperSnapshot";
import { projectInfos } from "./projectsAdmin";
import { readLog } from "./runner";
import { STEP_INFO, CHECK_WORDS, TRIGGER_WORDS, flowSentence, stepSubtitle, stepTitle } from "./wf";
import { agentRefs } from "./workflowViews";
import { ALLOWED_WORDS, MODE_WORDS, NOTIFY_WORDS, agentSentence, plainText, scheduleWords } from "./words";

// The Helper's read-only lookups. Each one only reads; none of them can change anything.
// They're served on 127.0.0.1 (/api/helper/tools) and handed to Claude through a tiny MCP server.

export type ToolDef = { name: string; description: string; inputSchema: Record<string, unknown>; doing: string };

const id = (what: string) => ({ type: "object", properties: { id: { type: "integer", description: what } }, required: ["id"] });

export const TOOLS: ToolDef[] = [
  { name: "run_log", description: "The full log of one agent run (the end part if it's very long). Use it to explain why a run stopped or what it did.", inputSchema: id("The run id, from [run N]"), doing: "Reading the log…" },
  { name: "run_details", description: "Everything about one agent run: task, status, steps, plan, result, why it stopped, pull request, pending questions.", inputSchema: id("The run id"), doing: "Looking at the run…" },
  { name: "agent_settings", description: "One agent's full instructions and settings in plain words, plus its last 10 runs.", inputSchema: id("The agent id, from [agent N]"), doing: "Checking the agent's settings…" },
  { name: "workflow_details", description: "One workflow's steps with every setting, its limits, and its last runs.", inputSchema: id("The workflow id, from [workflow N]"), doing: "Looking at the workflow…" },
  { name: "workflow_run", description: "One workflow run step by step: what each step did, notes, gates, what it's waiting for, and the agent runs inside it.", inputSchema: id("The workflow run id, from [wfrun N]"), doing: "Looking at the workflow run…" },
  {
    name: "pull_request", description: "The live status of a GitHub pull request (open/merged/closed, draft, checks, can it merge, last comments), via the gh tool.",
    inputSchema: { type: "object", properties: { url: { type: "string", description: "The pull request's https://github.com/... address" } }, required: ["url"] }, doing: "Checking the pull request on GitHub…",
  },
  { name: "projects", description: "The projects on this Mac with their open pull requests and last change.", inputSchema: { type: "object", properties: {} }, doing: "Looking at your projects…" },
  { name: "heartbeat", description: "The hourly heartbeat job: today's check-ins, whether each was on time, and its error log.", inputSchema: { type: "object", properties: {} }, doing: "Checking the heartbeat…" },
];

export async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  const n = Math.round(Number(args.id));
  switch (name) {
    case "run_log": {
      const r = getRun(n);
      if (!r) return `There's no run ${n}.`;
      const lines = cleanLog(readLog(n));
      if (!lines.length) return "This run's log is empty.";
      const text = lines.join("\n");
      return text.length > 24_000 ? `(only the last part; the log is long)\n…${text.slice(-24_000)}` : text;
    }
    case "run_details": {
      const r = getRun(n);
      if (!r) return `There's no run ${n}.`;
      const out = [runLine(r)];
      if (r.plan) out.push("", "Plan:", plainText(r.plan).slice(0, 4000));
      if (r.result) out.push("", "Result:", plainText(r.result).slice(0, 4000));
      const ap = pendingApprovalForRun(r.id);
      if (ap) out.push("", `Waiting for Nic to Allow or Deny [approval ${ap.id}]: ${ap.summary}${ap.detail ? `\n${ap.detail.slice(0, 1500)}` : ""}`);
      if (r.branch) out.push(`Branch: ${r.branch}`);
      return out.join("\n");
    }
    case "agent_settings": {
      const a = getAgent(n);
      if (!a || a.kind === "helper") return `There's no agent ${n}.`;
      if (a.kind === "heartbeat") return `${a.name} is the existing hourly check-in job. The panel shows it read-only (no Run now, Pause or Edit). Use the heartbeat tool for its check-ins.`;
      return [
        `[agent ${a.id}] ${a.name} · project ${a.project} · ${a.enabled ? (a.paused ? "paused" : "on") : "switched off"}`,
        `Summary line from the editor: ${agentSentence(a)}`,
        `When it runs: ${scheduleWords(a.scheduleKind, a.scheduleDays, a.scheduleTime)}`,
        `Allowed to do: ${ALLOWED_WORDS[a.allowed].label} (${ALLOWED_WORDS[a.allowed].hint})`,
        `How it works with Nic: ${MODE_WORDS[a.mode].label} (${MODE_WORDS[a.mode].hint})`,
        `Limits: up to ${a.maxMinutes} minutes · ${a.model === "opus" ? "Smartest (Opus)" : "Fast (Sonnet)"}`,
        `Tells Nic when: ${a.notify.length ? a.notify.map((x) => NOTIFY_WORDS[x]).join(", ") : "Never"}`,
        "",
        "Its instructions (What should this agent do?):",
        a.prompt,
        "",
        "Last runs:",
        agentRunsText(a.id),
      ].join("\n");
    }
    case "workflow_details": {
      const w = getWorkflow(n);
      if (!w) return `There's no workflow ${n}.`;
      const agents = agentRefs();
      const steps = w.steps.map((s, i) => {
        const bits = [`${i + 1}. [step ${s.id}] ${stepTitle(s, agents)} (${STEP_INFO[s.type].title}): ${stepSubtitle(s, w.steps, agents)}`];
        if (s.type === "start") bits.push(`   starts: ${TRIGGER_WORDS[s.trigger ?? "manual"]}`);
        if (s.prompt) bits.push(`   note: ${s.prompt.slice(0, 600)}`);
        if (s.mode) bits.push(`   works: ${MODE_WORDS[s.mode].label}`);
        if (s.checks) bits.push(`   checks: ${s.checks.map((c) => CHECK_WORDS[c]).join(", ")}`);
        if (s.question) bits.push(`   asks: ${s.question}`);
        return bits.join("\n");
      });
      return [
        `[workflow ${w.id}] ${w.name} · ${w.enabled ? "On" : "Off"} · project ${w.project}`,
        flowSentence(w, agents),
        `Limits: send back up to ${w.limits.maxLoops} times · at most ${w.limits.maxMinutes} minutes per run · Most usage per run about ${w.limits.maxUsagePct}% of the “This session” usage meter, added up across resets`,
        "",
        "Steps:",
        ...steps,
        "",
        "Last runs:",
        ...(listWfRuns(w.id, 8).map((r) => `- ${wfRunLine(r)}`) || []),
      ].join("\n");
    }
    case "workflow_run": {
      const wr = getWfRun(n);
      if (!wr) return `There's no workflow run ${n}.`;
      const runs = listRunsForWorkflowRun(wr.id);
      return [
        wfRunLine(wr),
        Object.keys(wr.gates).length ? `Gates: ${Object.entries(wr.gates).map(([k, v]) => `${k} ${v}`).join(", ")}` : "",
        wr.feedback ? `Feedback being passed back: ${plainText(wr.feedback).slice(0, 1500)}` : "",
        `Rounds of "needs work" so far: ${wr.loops}`,
        "",
        "Agent runs inside it:",
        ...runs.map((r) => `- ${runLine(r)}`),
      ].filter(Boolean).join("\n");
    }
    case "pull_request": {
      const url = String(args.url ?? "");
      if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/.test(url)) return "That isn't a GitHub pull request address.";
      return await gh(["pr", "view", url, "--json", "number,title,state,isDraft,mergeable,reviewDecision,statusCheckRollup,comments,url,mergedAt,closedAt"]).then((out) => {
        try {
          const j = JSON.parse(out);
          const checks = (j.statusCheckRollup ?? []) as { name?: string; conclusion?: string; status?: string }[];
          const comments = (j.comments ?? []) as { author?: { login?: string }; body?: string }[];
          return [
            `#${j.number} ${j.title}`,
            `State: ${j.state}${j.isDraft ? " (draft)" : ""}${j.mergedAt ? `, merged ${when(Date.parse(j.mergedAt))}` : ""}${j.closedAt && !j.mergedAt ? `, closed ${when(Date.parse(j.closedAt))}` : ""}`,
            `Can merge: ${j.mergeable}`,
            j.reviewDecision ? `Review: ${j.reviewDecision}` : "",
            checks.length ? `Checks: ${checks.map((c) => `${c.name} ${c.conclusion || c.status}`).join(", ")}` : "No automatic checks.",
            comments.length ? `Last comments:\n${comments.slice(-3).map((c) => `- ${c.author?.login}: ${plainText(c.body ?? "").slice(0, 600)}`).join("\n")}` : "No comments.",
          ].filter(Boolean).join("\n");
        } catch {
          return out || "GitHub didn't answer. Try again in a moment.";
        }
      });
    }
    case "projects": {
      const infos = await projectInfos();
      if (!infos.length) return "No projects yet. They're added on the Projects page.";
      return infos.map((p) => `- ${JSON.stringify(p)}`).join("\n");
    }
    case "heartbeat": {
      const hb = readHeartbeat();
      return [
        `Switched on: ${hb.loaded ? "yes" : "no"} · running right now: ${hb.running ? "yes" : "no"} · last exit code: ${hb.lastExitCode ?? "none"}`,
        `Today: ${hb.onTimeToday} of ${hb.expectedToday} on time`,
        "Recent check-ins:",
        ...hb.recent.slice(0, 12).map((r) => `- ${when(r.at)} · ${r.onTime ? "on time" : "late"}${r.reply ? ` · said: ${r.reply.slice(0, 200)}` : ""}`),
        hb.errLogTail ? `Error log (end):\n${hb.errLogTail.slice(-1500)}` : "Error log is empty.",
      ].join("\n");
    }
  }
  return `There's no tool called ${name}.`;
}

function gh(args: string[]): Promise<string> {
  return new Promise((resolve) =>
    execFile("gh", args, { timeout: 20_000, env: { ...process.env, PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin" } }, (e, out, err) =>
      resolve(e ? `GitHub said: ${String(err).trim().slice(0, 300) || "no answer"}` : String(out)),
    ),
  );
}

