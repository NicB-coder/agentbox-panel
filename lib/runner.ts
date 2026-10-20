import { execFile, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  LOG_DIR, activeRun, createRun, denyPendingForRun, getAgent, getRun, pendingApprovalForRun, runsWithStatus, updateRun,
} from "./db";
import { notify } from "./notify";
import { projectPath } from "./projects";
import type { Agent, Allowed, Run, Step, WorkMode } from "./types";

// One run = a git worktree on its own branch + a headless Claude Code session in it.
// Working → (Needs you while waiting for an OK) → Needs you (pull request open) → Done when merged.
// Anything that goes wrong ends in Stopped with a plain reason.

const WORKTREES = path.join(os.homedir(), "agents", "worktrees");
const HOOK = path.join(process.cwd(), "scripts", "agentbox-hook.mjs");
const PANEL_URL = `http://127.0.0.1:${process.env.PORT || 3000}`;
const PATH = [path.join(os.homedir(), ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":");

type Live = { child: ChildProcess; timer: NodeJS.Timeout | null; stopReason: string | null; phase: "plan" | "work" };
type G = typeof globalThis & { __agentboxLive?: Map<number, Live> };
const live: Map<number, Live> = ((globalThis as G).__agentboxLive ??= new Map());

// ---------- small helpers ----------

function sh(cmd: string, args: string[], cwd: string, timeout = 120_000): Promise<{ ok: boolean; out: string; err: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, timeout, env: { ...cleanEnv(), GIT_TERMINAL_PROMPT: "0" }, maxBuffer: 10 * 1024 * 1024 }, (e, stdout, stderr) =>
      resolve({ ok: !e, out: String(stdout).trim(), err: String(stderr).trim() }),
    );
  });
}

// Don't leak this process's own Claude Code session settings (if any) into agent runs.
function cleanEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const k of Object.keys(env)) if (k === "CLAUDECODE" || k.startsWith("CLAUDE_CODE_") || k === "ANTHROPIC_API_KEY") delete env[k];
  env.PATH = PATH;
  return env;
}

function logPath(runId: number) {
  return path.join(LOG_DIR, `${runId}.log`);
}

function log(runId: number, line: string) {
  const t = new Date().toLocaleTimeString("en-US", { hour12: false });
  fs.appendFileSync(logPath(runId), `[${t}] ${line}\n`);
}

export function readLog(runId: number): string {
  try {
    return fs.readFileSync(logPath(runId), "utf8");
  } catch {
    return "";
  }
}

