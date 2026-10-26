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
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true }));
const ro = new Database(src, { readonly: true, fileMustExist: true });
await ro.backup(path.join(tmp, "agentbox.db"));

type Row = Record<string, unknown>;
type Db = Database.Database;
const tables = (d: Db) => (d.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map((r) => r.name);
const cols = (d: Db, t: string) => (d.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
const count = (d: Db, t: string) => (d.prepare(`SELECT count(*) AS n FROM ${t}`).get() as { n: number }).n;
// Rows are matched by rowid, which adding columns never changes.
const rows = (d: Db, t: string) => new Map((d.prepare(`SELECT rowid AS _rowid, * FROM ${t}`).all() as Row[]).map((r) => [r._rowid, r]));
const before = new Map<string, { cols: string[]; rows: Map<unknown, Row> }>();
for (const t of tables(ro)) before.set(t, { cols: cols(ro, t), rows: rows(ro, t) });
ro.close();

// Opening the panel's database runs the same migration the panel runs when it starts.
process.env.AGENTBOX_DATA_DIR = tmp;
const db = await import("../lib/db");
const { inboxState } = await import("../lib/inbox");
const d = db.db();

const problems: string[] = [];
const report: string[] = [];
for (const [t, b] of before) {
  const after = rows(d, t);
  let changed = 0;
  let missing = 0;
  for (const [id, r] of b.rows) {
    const a = after.get(id);
    if (!a) missing++;
    else if (b.cols.some((c) => JSON.stringify(a[c]) !== JSON.stringify(r[c]))) changed++;
  }
  const added = cols(d, t).filter((c) => !b.cols.includes(c));
  report.push(`${t}: ${b.rows.size} before, ${after.size} after${added.length ? `, new columns: ${added.join(", ")}` : ""}`);
  if (missing) problems.push(`${t}: ${missing} rows are gone`);
  if (changed) problems.push(`${t}: ${changed} rows changed`);
}
const now = tables(d);
for (const t of now) if (!before.has(t)) report.push(`${t}: new table (${count(d, t)} rows)`);
for (const [t, c] of [["workflow_runs", "quiet"], ["workflow_runs", "pr_waiting"], ["file_prs", "pr_url"]] as const) {
  if (!now.includes(t) || !cols(d, t).includes(c)) problems.push(`${t}.${c} is missing after the migration`);
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
  report.push(`Read back: ${agents.length} agents, ${runs} runs, ${workflows.length} workflows, ${versions} versions, ${wfRuns} workflow runs, ${inboxState().items.length} Inbox items`);
} catch (e) {
  problems.push(`Reading it back failed: ${(e as Error).message}`);
}

// Starting a second time must change nothing.
const snapshot = (x: Db) => tables(x).map((t) => `${t}:${cols(x, t).join(",")}:${count(x, t)}`).join("|");
const first = snapshot(d);
d.close();
delete (globalThis as { __agentboxDb?: unknown }).__agentboxDb;
if (snapshot(db.db()) !== first) problems.push("Starting a second time changed the database");
if (db.db().pragma("integrity_check", { simple: true }) !== "ok") problems.push("The database copy failed its integrity check");

console.log(report.join("\n"));
if (problems.length) {
  console.log("\nPROBLEMS:\n" + problems.join("\n"));
  process.exit(1);
}
console.log("\nOK: every old row is kept unchanged, the new columns and table are there, and everything reads back.");
