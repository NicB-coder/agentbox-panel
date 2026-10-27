// Runs the Helper test set against a running dev copy of the panel and grades every answer.
//   node helper-eval/run.mjs http://127.0.0.1:3100 /path/to/dev/data/agentbox.db [only-these-ids,comma,separated]
// Uses real Claude usage (one Helper reply per question). Never point it at the live panel.
// Writes helper-eval/last-results.md with every question, answer and grade.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { QUESTIONS } from "./questions.mjs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3100";
const DB = process.argv[3] ?? "/tmp/agentbox-dev-v3/data/agentbox.db";
const ONLY = process.argv[4] ? new Set(process.argv[4].split(",")) : null;
const PARALLEL = 4;

const get = async (p) => (await fetch(BASE + p, { cache: "no-store" })).json();
async function post(p, body) {
  const r = await fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j;
}

// ---------- the real facts, read fresh (the database is opened read-only) ----------
async function readFacts() {
  const db = new Database(DB, { readonly: true, fileMustExist: true });
  const header = await get("/api/header");
  const machine = await get("/api/machine");
  const projects = (await get("/api/projects")).map((p) => p.name);
  const agents = db.prepare("SELECT id, name FROM agents").all();
  const nameOf = (id) => agents.find((a) => a.id === id)?.name;
  const workflows = db.prepare("SELECT id, name, enabled, steps FROM workflows ORDER BY id").all();
  const running = [
    ...db.prepare("SELECT DISTINCT agent_id FROM runs WHERE status IN ('working','waiting') AND workflow_run_id IS NULL").all().map((r) => nameOf(r.agent_id)),
    ...db.prepare("SELECT DISTINCT workflow_id FROM workflow_runs WHERE status IN ('running','needs')").all().map((r) => workflows.find((w) => w.id === r.workflow_id)?.name),
  ].filter(Boolean);
  const lastWfRun = db.prepare("SELECT status, stop_reason FROM workflow_runs ORDER BY id DESC LIMIT 1").get() ?? { status: "none" };
  const wf1 = workflows.find((w) => w.id === 1);
  const reset = header.usage.state.session?.resetsAt;
  const facts = {
    running,
    inbox: header.inboxCount,
    session: header.usage.state.session?.pct ?? 0,
    resetClock: reset ? new Date(reset).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "",
    reviewerLast: db.prepare("SELECT r.status, r.stop_reason FROM runs r JOIN agents a ON a.id = r.agent_id WHERE a.name = 'Reviewer' ORDER BY r.id DESC LIMIT 1").get() ?? { status: "none" },
    guard: header.usage.guardPct,
    heartbeat: (machine.heartbeat?.text ?? "").match(/\d+ of \d+/)?.[0] ?? "",
    workflows: workflows.map((w) => ({ id: w.id, name: w.name, enabled: !!w.enabled })),
    lastWfRun,
    projects,
    arcade: agents.find((a) => a.name === "Arcade site")?.id ?? 0,
    wf1Review: wf1 ? JSON.parse(wf1.steps).find((s) => s.type === "review")?.id : undefined,
  };
  db.close();
  return facts;
}

// ---------- asking ----------
async function ask(question) {
  const ctx = { errors: [], ...question.ctx };
  // A fresh chat for each question, so answers don't lean on each other.
  const chat = await post("/api/helper/send", { text: question.q, context: ctx, clientId: `eval-${question.id}-${Date.now().toString(36)}` });
  const id = chat.reply.id;
  const r = await fetch(`${BASE}/api/helper/stream?msg=${id}`);
  const text = await r.text();
  const done = text.trim().split("\n").map((l) => JSON.parse(l)).find((e) => e.t === "done");
  return done?.message ?? (await get(`/api/helper?chat=${chat.chatId}`)).messages.at(-1);
}

