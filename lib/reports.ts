import { db, getAgent } from "./db";
import { addNotice } from "./notices";
import { notify } from "./notify";
import { projectPath } from "./projects";
import { carefulLine, log, sh } from "./runner";
import { reportTitle, shortAnswer } from "./research";
import type { Run } from "./types";

// Research reports: saved in the panel (Report page, PDF, Markdown), announced in the Inbox, optionally added to a project.

export type Report = {
  id: number; agentId: number; runId: number; question: string; title: string; markdown: string; reviewed: string | null;
  project: string | null; prUrl: string | null; createdAt: number;
};

type Row = { id: number; agent_id: number; run_id: number; question: string; title: string; markdown: string; reviewed: string | null; project: string | null; pr_url: string | null; created_at: number };
const toReport = (r: Row): Report => ({
  id: r.id, agentId: r.agent_id, runId: r.run_id, question: r.question, title: r.title, markdown: r.markdown, reviewed: r.reviewed,
  project: r.project, prUrl: r.pr_url, createdAt: r.created_at,
});

export function getReport(id: number): Report | null {
  const r = db().prepare("SELECT * FROM reports WHERE id = ?").get(id) as Row | undefined;
  return r ? toReport(r) : null;
}

export function reportForRun(runId: number): Report | null {
  const r = db().prepare("SELECT * FROM reports WHERE run_id = ?").get(runId) as Row | undefined;
  return r ? toReport(r) : null;
}

export function listReports(agentId?: number): Report[] {
  const rows = (agentId ? db().prepare("SELECT * FROM reports WHERE agent_id = ? ORDER BY id DESC").all(agentId) : db().prepare("SELECT * FROM reports ORDER BY id DESC LIMIT 100").all()) as Row[];
  return rows.map(toReport);
}

export async function saveReport(run: Run): Promise<Report | null> {
  const agent = getAgent(run.agentId);
  if (!agent || !run.result?.trim()) return null;
  const md = run.result.trim();
  const question = run.extra.followUp ? run.task : agent.prompt;
  const title = reportTitle(md, agent.name);
  const project = run.extra.project ?? agent.project ?? "";
  const reviewed = carefulLine(run.extra.flow)?.replace(" · polished", "") ?? null;
  const id = db()
    .prepare("INSERT OR REPLACE INTO reports (agent_id, run_id, question, title, markdown, reviewed, project, created_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(agent.id, run.id, question, title, md, reviewed, project || null, Date.now()).lastInsertRowid as number;
  log(run.id, `Report saved: "${title}"`);
  let prUrl: string | null = null;
  if (agent.job.saveReport && project && run.worktree && run.branch) prUrl = await addToProject(run, title, md, project).catch((e) => (log(run.id, `Couldn't add it to the project: ${String(e)}`), null));
  if (prUrl) db().prepare("UPDATE reports SET pr_url = ? WHERE id = ?").run(prUrl, id);
  addNotice({
    kind: "report", key: `report:${id}`, title: `Report: ${title}`, text: shortAnswer(md), link: `/reports/${id}`, prUrl, playUrl: null, agentId: agent.id, runId: run.id,
  });
  notify(agent, "finished", `wrote you a report: “${title}”. ${shortAnswer(md).slice(0, 300)}`);
  return getReport(id);
}

// "Save the report in the project": reports/<name>.md on the job's branch, as a pull request.
async function addToProject(run: Run, title: string, md: string, project: string): Promise<string | null> {
  const dir = run.worktree!;
  if (!projectPath(project)) return null;
  const name = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || `report-${run.id}`;
  const fs = await import("node:fs");
  fs.mkdirSync(`${dir}/reports`, { recursive: true });
  fs.writeFileSync(`${dir}/reports/${name}.md`, `${md}\n`);
  await sh("git", ["add", `reports/${name}.md`], dir);
  await sh("git", ["commit", "-m", `Add report: ${title.slice(0, 60)}\n\nResearched by an agent from agentbox.`], dir);
  const push = await sh("git", ["push", "-u", "origin", `HEAD:refs/heads/${run.branch}`], dir);
  if (!push.ok) return null;
  const base = (await sh("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], dir)).out.replace(/^origin\//, "") || "main";
  const pr = await sh("gh", ["pr", "create", "--base", base, "--head", run.branch!, "--title", `Report: ${title}`.slice(0, 120), "--body", `${shortAnswer(md)}\n\nA research report from agentbox, saved in reports/${name}.md.`], dir);
  const url = pr.out.split("\n").filter((l) => l.startsWith("http")).pop() ?? null;
  if (url) log(run.id, `Report added to the project: ${url}`);
  return url;
}
