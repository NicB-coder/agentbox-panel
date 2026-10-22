import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAgent, createWorkflow, db, getAgent, getApproval, getRun, getSetting, getWfRun, getWorkflow, listAgents, listWorkflows, runsWithStatus, wfRunsWithStatus } from "./db";
import { addHelperUsage } from "./draftUsage";
import { helperSystemPrompt } from "./helperGuide";
import { addMessage, getChat, getMessage, listMessages, streamingMessages, touchChat, updateMessage } from "./helperDb";
import { buildSnapshot } from "./helperSnapshot";
import { TOOLS } from "./helperTools";
import type { HelperAction, HelperCard, HelperContext, HelperMessage, HelperMeta, HelperStreamEvent } from "./helperTypes";
import { listProjects } from "./projects";
import type { WfStep } from "./types";
import { ingestRateLimitEvent, markLimited, usageState } from "./usage";
import { parseAgentInput } from "./validate";
import { STEP_INFO, stepIconOf, cleanLimits, cleanSteps, flowSentence, stepTitle, workflowProblems } from "./wf";
import { agentRefs } from "./workflowViews";
import { agentSentence, clockOf } from "./words";
import { COLOR_CHOICES } from "./choices";

// The Helper chat: Claude Code headless with Sonnet, no built-in tools at all (no files, no shell),
// only the panel's read-only lookups through a tiny local MCP server. It runs in an empty folder
// outside every project. Replies stream to the browser and are saved in SQLite.

const PATH = [path.join(os.homedir(), ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].join(":");
const ROOM = path.join(os.homedir(), "agents", "helper-room"); // empty on purpose
const MCP = path.join(process.cwd(), "scripts", "helper-mcp.mjs");
const PANEL_URL = `http://127.0.0.1:${process.env.PORT || 3000}`;
// How the Helper is started. Tests swap in a fake program and a short time limit.
export const helperRun = { bin: "claude", timeLimitMs: 150_000 };

type G0 = typeof globalThis & { __agentboxHelperSecret?: string };
// The shared secret that lets only the Helper's own tool server call /api/helper/tools.
// Made fresh each time the panel starts and handed over by environment variable; never saved or committed.
export function toolsSecret(): string {
  const g0 = globalThis as G0;
  return (g0.__agentboxHelperSecret ??= process.env.AGENTBOX_HELPER_SECRET || crypto.randomBytes(32).toString("hex"));
}

export function toolsSecretOk(given: string | null): boolean {
  const want = Buffer.from(toolsSecret());
  const got = Buffer.from(given ?? "");
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// Text from logs, pull requests, the snapshot and so on goes to the Helper as data. Make sure it can't
// close its own tag and pretend to be something else.
export function dataBlock(tag: string, text: string) {
  return `<${tag}>\n${text.replace(new RegExp(`</?${tag}\\b`, "gi"), "(tag)")}\n</${tag}>`;
}

type Gen = { chatId: number; msgId: number; text: string; status: string | null; listeners: Set<(e: HelperStreamEvent) => void>; child: ChildProcess | null };
type G = typeof globalThis & { __agentboxHelper?: Map<number, Gen> };
const gens: Map<number, Gen> = ((globalThis as G).__agentboxHelper ??= new Map());

function cleanEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, PATH };
  for (const k of Object.keys(env)) if (k === "CLAUDECODE" || k.startsWith("CLAUDE_CODE_") || k === "ANTHROPIC_API_KEY") delete env[k];
  return env;
}

export function untilWords(ms: number) {
  const mins = Math.max(1, Math.ceil((ms - Date.now()) / 60000));
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
}

export function outOfUsage(): { until: number | null } | null {
  const s = usageState();
  return s.limited ? { until: s.limitedUntil } : null;
}

const outOfUsageText = (until: number | null) =>
  `You're out of Claude usage right now, so I'll answer this by myself ${until ? `at **${clockOf(until)}**, when it resets (in ${untilWords(until)})` : "as soon as it resets"}. You don't need to ask again.\n\nThe usage meter at the top shows the countdown.`;