const plain = (t) => t.replace(/\[\[[a-z]+:[^\]|]*\|([^\]]*)\]\]/g, "$1");
const wordCount = (t) => plain(t).split(/\s+/).filter((w) => /\w/.test(w)).length;
const JARGON = /snapshot|lookup|look-?up tool|\b(run|wfrun|agent|workflow) \d+\b(?! ?(hours?|minutes?|mins?|days?|seconds?|weeks?|times?|%))|\[(run|agent|workflow|wfrun) \d+\]|```|\/Users\/|~\/|\.tsx?\b|\bnpm\b|\bgit (push|commit|checkout)/i;

function grade(question, m, facts) {
  const problems = [];
  if (!m) return ["no reply"];
  if (m.status !== "done") problems.push(`reply status ${m.status}`);
  if (m.meta?.cutOff) problems.push(`cut off (${m.meta.cutOff})`);
  const text = m.text ?? "";
  const all = plain(text) + " " + (m.meta?.actions ?? []).map((a) => `${a.label} ${a.task ?? ""}`).join(" ");
  const n = wordCount(text);
  const max = question.max ?? 100;
  if (n > max) problems.push(`too long: ${n} words (max ${max})`);
  if (JARGON.test(text)) problems.push(`jargon or ids: "${text.match(JARGON)[0]}"`);
  const bad = Object.entries(m.meta?.chips ?? {}).filter(([, v]) => v === null).map(([k]) => k);
  if (bad.length) problems.push(`made-up links: ${bad.join(", ")}`);
  for (const p of question.must ?? []) {
    const any = Array.isArray(p) ? p : [p];
    if (!any.some((re) => re.test(all))) problems.push(`missing ${any.map(String).join(" or ")}`);
  }
  for (const re of question.mustNot ?? []) if (re.test(all)) problems.push(`should not say ${re}`);
  const kinds = (m.meta?.actions ?? []).map((a) => a.kind);
  for (const k of question.actions ?? []) {
    const any = Array.isArray(k) ? k : [k];
    if (!any.some((x) => kinds.includes(x))) problems.push(`no ${any.join(" or ")} button`);
  }
  for (const k of question.noActions ?? []) if (kinds.includes(k)) problems.push(`shouldn't offer ${k}`);
  const extra = question.check?.(m, facts);
  if (extra) problems.push(extra);
  return problems;
}

// ---------- main ----------
const facts = await readFacts();
const questions = QUESTIONS(facts).filter((q) => !ONLY || ONLY.has(q.id));
console.log(`Asking ${questions.length} questions on ${BASE} (facts: session ${facts.session}%, inbox ${facts.inbox}, running ${facts.running.join(", ") || "nothing"})\n`);
const results = new Array(questions.length);
let next = 0;
await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    while (next < questions.length) {
      const i = next++;
      const q = questions[i];
      const t0 = Date.now();
      let m = null;
      let problems;
      try {
        m = await ask(q);
        problems = grade(q, m, facts);
      } catch (e) {
        problems = [`error: ${e.message}`];
      }
      results[i] = { q, m, problems, secs: Math.round((Date.now() - t0) / 1000) };
      console.log(`${problems.length ? "✗" : "✓"} ${q.id}: ${q.q}${problems.length ? `\n    ${problems.join("\n    ")}` : ""}`);
    }
  }),
);

const passed = results.filter((r) => !r.problems.length).length;
const md = [
  `# Helper test set: ${passed} of ${results.length} pass`,
  "",
  `Run ${new Date().toLocaleString("en-US")} against ${BASE}. Facts read from the dev copy: session ${facts.session}% used, Inbox ${facts.inbox}, running: ${facts.running.join(", ") || "nothing"}, heartbeat ${facts.heartbeat}.`,
  "",
  ...results.flatMap((r) => [
    `## ${r.problems.length ? "✗" : "✓"} ${r.q.id} · ${r.q.ctx.panels ? "Start a task panel" : r.q.ctx.path}`,
    `**Nic:** ${r.q.q}`,
    "",
    `**Helper** (${r.m ? wordCount(r.m.text) : 0} words, ${r.secs}s): ${r.m ? plain(r.m.text).replace(/\n+/g, " ⏎ ") : "(none)"}`,
    r.m?.meta?.actions?.length ? `Buttons: ${r.m.meta.actions.map((a) => a.label).join(" · ")}` : "",
    r.problems.length ? `Problems: ${r.problems.join("; ")}` : "",
    "",
  ]),
].filter((l, i, a) => l || a[i - 1]).join("\n");
fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "last-results.md"), md);
console.log(`\n${passed} of ${results.length} pass`);
process.exit(passed === results.length ? 0 : 1);