function slug(s: string, n: number) {
  return s
    .toLowerCase()
    .replace(/\b(main|master)\b/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .slice(0, n)
    .join("-");
}

const lookOnly = (allowed: Allowed, mode: WorkMode) => allowed === "look" || mode === "look";

function defaultSteps(look: boolean): Step[] {
  const labels = look ? ["Look around", "Check the details", "Write up what it found"] : ["Understand the problem", "Make the changes", "Check that it works", "Send a pull request"];
  return labels.map((label, i) => ({ label, state: i === 0 ? "now" : "todo" }));
}

// ---------- starting a run ----------

export async function startRun(agentId: number, opts: { task?: string; mode?: WorkMode; trigger: Run["trigger"] }): Promise<Run> {
  const agent = getAgent(agentId);
  if (!agent || agent.kind !== "claude") throw new Error("This agent can't run tasks.");
  if (!agent.enabled) throw new Error("This agent is switched off. Turn it on in Edit first.");
  if (activeRun(agentId)) throw new Error("It's already working on something.");
  const repo = projectPath(agent.project);
  if (!repo) throw new Error(`Can't find the project "${agent.project}" on this Mac.`);

  const mode = opts.mode ?? agent.mode;
  const task = opts.task?.trim() || (opts.trigger === "schedule" ? "Scheduled run" : "Its usual job");
  const run = createRun({ agentId, task, mode, trigger: opts.trigger, steps: defaultSteps(lookOnly(agent.allowed, mode)) });
  log(run.id, `Run started by ${opts.trigger === "schedule" ? "the schedule" : "Nic"} · task: ${task} · mode: ${mode} · allowed: ${agent.allowed} · model: ${agent.model}`);

  // Prepare the worktree, then start Claude. Runs in the background; the page polls for progress.
  prepareAndSpawn(agent, run, repo).catch((e) => finishStopped(run.id, "It couldn't get started.", String(e)));
  return getRun(run.id)!;
}

async function baseRef(repo: string): Promise<string> {
  await sh("git", ["fetch", "origin", "--prune"], repo);
  const head = await sh("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], repo);
  if (head.ok && head.out) return head.out;
  for (const ref of ["origin/main", "origin/master", "HEAD"]) if ((await sh("git", ["rev-parse", "--verify", "--quiet", ref], repo)).ok) return ref;
  return "HEAD";
}

async function prepareAndSpawn(agent: Agent, run: Run, repo: string) {
  const base = await baseRef(repo);
  const branch = `agent/${agent.slug}-${slug(run.task, 4) || "run"}-${run.id}`;
  const dir = path.join(WORKTREES, agent.project, branch.replace(/\//g, "-"));
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const wt = await sh("git", ["worktree", "add", "-b", branch, dir, base], repo);
  if (!wt.ok) throw new Error(`git worktree add failed: ${wt.err}`);
  log(run.id, `Made a fresh copy on branch ${branch} from ${base} at ${dir}`);
  updateRun(run.id, { branch, worktree: dir, activity: "Reading the task…" });

  const first = run.mode === "plan" ? "plan" : "work";
  spawnClaude(agent, getRun(run.id)!, first, buildPrompt(agent, run));
}

function rules(agent: Agent, run: Run): string {
  const look = lookOnly(agent.allowed, run.mode);
  const lines = [
    `You are "${agent.name}", an AI agent started from Nic's agentbox panel. Nic is a high-school developer who reads your progress in the panel, so write for him in plain, friendly English without jargon.`,
    "",
    "Progress lines (the panel reads these, put each on its own line):",
    `- Before you start, write: PLAN: first step | second step | third step   (3 to 5 short plain-English steps such as "Understand the problem", "Make the changes", "Test it in a browser"${look ? "" : ". Don't include sending a pull request, the panel does that"}).`,
    "- Each time you begin a step, write: STEP: <its number, starting at 1>",
    "- At the very end, write: SUMMARY: <one plain-English sentence saying what you did or found>",
    "",
    `You are working in your own copy of the project${run.branch ? ` on the branch ${run.branch}` : ""}. Never push to main or master, never force push, and never touch secrets, tokens or passwords.`,
  ];
  if (look) lines.push("You may only LOOK: read, run read-only checks and report. Don't change, create or delete any files in the project, and don't commit or push. Your final message is the report Nic reads.");
  else if (agent.allowed === "suggest") lines.push("Make your changes in this copy and commit them with a clear message. Don't push and don't open a pull request; the panel pushes your branch and opens the pull request for Nic.");
  else lines.push(`You may commit and push to your own branch (git push origin ${run.branch}). Never push anywhere else. The panel opens the pull request for Nic.`);
  return lines.join("\n");
}

function buildPrompt(agent: Agent, run: Run): string {
  const job = `Your job, in Nic's words:\n${agent.prompt}`;
  if (run.task === "Its usual job" || run.task === "Scheduled run") return `${job}\n\nDo your job now.`;
  return `${job}\n\nThis time, Nic asked you to:\n${run.task}`;
}

function permissionMode(mode: WorkMode, phase: "plan" | "work"): string {
  if (phase === "plan") return "plan";
  if (mode === "ask") return "manual"; // every step that needs permission goes to Nic via the hook
  return "auto"; // auto, look (with write tools removed), and plan after approval
}

function spawnClaude(agent: Agent, run: Run, phase: "plan" | "work", prompt: string, resume?: string) {
  const look = lookOnly(agent.allowed, run.mode);
  const settings = {
    hooks: {
      PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: `node "${HOOK}"`, timeout: 30 }] }],
      PermissionRequest: [{ matcher: "*", hooks: [{ type: "command", command: `node "${HOOK}"`, timeout: 4 * 3600 }] }],
    },
  };
  const args = [
    "-p", prompt,
    "--output-format", "stream-json",
    "--verbose",
    "--model", agent.model,
    "--permission-mode", permissionMode(run.mode, phase),
    "--settings", JSON.stringify(settings),
    "--append-system-prompt", rules(agent, run),
  ];
  const deny = ["Bash(git push --force*)", "Bash(git push -f*)", "Bash(git push * main*)", "Bash(git push * master*)"];
  if (look) deny.push("Edit", "Write", "NotebookEdit", "Bash(git commit *)", "Bash(git push *)");
  else if (agent.allowed === "suggest") deny.push("Bash(git push *)", "Bash(gh pr create *)");
  args.push("--disallowedTools", ...deny);
  if (resume) args.push("--resume", resume);

  log(run.id, `Starting Claude Code (${phase === "plan" ? "planning" : "working"}, permission mode ${permissionMode(run.mode, phase)}${resume ? ", continuing the same session" : ""})`);
  const child = spawn("claude", args, {
    cwd: run.worktree!,
    env: { ...cleanEnv(), AGENTBOX_URL: PANEL_URL, AGENTBOX_RUN_ID: String(run.id), AGENTBOX_ALLOWED: look ? "look" : agent.allowed },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true, // own process group, so Stop takes down Claude and anything it started
  });
  const entry: Live = { child, timer: null, stopReason: null, phase };
  live.set(run.id, entry);
  updateRun(run.id, { pid: child.pid ?? null, status: "working" });

  armTimer(run.id, agent.maxMinutes, run.startedAt);

  const state = { result: null as null | { text: string; isError: boolean; subtype: string }, sawStepMarker: false, edited: false, stderr: "" };
  let buf = "";
  child.stdout!.setEncoding("utf8");
  child.stdout!.on("data", (chunk: string) => {
    buf += chunk;
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (line.trim()) onEvent(run.id, line, state);
    }
  });
  child.stderr!.setEncoding("utf8");
  child.stderr!.on("data", (c: string) => {
    state.stderr = (state.stderr + c).slice(-4000);
    log(run.id, `stderr: ${c.trim()}`);
  });
  child.on("error", (e) => {
    log(run.id, `Couldn't start Claude Code: ${e.message}`);
  });
  child.on("close", (code, signal) => {
    if (buf.trim()) onEvent(run.id, buf, state);
    const me = live.get(run.id);
    if (me?.timer) clearTimeout(me.timer);
    live.delete(run.id);
    onExit(run.id, phase, code, signal, me?.stopReason ?? null, state).catch((e) => finishStopped(run.id, "Something went wrong while wrapping up.", String(e)));
  });
}