// When the reply should be tried again: the real reset time, or in 30 minutes if it isn't known.
const retryAt = (until: number | null) => (until && until > Date.now() ? until + 60_000 : Date.now() + 30 * 60_000);

// Replies that waited for usage: answer them now that it's back (called by the background loop).
export function answerWaitingHelper() {
  if (outOfUsage()) return;
  const rows = db().prepare("SELECT id FROM helper_messages WHERE status = 'done' AND role = 'helper' AND meta LIKE '%\"waiting\"%'").all() as { id: number }[];
  for (const { id } of rows) {
    const m = getMessage(id);
    const w = m?.meta.waiting;
    if (!m || !w || w.until > Date.now() || busyChat(m.chatId)) continue;
    const { waiting: _w, ...rest } = m.meta;
    updateMessage(id, { text: "", status: "streaming", meta: rest });
    const gen: Gen = { chatId: m.chatId, msgId: id, text: "", status: null, listeners: new Set(), child: null };
    gens.set(id, gen);
    try {
      run(gen, w.question, w.ctx, w.userMsgId);
    } catch (e) {
      finish(gen, `I couldn't start just now (${(e as Error).message}). Try again in a moment.`, {}, "error");
    }
  }
}

// A reply cut off by a panel restart.
export function recoverHelper() {
  for (const m of streamingMessages()) if (!gens.has(m.id)) updateMessage(m.id, { status: "error", text: m.text || "I got cut off before I could answer. Ask again?" });
}

export function busyChat(chatId: number): Gen | null {
  for (const g of gens.values()) if (g.chatId === chatId) return g;
  return null;
}

// ---------- where Nic is ----------

export function cleanContext(raw: unknown): HelperContext {
  const r = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : undefined);
  const str = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.slice(0, n) : undefined);
  return {
    path: str(r.path, 200) ?? "/",
    title: str(r.title, 200),
    agentId: num(r.agentId),
    workflowId: num(r.workflowId),
    wfRunId: num(r.wfRunId),
    runId: num(r.runId),
    stepId: str(r.stepId, 20),
    stepLabel: str(r.stepLabel, 200),
    editing: str(r.editing, 1800),
    errors: Array.isArray(r.errors) ? (r.errors as unknown[]).filter((e) => typeof e === "string").slice(0, 3).map((e) => (e as string).slice(0, 500)) : [],
  };
}


function describeContext(ctx: HelperContext): string {
  const lines: string[] = [];
  const p = ctx.path || "/";
  let page = `Page: ${p}`;
  const agent = ctx.agentId ? getAgent(ctx.agentId) : null;
  const wf = ctx.workflowId ? getWorkflow(ctx.workflowId) : null;
  if (p === "/") page += " (Agents, the home page)";
  else if (/^\/agents\/new/.test(p)) page += " (the agent editor, making a new agent)";
  else if (/^\/agents\/\d+\/edit/.test(p)) page += ` (the agent editor, editing ${agent ? `[agent ${agent.id}] ${agent.name}` : "an agent"})`;
  else if (/^\/agents\/\d+/.test(p)) page += ` (the agent page of ${agent ? `[agent ${agent.id}] ${agent.name}` : "an agent"})`;
  else if (p === "/workflows") page += " (the Workflows list)";
  else if (p === "/workflows/new") page += " (New workflow: Describe it, or start from a template)";
  else if (/^\/workflows\/\d+/.test(p)) page += ` (the workflow editor of ${wf ? `[workflow ${wf.id}] ${wf.name}` : "a workflow"})`;
  else if (p.startsWith("/inbox")) page += " (the Inbox)";
  else if (p.startsWith("/projects")) page += " (Projects)";
  else if (p.startsWith("/settings")) page += " (Settings)";
  else if (p.startsWith("/help")) page += " (Help)";
  lines.push(page);
  if (ctx.title) lines.push(`Page heading: ${ctx.title.slice(0, 120)}`);
  if (ctx.wfRunId) lines.push(`Showing workflow run [wfrun ${ctx.wfRunId}] on the canvas.`);
  if (ctx.stepId && wf) {
    const s = wf.steps.find((x) => x.id === ctx.stepId);
    if (s) lines.push(`Selected step: "${stepTitle(s, agentRefs())}" (${STEP_INFO[s.type].title} step, id ${s.id}), its settings panel is open.`);
  } else if (ctx.stepLabel) lines.push(`Selected: ${ctx.stepLabel.slice(0, 120)}`);
  if (ctx.runId) lines.push(`Looking at run [run ${ctx.runId}].`);
  if (ctx.editing) lines.push(`Editing: ${ctx.editing.slice(0, 1800)}`);
  if (ctx.errors.length) lines.push(`Error showing on screen: ${ctx.errors.map((e) => `"${e.slice(0, 400)}"`).join("; ")}`);
  else lines.push("No error showing on screen.");
  return lines.join("\n");
}

