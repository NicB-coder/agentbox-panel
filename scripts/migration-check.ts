// Checks that a copy of a real database survives the upgrade: every old row is still there and unchanged, the new
// columns and tables are added, and the panel can read every agent, workflow, run and Inbox item from it.
// It never opens the database you give it for writing: it copies it to a temporary folder first.
//   node --import ./tests/register.mjs scripts/migration-check.ts path/to/agentbox.db
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error("Give it the path to a copy of the database.");
  process.exit(2);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentbox-migration-"));
const ro = new Database(src, { readonly: true, fileMustExist: true });
await ro.backup(path.join(tmp, "agentbox.db"));

type Row = Record<string, unknown>;
const tables = (d: Database.Database) =>
  (d.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map((r) => r.name);
const cols = (d: Database.Database, t: string) => (d.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
const before = new Map<string, { cols: string[]; rows: Row[] }>();
for (const t of tables(ro)) before.set(t, { cols: cols(ro, t), rows: ro.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all() as Row[] });
ro.close();

// Opening the panel's database runs the same migration the panel runs when it starts.
process.env.AGENTBOX_DATA_DIR = tmp;
const db = await import("../lib/db");
const { inboxState } = await import("../lib/inbox");
const d = db.db();

const problems: string[] = [];
const report: string[] = [];
for (const [t, b] of before) {
  const after = d.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all() as Row[];
  const byKey = new Map(after.map((r) => [JSON.stringify(b.cols.map((c) => (c === "id" || c === "key" ? r[c] : null))), r]));
  let changed = 0;
  let missing = 0;
  for (const r of b.rows) {
    const a = byKey.get(JSON.stringify(b.cols.map((c) => (c === "id" || c === "key" ? r[c] : null))));
    if (!a) {
      missing++;
      continue;
    }
    if (b.cols.some((c) => JSON.stringify(a[c]) !== JSON.stringify(r[c]))) changed++;
  }
  const added = cols(d, t).filter((c) => !b.cols.includes(c));
  report.push(`${t}: ${b.rows.length} before, ${after.length} after${added.length ? `, new columns: ${added.join(", ")}` : ""}`);
  if (missing) problems.push(`${t}: ${missing} rows are gone`);
  if (changed) problems.push(`${t}: ${changed} rows changed`);
}
for (const t of tables(d)) if (!before.has(t)) report.push(`${t}: new table (${(d.prepare(`SELECT count(*) AS n FROM ${t}`).get() as { n: number }).n} rows)`);
for (const [t, c] of [["workflow_runs", "quiet"], ["workflow_runs", "pr_waiting"], ["file_prs", "pr_url"]] as const) {
  if (!tables(d).includes(t) || !cols(d, t).includes(c)) problems.push(`${t}.${c} is missing after the migration`);
}

// Read everything back the way the pages do.
try {
  const agents = db.listAgents();
  let runs = 0;
  for (const id of [...agents.map((a) => a.id), db.helperAgentId()]) runs += db.listRuns(id, 100_000).length; // + the hidden workflow-step agent
  const workflows = db.listWorkflows();
  let wfRuns = 0;
  let versions = 0;
  for (const w of workflows) {
    wfRuns += db.listWfRuns(w.id, 100_000).length;
    versions += db.listVersions(w.id).length;
  }
  const inbox = inboxState();
  report.push(`Read back: ${agents.length} agents, ${runs} runs, ${workflows.length} workflows, ${versions} versions, ${wfRuns} workflow runs, ${inbox.items.length} Inbox items`);
} catch (e) {
  problems.push(`Reading it back failed: ${(e as Error).message}`);
}
// Running it a second time must change nothing.
d.close();
const again = new Database(path.join(tmp, "agentbox.db"));
const snapshot = (x: Database.Database) => tables(x).map((t) => `${t}:${cols(x, t).join(",")}:${(x.prepare(`SELECT count(*) AS n FROM ${t}`).get() as { n: number }).n}`).join("|");
const first = snapshot(again);
again.close();
delete (globalThis as { __agentboxDb?: unknown }).__agentboxDb;
db.db();
const second = snapshot(db.db());
if (first !== second) problems.push("Starting a second time changed the database");
if (db.db().pragma("integrity_check", { simple: true }) !== "ok") problems.push("The database copy failed its integrity check");

console.log(report.join("\n"));
fs.rmSync(tmp, { recursive: true, force: true });
if (problems.length) {
  console.log("\nPROBLEMS:\n" + problems.join("\n"));
  process.exit(1);
}
console.log("\nOK: every old row is kept unchanged, the new columns and table are there, and everything reads back.");