// The time limit counts from when the run started. It never cuts Nic off mid-decision:
// while an OK is pending, it checks again a minute later.
function armTimer(runId: number, maxMinutes: number, startedAt: number) {
  const entry = live.get(runId);
  if (!entry) return;
  const left = Math.max(startedAt + maxMinutes * 60_000 - Date.now(), 5_000);
  entry.timer = setTimeout(function check() {
    if (!live.has(runId)) return;
    if (pendingApprovalForRun(runId)) {
      entry.timer = setTimeout(check, 60_000);
      return;
    }
    stopRun(runId, `It ran out of time (the limit is ${maxMinutes} minutes).`);
  }, left);
}

// ---------- reading Claude's stream ----------

const PLAIN_TOOL: Record<string, string> = {
  Read: "Reading the code",
  Grep: "Searching the code",
  Glob: "Looking through the files",
  Edit: "Making changes",
  MultiEdit: "Making changes",
  Write: "Writing a file",
  NotebookEdit: "Making changes",
  WebFetch: "Looking something up online",
  WebSearch: "Searching the web",
  TodoWrite: "Planning its next steps",
  Task: "Getting a helper to look into something",
  Agent: "Getting a helper to look into something",
};

type StreamState = { result: null | { text: string; isError: boolean; subtype: string }; sawStepMarker: boolean; edited: boolean; stderr: string };

