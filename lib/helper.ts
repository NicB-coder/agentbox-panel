import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getAgent, getApproval, getRun, getSetting, getWfRun, getWorkflow, listAgents } from "./db";
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
import { STEP_INFO, cleanLimits, cleanSteps, flowSentence, stepTitle, workflowProblems } from "./wf";
import { agentRefs } from "./workflowViews";
import { agentSentence, clockOf } from "./words";
import { COLOR_CHOICES } from "@/components/ui";

// The Helper chat: Claude Code headless with Sonnet, no built-in tools at all (no files, no shell),
// only the panel's read-only lookups through a tiny local MCP server. It runs in an empty folder
// outside every project. Replies stream to the browser and are saved in SQLite.

const PATH = [path.join(os.homedir(), ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].join(":");
const ROOM = path.join(os.homedir(), "agents", "helper-room"); // empty on purpose
const MCP = path.join(process.cwd(), "scripts", "helper-mcp.mjs");
const PANEL_URL = `http://127.0.0.1:${process.env.PORT || 3000}`;
const TIME_LIMIT = 150_000;

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
  `You're out of Claude usage right now${until ? `, so I can't answer until it resets at **${clockOf(until)}** (in ${untilWords(until)})` : ", so I can't answer until it resets"}. Your question is saved here. Ask again after that.\n\nThe usage meter at the top shows the countdown.`;

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
    const reply = addMessage({ chatId, role: "helper", text: outOfUsageText(out.until) });
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
    history ? `<conversation_so_far>\n${history}\n</conversation_so_far>` : "",
    `<where_nic_is>\n${describeContext(ctx)}\n</where_nic_is>`,
    `<snapshot>\n${buildSnapshot()}\n</snapshot>`,
    `Nic's new message:\n${text}`,
  ].filter(Boolean).join("\n\n");

  const mcp = { mcpServers: { panel: { command: process.execPath, args: [MCP], env: { AGENTBOX_PANEL_URL: PANEL_URL } } } };
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
  const child = spawn("claude", args, { cwd: ROOM, env: cleanEnv(), stdio: ["pipe", "pipe", "pipe"] });
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
  }, TIME_LIMIT);

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
    failed = "I couldn't start Claude on this Mac. Ask Claude to fix this from any error box, or check that Claude Code is installed.";
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
      finish(gen, textOut, meta, usage ? "done" : "error");
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

const PAGE_OK = [/^\/$/, /^\/workflows$/, /^\/workflows\/new$/, /^\/inbox$/, /^\/projects$/, /^\/settings$/, /^\/help$/, /^\/agents\/new$/, /^\/agents\/\d+(\/edit)?$/, /^\/workflows\/\d+$/];
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

function chipFor(kind: string, ref: string, label: string): { href: string; label: string; external?: boolean } | null {
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

const CONFIRM = {
  merge_pr: "This merges the pull request into main on GitHub, so its changes become part of your real project.",
  ship_wfrun: "This ships the workflow's work: it merges its pull request into main on GitHub.",
  pause_all:
    "This stops every agent and workflow that's running right now, and holds all schedules until you press Resume everything. Work in progress is kept but not finished.",
};

function actionFor(kind: string, ref: string, label: string): HelperAction | null {
  const n = Number(ref);
  const a = (risky?: keyof typeof CONFIRM): HelperAction => ({ kind: kind as HelperAction["kind"], ref, label: label.trim().slice(0, 40), ...(risky ? { risky: true, confirm: CONFIRM[risky] } : {}) });
  switch (kind) {
    case "retry_run": {
      const r = getRun(n);
      const ag = r && getAgent(r.agentId);
      return r && r.status === "stopped" && !r.workflowRunId && ag?.kind === "claude" && ag.enabled ? a() : null;
    }
    case "approve_plan": {
      const r = getRun(n);
      return r && r.status === "waiting" && r.plan ? a() : null;
    }
    case "allow":
    case "deny":
      return getApproval(n)?.status === "pending" ? a() : null;
    case "run_agent": {
      const ag = getAgent(n);
      return ag && ag.kind === "claude" && ag.enabled ? a() : null;
    }
    case "test_run":
      return getWorkflow(n) ? a() : null;
    case "resume_wfrun":
      return getWfRun(n)?.status === "stopped" ? a() : null;
    case "approve_wfrun": {
      const wr = getWfRun(n);
      return wr?.status === "needs" && wr.waiting?.kind === "ask" ? a() : null;
    }
    case "ship_wfrun": {
      const wr = getWfRun(n);
      return wr?.status === "needs" && wr.waiting?.kind === "ship" ? a("ship_wfrun") : null;
    }
    case "merge_pr": {
      const r = getRun(n);
      return r?.status === "review" && r.prUrl ? a("merge_pr") : null;
    }
    case "pause_all":
      return getSetting<boolean>("pausedAll", false) ? null : a("pause_all");
    case "resume_all":
      return getSetting<boolean>("pausedAll", false) ? a() : null;
    case "open":
      return pageOk(ref) ? a() : null;
  }
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
      return { title: stepTitle(s, agents), icon: a?.icon ?? STEP_INFO[s.type].icon, color: a?.color ?? STEP_INFO[s.type].color };
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
      const act = actionFor(c >= 0 ? rest.slice(0, c) : rest, c >= 0 ? rest.slice(c + 1) : "", label || "Do it");
      if (act && !actions.some((x) => x.kind === act.kind && x.ref === act.ref)) actions.push(act);
      return "";
    }
    if (kind === "task") {
      const ag = getAgent(Number(rest));
      if (ag && ag.kind === "claude" && ag.enabled && label)
        actions.push({ kind: "new_task", ref: String(ag.id), label: `Set up this task for ${ag.name}`, task: label.slice(0, 2000) });
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

export function markCreated(msgId: number, c: { index: number; kind: "agent" | "workflow"; id: number; href: string }) {
  const m = getMessage(msgId);
  if (!m) return;
  updateMessage(msgId, { meta: { ...m.meta, created: [...(m.meta.created ?? []), c] } });
}