export function shortPlace(ctx: HelperContext): string {
  const p = ctx.path || "/";
  if (p === "/") return "Agents";
  if (/^\/agents\/new/.test(p)) return "New agent";
  const a = ctx.agentId ? getAgent(ctx.agentId) : null;
  if (/^\/agents\/\d+\/edit/.test(p)) return a ? `Editing ${a.name}` : "Agent editor";
  if (/^\/agents\/\d+/.test(p)) return a?.name ?? "Agent page";
  if (p === "/workflows/new") return "New workflow";
  const w = ctx.workflowId ? getWorkflow(ctx.workflowId) : null;
  if (/^\/workflows\/\d+/.test(p)) return w?.name ?? "Workflow";
  const names: Record<string, string> = { "/workflows": "Workflows", "/inbox": "Inbox", "/projects": "Projects", "/settings": "Settings", "/help": "Help" };
  return names[p] ?? p;
}

// History as the Helper sees it: its own replies plus a note of any cards it showed.
function historyText(chatId: number, beforeId: number): string {
  const msgs = listMessages(chatId, 40).filter((m) => m.id < beforeId && m.status !== "streaming").slice(-14);
  if (!msgs.length) return "";
  return msgs
    .map((m) => {
      let t = m.text.length > 2500 ? `${m.text.slice(0, 2500)}…` : m.text;
      for (const c of m.meta.cards ?? []) t += `\n(showed a ${c.type} preview card: ${JSON.stringify(c.draft)})`;
      for (const c of m.meta.created ?? []) t += `\n(Nic pressed Create it: [${c.kind} ${c.id}] was saved switched Off and opened in the editor)`;
      for (const a of m.meta.actions ?? []) t += `\n(offered button: ${a.label})`;
      return `${m.role === "user" ? "Nic" : "Helper"}${m.meta.context ? ` (on ${m.meta.context})` : ""}: ${t}`;
    })
    .join("\n\n");
}

// ---------- sending a message ----------

export function sendMessage(chatId: number, text: string, ctx: HelperContext): { user: HelperMessage; reply: HelperMessage } {
  const chat = getChat(chatId);
  if (!chat) throw new Error("That conversation isn't here any more. Start a new chat.");
  if (busyChat(chatId)) throw new Error("Wait a moment, the Helper is still answering.");
  const user = addMessage({ chatId, role: "user", text, meta: { context: shortPlace(ctx) } });
  touchChat(chatId, text.replace(/\s+/g, " ").slice(0, 60));

  const out = outOfUsage();
  if (out) {
    const reply = addMessage({ chatId, role: "helper", text: outOfUsageText(out.until), meta: { waiting: { question: text, ctx, userMsgId: user.id, until: retryAt(out.until) } } });
    return { user, reply };
  }

  const reply = addMessage({ chatId, role: "helper", text: "", status: "streaming" });
  const gen: Gen = { chatId, msgId: reply.id, text: "", status: null, listeners: new Set(), child: null };
  gens.set(reply.id, gen);
  try {
    run(gen, text, ctx, user.id);
  } catch (e) {
    finish(gen, `I couldn't start just now (${(e as Error).message}). Try again in a moment.`, {}, "error");
  }
  return { user, reply: getMessage(reply.id)! };
}

function emit(gen: Gen, e: HelperStreamEvent) {
  for (const l of gen.listeners) {
    try {
      l(e);
    } catch {
      /* a closed stream */
    }
  }
}