function onEvent(runId: number, line: string, state: StreamState) {
  let ev: Record<string, unknown>;
  try {
    ev = JSON.parse(line);
  } catch {
    log(runId, line.slice(0, 2000));
    return;
  }
  const run = getRun(runId);
  if (!run) return;
  if (ev.type === "system" && ev.subtype === "init") {
    updateRun(runId, { sessionId: String(ev.session_id) });
    log(runId, `Session ${ev.session_id} · model ${ev.model} · permission mode ${ev.permissionMode}`);
    return;
  }
  if (ev.type === "assistant") {
    const content = ((ev.message as { content?: unknown[] })?.content ?? []) as { type: string; text?: string; name?: string; input?: Record<string, unknown> }[];
    for (const c of content) {
      if (c.type === "text" && c.text) {
        log(runId, `Claude: ${c.text}`);
        readMarkers(run, c.text, state);
      } else if (c.type === "tool_use" && c.name) {
        const input = c.input ?? {};
        log(runId, `Tool ${c.name}: ${JSON.stringify(input).slice(0, 1500)}`);
        let activity = PLAIN_TOOL[c.name] ?? "Working on it";
        if (c.name === "Bash") activity = typeof input.description === "string" && input.description ? sentence(input.description) : "Running a check";
        if (c.name.startsWith("mcp__")) activity = "Using a tool";
        updateRun(runId, { activity: `${activity}…` });
        // No progress lines from the agent? Move the default steps along by what it's doing.
        if (!state.sawStepMarker && /^(Edit|MultiEdit|Write|NotebookEdit)$/.test(c.name) && !state.edited) {
          state.edited = true;
          setStep(runId, 1);
        } else if (!state.sawStepMarker && state.edited && c.name === "Bash") setStep(runId, 2);
      }
    }
    return;
  }
  if (ev.type === "user") {
    const content = ((ev.message as { content?: unknown[] })?.content ?? []) as { type: string; content?: unknown; is_error?: boolean }[];
    for (const c of content) {
      if (c.type === "tool_result") {
        const text = typeof c.content === "string" ? c.content : JSON.stringify(c.content);
        log(runId, `${c.is_error ? "Tool error" : "Tool result"}: ${text.slice(0, 1500)}`);
      }
    }
    return;
  }
  if (ev.type === "result") {
    state.result = { text: String(ev.result ?? ""), isError: !!ev.is_error, subtype: String(ev.subtype ?? "") };
    if (ev.session_id) updateRun(runId, { sessionId: String(ev.session_id) });
    log(runId, `Finished: ${ev.subtype}${ev.is_error ? " (error)" : ""} · ${Math.round(Number(ev.duration_ms ?? 0) / 1000)}s · $${Number(ev.total_cost_usd ?? 0).toFixed(2)}`);
    return;
  }
  if (ev.type === "rate_limit_event") return;
  log(runId, `${ev.type}${ev.subtype ? `/${ev.subtype}` : ""}`);
}

function sentence(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/\.$/, "");
}

