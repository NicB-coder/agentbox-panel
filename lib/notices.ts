import { db, getAgent, getRun, getWfRun, getWorkflow } from "./db";
import { sendDiscord } from "./notify";
import { canPreview } from "./preview";
import type { Run } from "./types";
import { plainText } from "./words";

// Things that happened that Nic should hear about once: "Shipped: Arcade site", finished reports.
// They stay in the Inbox until he opens them.

export type Notice = {
  id: number; kind: "shipped" | "report"; title: string; text: string; link: string | null; prUrl: string | null; playUrl: string | null;
  agentId: number | null; runId: number | null; createdAt: number; openedAt: number | null;
};

type Row = { id: number; kind: string; title: string; text: string; link: string | null; pr_url: string | null; play_url: string | null; agent_id: number | null; run_id: number | null; created_at: number; opened_at: number | null };
const toNotice = (r: Row): Notice => ({
  id: r.id, kind: r.kind as Notice["kind"], title: r.title, text: r.text, link: r.link, prUrl: r.pr_url, playUrl: r.play_url, agentId: r.agent_id, runId: r.run_id,
  createdAt: r.created_at, openedAt: r.opened_at,
});

// Adds one (once per key). Returns it, or null if it was already there.
export function addNotice(n: Omit<Notice, "id" | "createdAt" | "openedAt"> & { key: string }): Notice | null {
  const r = db()
    .prepare("INSERT OR IGNORE INTO notices (kind, key, title, text, link, pr_url, play_url, agent_id, run_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(n.kind, n.key, n.title, n.text, n.link, n.prUrl, n.playUrl, n.agentId, n.runId, Date.now());
  if (!r.changes) return null;
  return toNotice(db().prepare("SELECT * FROM notices WHERE id = ?").get(r.lastInsertRowid) as Row);
}

export function listNotices(): Notice[] {
  // Unopened ones always; opened ones for a week, for the "Done & shipped" and "Reports" filters.
  return (db().prepare("SELECT * FROM notices WHERE opened_at IS NULL OR opened_at > ? ORDER BY id DESC LIMIT 100").all(Date.now() - 7 * 86400_000) as Row[]).map(toNotice);
}

export function unopenedNotices(): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM notices WHERE opened_at IS NULL").get() as { n: number }).n;
}

export function openNotice(id: number) {
  db().prepare("UPDATE notices SET opened_at = ? WHERE id = ? AND opened_at IS NULL").run(Date.now(), id);
}

// A job's pull request was merged (by Nic, Install it, or noticed on GitHub): "Shipped: <job>".
export async function onMerged(runId: number) {
  const run = getRun(runId);
  const agent = run && getAgent(run.agentId);
  if (!run?.prUrl || !agent) return;
  await shipped({
    key: `pr:${run.prUrl}`,
    name: agent.kind === "helper" ? run.extra.label ?? "A workflow step" : agent.name,
    what: run.result ? plainText(run.result.split("\n")[0]) : run.task,
    prUrl: run.prUrl,
    project: run.extra.project ?? agent.project,
    agentId: agent.kind === "claude" ? agent.id : null,
    runId: run.id,
    tell: agent.notify.length > 0,
  });
}

// A workflow's Ship step merged its pull request.
export async function onWorkflowShipped(wfRunId: number) {
  const wr = getWfRun(wfRunId);
  const wf = wr && getWorkflow(wr.workflowId);
  if (!wr?.prUrl || !wf) return;
  const notes = wr.steps.map((s) => wr.stepRuns[s.id]?.note).filter(Boolean) as string[];
  await shipped({
    key: `pr:${wr.prUrl}`,
    name: wr.input ? `${wf.name}: ${wr.input.split("\n")[0].slice(0, 80)}` : wf.name,
    what: notes.filter((n) => !/^You (started|said)/.test(n)).slice(-3)[0] ?? "It's in your project now.",
    prUrl: wr.prUrl,
    project: wf.project,
    agentId: null,
    runId: null,
    tell: false, // the workflow's own Tell me step sends the message
  });
}

async function shipped(s: { key: string; name: string; what: string; prUrl: string; project: string; agentId: number | null; runId: number | null; tell: boolean }) {
  const play = s.project && (await canPreview(s.project).catch(() => false)) ? `/preview/${s.project}/live/` : null;
  const n = addNotice({
    kind: "shipped", key: s.key, title: `Shipped: ${s.name}`, text: s.what.slice(0, 600), link: `/changes?pr=${encodeURIComponent(s.prUrl)}`,
    prUrl: s.prUrl, playUrl: play, agentId: s.agentId, runId: s.runId,
  });
  if (n && s.tell) await sendDiscord(`${s.what}\n\nPull request: ${s.prUrl}${play ? "\nPlay it from the panel's Projects page." : ""}`, { title: `Shipped: ${s.name}`, url: s.prUrl, ping: "shipped" });
}

export type { Run };