// Follow a reply as it's written. Calls back with the text so far, status lines, and the final message.
export function subscribe(msgId: number, cb: (e: HelperStreamEvent) => void): (() => void) | null {
  const gen = gens.get(msgId);
  if (!gen) return null;
  cb({ t: "text", text: gen.text });
  if (gen.status) cb({ t: "status", text: gen.status });
  gen.listeners.add(cb);
  return () => gen.listeners.delete(cb);
}

function run(gen: Gen, text: string, ctx: HelperContext, userMsgId: number) {
  fs.mkdirSync(ROOM, { recursive: true });
  const history = historyText(gen.chatId, userMsgId);
  const prompt = [
    history ? dataBlock("conversation_so_far", history) : "",
    dataBlock("where_nic_is", describeContext(ctx)),
    dataBlock("snapshot", buildSnapshot()),
    `Nic's new message:\n${text}`,
  ].filter(Boolean).join("\n\n");

  const mcp = { mcpServers: { panel: { command: process.execPath, args: [MCP], env: { AGENTBOX_PANEL_URL: PANEL_URL, AGENTBOX_HELPER_SECRET: toolsSecret() } } } };
  const args = [
    "-p",
    "--output-format", "stream-json", "--verbose", "--include-partial-messages",
    "--model", "sonnet",
    "--tools", "",
    "--mcp-config", JSON.stringify(mcp), "--strict-mcp-config",
    "--allowedTools", TOOLS.map((t) => `mcp__panel__${t.name}`).join(","),
    "--permission-mode", "dontAsk",
    "--setting-sources", "",
    "--disable-slash-commands",
    "--no-session-persistence",
    "--system-prompt", helperSystemPrompt(),
  ];
  const child = spawn(helperRun.bin, args, { cwd: ROOM, env: cleanEnv(), stdio: ["pipe", "pipe", "pipe"] });
  gen.child = child;
  child.stdin.end(prompt);

  const meta: HelperMeta = { tools: [] };
  let buf = "";
  let err = "";
  let gap = false; // a new assistant turn starts: separate it from the last one
  let final: string | null = null;
  let failed: string | null = null;
  const timer = setTimeout(() => {
    failed = "That took too long, so I stopped. Try asking in a simpler way, or again in a moment.";
    child.kill("SIGTERM");
    setTimeout(() => child.exitCode === null && child.signalCode === null && child.kill("SIGKILL"), 5000).unref();
  }, helperRun.timeLimitMs);

  const onEvent = (ev: Record<string, unknown>) => {
    if (ev.type === "stream_event") {
      const e = ev.event as Record<string, unknown>;
      if (e?.type === "message_start" && gen.text.trim()) gap = true;
      if (e?.type === "content_block_start") {
        const b = e.content_block as { type?: string; name?: string };
        if (b?.type === "tool_use") {
          const t = TOOLS.find((x) => `mcp__panel__${x.name}` === b.name);
          gen.status = t?.doing ?? "Looking it up…";
          meta.tools!.push(gen.status.replace(/…$/, ""));
          emit(gen, { t: "status", text: gen.status });
        }
      }
      if (e?.type === "content_block_delta") {
        const d = e.delta as { type?: string; text?: string };
        if (d?.type === "text_delta" && d.text) {
          if (gap) {
            gen.text = gen.text.replace(/\s+$/, "") + "\n\n";
            gap = false;
          }
          gen.text += d.text;
          if (gen.status) {
            gen.status = null;
            emit(gen, { t: "status", text: "" });
          }
          emit(gen, { t: "text", text: gen.text });
        }
      }
    } else if (ev.type === "rate_limit_event") {
      ingestRateLimitEvent((ev.rate_limit_info ?? {}) as Record<string, unknown>);
    } else if (ev.type === "result") {
      addHelperUsage(Number(ev.total_cost_usd ?? 0));
      if (ev.is_error) {
        const r = String(ev.result ?? "");
        if (/usage limit|hit your limit|rate limit|limit reached/i.test(r)) {
          markLimited(r);
          failed = outOfUsageText(usageState().limitedUntil);
        } else failed = "Something went wrong on my side. Try asking again.";
      } else if (typeof ev.result === "string" && ev.result.trim()) final = ev.result;
    }
  };

  child.stdout.on("data", (chunk: Buffer) => {
    buf += chunk.toString("utf8");
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      try {
        onEvent(JSON.parse(line));
      } catch {
        /* not JSON */
      }
    }
  });
  child.stderr.on("data", (c: Buffer) => {
    err = (err + c.toString("utf8")).slice(-4000);
  });
  child.on("error", () => {
    failed = "I couldn't start Claude on this Mac. Check that Claude Code is installed on this Mac.";
  });
  child.on("close", () => {
    clearTimeout(timer);
    if (!failed && /usage limit|hit your limit/i.test(err)) {
      markLimited(err);
      failed = outOfUsageText(usageState().limitedUntil);
    }
    let textOut = gen.text.trim() || final?.trim() || "";
    if (failed) {
      const usage = failed.startsWith("You're out");
      textOut = usage ? failed : textOut ? `${textOut}\n\n_${failed}_` : failed;
      finish(gen, textOut, usage ? { ...meta, waiting: { question: text, ctx, userMsgId, until: retryAt(usageState().limitedUntil) } } : meta, usage ? "done" : "error");
      return;
    }
    if (!textOut) {
      finish(gen, "I didn't get an answer that time. Try asking again.", meta, "error");
      return;
    }
    finish(gen, textOut, meta, "done");
  });
}