function readMarkers(run: Run, text: string, state: StreamState) {
  const plan = text.match(/^\s*PLAN:\s*(.+)$/m);
  if (plan) {
    const look = run.steps.length && run.steps[run.steps.length - 1].label !== "Send a pull request";
    const labels = plan[1].split("|").map((s) => s.trim().replace(/\*+/g, "")).filter(Boolean).slice(0, 6);
    if (labels.length) {
      if (!look) labels.push("Send a pull request");
      updateRun(run.id, { steps: labels.map((label, i) => ({ label, state: i === 0 ? "now" : "todo" })) });
      state.sawStepMarker = true;
    }
  }
  const steps = [...text.matchAll(/^\s*STEP:\s*(\d+)/gm)];
  if (steps.length) {
    state.sawStepMarker = true;
    setStep(run.id, Number(steps[steps.length - 1][1]) - 1);
  }
  const summary = text.match(/^\s*SUMMARY:\s*(.+)$/m);
  if (summary) updateRun(run.id, { result: summary[1].trim() });
  // Use its latest plain sentence as the "what it's doing" line, if it's short and not a marker.
  const prose = text.split("\n").map((l) => l.trim()).filter((l) => l && !/^(PLAN|STEP|SUMMARY):/.test(l) && !l.startsWith("```") && l.length < 160);
  if (prose.length && !summary) updateRun(run.id, { activity: prose[prose.length - 1].replace(/[*_`#]/g, "") });
}

function setStep(runId: number, index: number) {
  const run = getRun(runId);
  if (!run || !run.steps.length) return;
  const i = Math.max(0, Math.min(index, run.steps.length - 1));
  updateRun(runId, { steps: run.steps.map((s, j) => ({ ...s, state: j < i ? "done" : j === i ? "now" : "todo" })) });
}

function allStepsDone(runId: number) {
  const run = getRun(runId);
  if (run) updateRun(runId, { steps: run.steps.map((s) => ({ ...s, state: "done" })) });
}

function stripMarkers(text: string) {
  return text.replace(/^\s*(PLAN|STEP|SUMMARY):.*$/gm, "").trim();
}

// ---------- finishing ----------

function plainError(text: string, stderr: string, subtype: string): string {
  const all = `${text}\n${stderr}`.toLowerCase();
  if (/usage limit|limit reached|rate limit|quota|out of (extra )?usage/.test(all)) return "It hit the Claude usage limit. Try again later.";
  if (/not logged in|authenticat|invalid api key|please run \/login/.test(all)) return "Claude Code isn't logged in on this Mac.";
  if (subtype === "error_max_turns") return "It took too many steps and gave up.";
  if (/overloaded|529|internal server error/.test(all)) return "Claude was too busy. Try again in a bit.";
  return "It ran into a problem and stopped.";
}

async function onExit(runId: number, phase: "plan" | "work", code: number | null, signal: NodeJS.Signals | null, stopReason: string | null, st: StreamState) {
  const run = getRun(runId);
  const agent = run && getAgent(run.agentId);
  if (!run || !agent) return;
  log(runId, `Claude Code exited (code ${code}${signal ? `, signal ${signal}` : ""})`);

  if (stopReason) return finishStopped(runId, stopReason);
  if (!st.result || st.result.isError || (code !== 0 && code !== null)) {
    return finishStopped(runId, plainError(st.result?.text ?? "", st.stderr, st.result?.subtype ?? ""));
  }

  if (phase === "plan") {
    const plan = stripMarkers(st.result.text) || "(It didn't write a plan.)";
    updateRun(runId, { status: "waiting", plan, activity: "Waiting for your OK on its plan", pid: null });
    log(runId, "Plan ready, waiting for Nic.");
    notify(agent, "needs_ok", `has a plan for “${run.task}” and is waiting for your OK.`);
    return;
  }

  const fresh = getRun(runId)!;
  const summary = fresh.result || firstLine(stripMarkers(st.result.text)) || "Finished.";
  if (lookOnly(agent.allowed, run.mode)) {
    allStepsDone(runId);
    const report = stripMarkers(st.result.text);
    const result = fresh.result && report && !report.startsWith(fresh.result) ? `${fresh.result}\n\n${report}` : report || summary;
    updateRun(runId, { status: "done", result, endedAt: Date.now(), activity: null, pid: null });
    await removeWorktree(fresh);
    notify(agent, "finished", `finished “${run.task}”. ${summary}`);
    return;
  }
  await shipIt(agent, fresh, summary);
}

function firstLine(s: string) {
  return s.split("\n").map((l) => l.trim()).find(Boolean)?.slice(0, 300) ?? "";
}

async function shipIt(agent: Agent, run: Run, summary: string) {
  const dir = run.worktree!;
  const step = (label: string) => updateRun(run.id, { activity: label });
  const last = run.steps.length - 1;
  setStep(run.id, last);
  step("Sending a pull request…");

  // Commit anything it left uncommitted.
  const status = await sh("git", ["status", "--porcelain"], dir);
  if (status.out) {
    await sh("git", ["add", "-A"], dir);
    await sh("git", ["commit", "-m", `${run.task.slice(0, 72)}\n\n${summary}\n\nMade by the ${agent.name} agent from agentbox.`], dir);
  }
  const base = await baseRef(dir);
  const ahead = await sh("git", ["rev-list", "--count", `${base}..HEAD`], dir);
  if (ahead.ok && Number(ahead.out) === 0) {
    allStepsDone(run.id);
    updateRun(run.id, { status: "done", result: `${summary} (No changes were needed, so there's no pull request.)`, endedAt: Date.now(), activity: null, pid: null });
    await removeWorktree(run);
    notify(agent, "finished", `finished “${run.task}” with no changes needed. ${summary}`);
    return;
  }

  const push = await sh("git", ["push", "-u", "origin", `HEAD:refs/heads/${run.branch}`], dir);
  if (!push.ok) return finishStopped(run.id, "It finished, but couldn't send its work to GitHub.", push.err);
  log(run.id, `Pushed ${run.branch}`);

  const existing = await sh("gh", ["pr", "view", run.branch!, "--json", "url", "--jq", ".url"], dir);
  let url = existing.ok ? existing.out : "";
  if (!url) {
    const body = [
      `**Task:** ${run.task}`,
      "",
      `**What it did:** ${summary}`,
      "",
      `Made by the **${agent.name}** agent from agentbox (${agent.model === "opus" ? "Opus" : "Sonnet"}). Please review before merging.`,
    ].join("\n");
    const title = run.task === "Its usual job" || run.task === "Scheduled run" ? `${agent.name}: ${summary}` : run.task;
    const pr = await sh("gh", ["pr", "create", "--base", base.replace(/^origin\//, ""), "--head", run.branch!, "--title", title.slice(0, 120), "--body", body], dir);
    if (!pr.ok) return finishStopped(run.id, "It pushed its work but couldn't open the pull request.", pr.err);
    url = pr.out.split("\n").filter((l) => l.startsWith("http")).pop() ?? pr.out;
  }
  log(run.id, `Pull request: ${url}`);
  allStepsDone(run.id);
  updateRun(run.id, { status: "review", prUrl: url, result: summary, endedAt: Date.now(), activity: null, pid: null });
  await removeWorktree(getRun(run.id)!);
  notify(agent, "finished", `finished “${run.task}”. Pull request ready: ${url}`);
}

async function removeWorktree(run: Run) {
  if (!run.worktree || !fs.existsSync(run.worktree)) return;
  const agent = getAgent(run.agentId);
  const repo = agent && projectPath(agent.project);
  if (repo) await sh("git", ["worktree", "remove", "--force", run.worktree], repo);
}

function finishStopped(runId: number, reason: string, detail?: string) {
  const run = getRun(runId);
  if (!run || run.status === "stopped") return;
  if (detail) log(runId, `Problem: ${detail}`);
  log(runId, `Stopped: ${reason}`);
  denyPendingForRun(runId, "The run was stopped.");
  updateRun(runId, { status: "stopped", stopReason: reason, endedAt: Date.now(), activity: null, pid: null });
  const agent = getAgent(run.agentId);
  if (agent && reason !== "You stopped it.") notify(agent, "problems", `stopped while doing “${run.task}”: ${reason}`);
}

// ---------- controls ----------

export function stopRun(runId: number, reason = "You stopped it.") {
  const run = getRun(runId);
  if (!run || (run.status !== "working" && run.status !== "waiting")) return;
  const entry = live.get(runId);
  denyPendingForRun(runId, "The run was stopped.");
  if (entry?.child.pid) {
    entry.stopReason = reason;
    killGroup(entry.child.pid);
  } else {
    if (run.pid) killGroup(run.pid);
    finishStopped(runId, reason);
  }
}

function killGroup(pid: number) {
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
  setTimeout(() => {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      /* gone */
    }
  }, 8000).unref();
}

export function approvePlan(runId: number) {
  const run = getRun(runId);
  const agent = run && getAgent(run.agentId);
  if (!run || !agent || run.status !== "waiting" || !run.sessionId) throw new Error("There's no plan waiting for an OK.");
  log(runId, "Nic approved the plan.");
  updateRun(runId, { status: "working", activity: "Starting on the plan…" });
  setStep(runId, 0);
  spawnClaude(agent, getRun(runId)!, "work", "Nic approved your plan. Go ahead and carry it out now, following the progress-line rules.", run.sessionId);
}

export function changePlan(runId: number, message: string) {
  const run = getRun(runId);
  const agent = run && getAgent(run.agentId);
  if (!run || !agent || run.status !== "waiting" || !run.sessionId) throw new Error("There's no plan waiting for an OK.");
  log(runId, `Nic asked for changes to the plan: ${message}`);
  updateRun(runId, { status: "working", plan: null, activity: "Changing its plan…" });
  spawnClaude(agent, getRun(runId)!, "plan", `Nic read your plan and wants changes:\n${message}\n\nWrite the updated plan.`, run.sessionId);
}

// ---------- background upkeep ----------

// After a restart, nothing the panel was watching is still connected to it.
export function recoverOnBoot() {
  for (const run of runsWithStatus("working")) {
    if (live.has(run.id)) continue;
    if (run.pid) killGroup(run.pid);
    finishStopped(run.id, "The panel restarted while it was working.");
  }
}

// Needs you (pull request open) → Done when merged, Stopped if closed without merging.
export async function checkPullRequests() {
  for (const run of runsWithStatus("review")) {
    if (!run.prUrl) continue;
    const r = await sh("gh", ["pr", "view", run.prUrl, "--json", "state", "--jq", ".state"], os.homedir(), 30_000);
    if (!r.ok) continue;
    if (r.out === "MERGED") {
      updateRun(run.id, { status: "done" });
      log(run.id, "Pull request merged.");
    } else if (r.out === "CLOSED") {
      updateRun(run.id, { status: "stopped", stopReason: "The pull request was closed without merging." });
      log(run.id, "Pull request closed without merging.");
    }
  }
}

export function plainApprovalSummary(toolName: string, input: Record<string, unknown>): string {
  const file = typeof input.file_path === "string" ? path.basename(input.file_path) : typeof input.notebook_path === "string" ? path.basename(input.notebook_path) : "";
  switch (toolName) {
    case "Bash":
      return typeof input.description === "string" && input.description ? sentence(input.description) : "Run a command on this Mac";
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return `Change the file ${file}`;
    case "Write":
      return `Create or replace the file ${file}`;
    case "WebFetch":
      try {
        return `Open the web page ${new URL(String(input.url)).hostname}`;
      } catch {
        return "Open a web page";
      }
    case "WebSearch":
      return `Search the web for “${String(input.query ?? "").slice(0, 80)}”`;
    case "ExitPlanMode":
      return "Start working on its plan";
    default:
      return toolName.startsWith("mcp__") ? "Use a connected tool" : `Use the ${toolName} tool`;
  }
}