function finish(gen: Gen, raw: string, meta: HelperMeta, status: HelperMessage["status"]) {
  const done = finalize(raw, meta);
  updateMessage(gen.msgId, { text: done.text, meta: done.meta, status });
  touchChat(gen.chatId);
  gens.delete(gen.msgId);
  emit(gen, { t: "done", message: getMessage(gen.msgId)! });
  gen.listeners.clear();
}

// ---------- turning the reply into chips, buttons and cards ----------

const PAGE_OK = [/^\/$/, /^\/workflows$/, /^\/workflows\/new$/, /^\/inbox$/, /^\/projects$/, /^\/settings$/, /^\/help$/, /^\/agents\/new$/, /^\/agents\/\d+(\/edit)?$/, /^\/workflows\/\d+$/, /^\/connectors$/, /^\/machine$/, /^\/terminal$/, /^\/reports\/\d+$/, /^\/settings#update$/];
const PR_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/;

export function pageOk(p: string): boolean {
  if (!PAGE_OK.some((r) => r.test(p))) return false;
  const a = p.match(/^\/agents\/(\d+)/);
  if (a) {
    const ag = getAgent(Number(a[1]));
    if (!ag || ag.kind === "helper" || (p.endsWith("/edit") && ag.kind !== "claude")) return false;
  }
  const w = p.match(/^\/workflows\/(\d+)$/);
  if (w && !getWorkflow(Number(w[1]))) return false;
  return true;
}

export function chipFor(kind: string, ref: string, label: string): { href: string; label: string; external?: boolean } | null {
  const n = Number(ref);
  switch (kind) {
    case "agent": {
      const a = getAgent(n);
      return a && a.kind !== "helper" ? { href: `/agents/${a.id}`, label: a.name } : null;
    }
    case "run": {
      const r = getRun(n);
      if (!r) return null;
      if (r.workflowRunId) {
        const wr = getWfRun(r.workflowRunId);
        return wr ? { href: `/workflows/${wr.workflowId}?run=${wr.id}`, label: label || r.task } : null;
      }
      return { href: `/agents/${r.agentId}`, label: label || r.task };
    }
    case "workflow": {
      const w = getWorkflow(n);
      return w ? { href: `/workflows/${w.id}`, label: w.name } : null;
    }
    case "wfrun": {
      const wr = getWfRun(n);
      return wr ? { href: `/workflows/${wr.workflowId}?run=${wr.id}`, label: label || "this run" } : null;
    }
    case "pr":
      return PR_RE.test(ref) ? { href: ref, label: label || `pull request #${ref.split("/").pop()}`, external: true } : null;
    case "page":
      return pageOk(ref) ? { href: ref, label: label || ref } : null;
  }
  return null;
}

const prNumber = (url: string) => url.match(/\/pull\/(\d+)/)?.[1] ?? "";
const repoOf = (url: string) => url.match(/github\.com\/[\w.-]+\/([\w.-]+)\/pull/)?.[1] ?? "the project";

const PAGE_NAMES: Record<string, string> = {
  "/": "Agents", "/workflows": "Workflows", "/workflows/new": "New workflow", "/inbox": "the Inbox", "/projects": "Projects", "/settings": "Settings", "/help": "Help",
  "/agents/new": "Start a task", "/connectors": "Connectors", "/machine": "Machine", "/terminal": "Terminal", "/settings#update": "Update agentbox",
};

function pageName(p: string): string {
  if (PAGE_NAMES[p]) return PAGE_NAMES[p];
  const a = p.match(/^\/agents\/(\d+)(\/edit)?$/);
  if (a) return `${getAgent(Number(a[1]))?.name ?? "the agent"}${a[2] ? "'s settings" : ""}`;
  const w = p.match(/^\/workflows\/(\d+)$/);
  if (w) return getWorkflow(Number(w[1]))?.name ?? "the workflow";
  return "it";
}

// A button the Helper suggested. The model only picks which action and for what; the label and the
// "Are you sure?" text are always written here, from the real thing it acts on. So a log or a pull
// request comment that talks the model into "[[button:merge_pr:5|Open the log]]" still shows
// "Merge pull request #12", and it still asks first.
export function actionFor(kind: string, ref: string): HelperAction | null {
  const n = Number(ref);
  const id = /^\d+$/.test(ref) && n > 0;
  const a = (label: string, confirm?: string): HelperAction => ({ kind: kind as HelperAction["kind"], ref, label, ...(confirm ? { risky: true, confirm } : {}) });
  switch (kind) {
    case "retry_run": {
      const r = id ? getRun(n) : null;
      const ag = r && getAgent(r.agentId);
      return r && r.status === "stopped" && !r.workflowRunId && ag?.kind === "claude" && ag.enabled ? a("Try again") : null;
    }
    case "approve_plan": {
      const r = id ? getRun(n) : null;
      return r && r.status === "waiting" && r.plan ? a("Approve plan") : null;
    }
    case "allow":
    case "deny": {
      const ap = id ? getApproval(n) : null;
      return ap?.status === "pending" ? a(kind === "allow" ? "Allow" : "Deny") : null;
    }
    case "run_agent": {
      const ag = id ? getAgent(n) : null;
      return ag && ag.kind === "claude" && ag.enabled ? a(`Run ${ag.name} now`) : null;
    }
    case "test_run":
      return id && getWorkflow(n) ? a("Start a test run") : null;
    case "resume_wfrun":
      return id && getWfRun(n)?.status === "stopped" ? a("Pick up where it stopped") : null;
    case "approve_wfrun": {
      const wr = id ? getWfRun(n) : null;
      return wr?.status === "needs" && wr.waiting?.kind === "ask" ? a("Approve") : null;
    }
    case "ship_wfrun": {
      const wr = id ? getWfRun(n) : null;
      if (!(wr?.status === "needs" && wr.waiting?.kind === "ship")) return null;
      const wf = getWorkflow(wr.workflowId);
      const pr = wr.prUrl ? prNumber(wr.prUrl) : "";
      return a(
        pr ? `Ship it: merge pull request #${pr}` : "Ship it",
        `This ships "${wf?.name ?? "the workflow"}": it merges ${pr ? `pull request #${pr}` : "its pull request"} into main of ${wf?.project ?? "the project"} on GitHub, so its changes become part of your real project. agentbox can't undo a merge.`,
      );
    }
    case "merge_pr": {
      const r = id ? getRun(n) : null;
      if (!(r?.status === "review" && r.prUrl)) return null;
      const pr = prNumber(r.prUrl);
      return a(
        `Merge pull request #${pr}`,
        `This merges pull request #${pr} ("${r.task.slice(0, 80)}") into main of ${repoOf(r.prUrl)} on GitHub, so its changes become part of your real project. agentbox can't undo a merge.`,
      );
    }
    case "pause_all": {
      if (getSetting<boolean>("pausedAll", false)) return null;
      const runs = runsWithStatus("working", "waiting").filter((r) => !r.workflowRunId).length;
      const flows = wfRunsWithStatus("running", "needs").length;
      const count = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);
      const going = [runs && count(runs, "agent run", "agent runs"), flows && count(flows, "workflow run", "workflow runs")].filter(Boolean).join(" and ");
      return a(
        "Pause everything",
        going
          ? `This stops what's running right now (${going}) and holds every schedule until you press Resume everything. Work so far is kept but not finished.`
          : "Nothing is running right now. This holds every schedule until you press Resume everything, so no agent or workflow starts by itself.",
      );
    }
    case "resume_all":
      return getSetting<boolean>("pausedAll", false) ? a("Resume everything") : null;
    case "open":
      return pageOk(ref) ? a(`Open ${pageName(ref)}`) : null;
  }
  // Anything else (delete, merge by another name…) isn't a button the Helper can offer.
  return null;
}

function agentCard(raw: Record<string, unknown>): HelperCard {
  const projects = listProjects();
  const used = new Set(listAgents().map((x) => x.color));
  const fill = {
    color: COLOR_CHOICES.find((c) => !used.has(c.hex))?.hex ?? COLOR_CHOICES[0].hex,
    icon: "sparkle", scheduleKind: "manual", scheduleDays: [], scheduleTime: "02:00", allowed: "suggest", mode: "auto", maxMinutes: 30, model: "sonnet",
    notify: ["finished", "needs_ok", "problems"],
  };
  const merged: Record<string, unknown> = { ...fill, ...raw, enabled: false };
  if (!projects.includes(String(merged.project))) merged.project = projects.includes("agentbox-panel") ? "agentbox-panel" : projects[0] ?? "";
  if (!COLOR_CHOICES.some((c) => c.hex.toLowerCase() === String(merged.color).toLowerCase())) merged.color = fill.color;
  merged.maxMinutes = Math.max(5, Math.min(120, Math.round(Number(merged.maxMinutes) || 30)));
  if (merged.allowed === "look") merged.mode = "look";
  const parsed = parseAgentInput(merged, projects);
  if (!parsed.ok) {
    const draft = merged as unknown as HelperCard["draft"];
    return { type: "agent", draft: draft as never, sentence: "", problem: parsed.error };
  }
  const draft = { ...parsed.agent, enabled: false };
  return { type: "agent", draft, sentence: agentSentence({ ...draft, enabled: true }), problem: null };
}

function workflowCard(raw: Record<string, unknown>): HelperCard {
  const projects = listProjects();
  const agents = agentRefs();
  const project = projects.includes(String(raw.project)) ? String(raw.project) : projects[0] ?? "";
  const steps: WfStep[] = cleanSteps(raw.steps, agents.map((a) => a.id));
  const draft = { name: String(raw.name ?? "").trim().slice(0, 60) || "New workflow", project, steps, limits: cleanLimits({ maxLoops: raw.maxLoops }) };
  const problems = workflowProblems(draft, agents, projects);
  return {
    type: "workflow", draft, sentence: flowSentence(draft, agents),
    steps: steps.map((s) => {
      const a = s.type === "agent" && s.agentId != null ? agents.find((x) => x.id === s.agentId) : null;
      return { title: stepTitle(s, agents), icon: a?.icon ?? stepIconOf(s), color: a?.color ?? STEP_INFO[s.type].color };
    }),
    problem: problems[0] ?? null,
  };
}

export function finalize(raw: string, meta: HelperMeta): { text: string; meta: HelperMeta } {
  const cards: HelperCard[] = [];
  let text = raw.replace(/```(agent-preview|workflow-preview)\s*\n?([\s\S]*?)```/g, (_m, kind: string, body: string) => {
    try {
      const j = JSON.parse(body.trim());
      cards.push(kind === "agent-preview" ? agentCard(j) : workflowCard(j));
    } catch {
      /* a broken card is dropped */
    }
    return "";
  });
  // An unfinished card (cut off) is dropped too.
  text = text.replace(/```(agent-preview|workflow-preview)[\s\S]*$/, "");

  const actions: HelperAction[] = [];
  const chips: NonNullable<HelperMeta["chips"]> = {};
  text = text.replace(/\[\[([^\]\n]{1,600}?)\]\]/g, (_m, body: string) => {
    const bar = body.indexOf("|");
    const head = bar >= 0 ? body.slice(0, bar) : body;
    const label = bar >= 0 ? body.slice(bar + 1).trim() : "";
    const colon = head.indexOf(":");
    const kind = colon >= 0 ? head.slice(0, colon).trim() : head.trim();
    const rest = colon >= 0 ? head.slice(colon + 1).trim() : "";
    if (kind === "button") {
      const c = rest.indexOf(":");
      const act = actionFor(c >= 0 ? rest.slice(0, c).trim() : rest, c >= 0 ? rest.slice(c + 1).trim() : "");
      if (act && !actions.some((x) => x.kind === act.kind && x.ref === act.ref)) actions.push(act);
      return "";
    }
    if (kind === "task") {
      // [[task:new|…]] opens Start a task filled in; [[task:AGENT_ID|…]] opens a follow-up on that job.
      const ag = rest === "new" ? null : getAgent(Number(rest));
      if (label && rest === "new") actions.push({ kind: "new_task", ref: "new", label: "Set up this task", task: label.slice(0, 2000) });
      else if (ag && ag.kind === "claude" && ag.enabled && label)
        actions.push({ kind: "new_task", ref: String(ag.id), label: ag.archived ? "Set up this task" : `Set up a follow-up for ${ag.name}`, task: label.slice(0, 2000) });
      return "";
    }
    const chip = chipFor(kind, rest, label);
    const key = `${kind}:${rest}`;
    chips[key] = chip;
    return chip ? `[[${key}|${(label || chip.label).replace(/[[\]|]/g, "")}]]` : label;
  });
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return { text, meta: { ...meta, tools: meta.tools?.length ? [...new Set(meta.tools)] : undefined, chips, actions, cards } };
}

// ---------- Create it ----------

export function cardOf(msgId: number, index: number): HelperCard | null {
  const m = getMessage(msgId);
  return m?.meta.cards?.[index] ?? null;
}

type CreateResult = { ok: true; href: string; existing: boolean } | { ok: false; status: number; error: string };

// "Create it" on a preview card: saves it switched Off. Pressed twice (a double click, two tabs, the
// laptop and the phone), it makes it once and hands back the same link the second time.
export function createFromCard(msgId: number, index: number): CreateResult {
  return db().transaction((): CreateResult => {
    const m = getMessage(msgId);
    const card = m?.role === "helper" ? m.meta.cards?.[index] : undefined;
    if (!m || !card) return { ok: false, status: 404, error: "That preview isn't here any more. Ask the Helper again." };
    const done = m.meta.created?.find((c) => c.index === index);
    if (done && (done.kind === "agent" ? getAgent(done.id) : getWorkflow(done.id))) return { ok: true, href: done.href, existing: true };
    if (card.problem) return { ok: false, status: 400, error: card.problem };
    let made: { kind: "agent" | "workflow"; id: number; href: string };
    if (card.type === "agent") {
      const parsed = parseAgentInput({ ...card.draft, enabled: false }, listProjects());
      if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
      const ag = createAgent({ ...parsed.agent, enabled: false });
      made = { kind: "agent", id: ag.id, href: `/agents/${ag.id}/edit` };
    } else {
      const taken = new Set(listWorkflows().map((x) => x.name));
      let name = card.draft.name;
      for (let i = 2; taken.has(name); i++) name = `${card.draft.name} ${i}`;
      const w = createWorkflow({ ...card.draft, name }, "Made by the Helper");
      made = { kind: "workflow", id: w.id, href: `/workflows/${w.id}` };
    }
    const created = [...(m.meta.created ?? []).filter((c) => c.index !== index), { index, ...made }];
    updateMessage(msgId, { meta: { ...m.meta, created } });
    return { ok: true, href: made.href, existing: false };
  })();
}
