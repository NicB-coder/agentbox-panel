import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { db, getAgent, getRun, getWorkflow, updateRun } from "./db";
import { projectPath } from "./projects";
import { log, sh } from "./runner";

// Old copies of projects (git worktrees) are cleaned up a few days after a run ends, so the disk doesn't fill up.
// Unsaved work in a stopped run is committed and pushed to its own branch first, so nothing is lost.

const KEEP_MS = 3 * 86400_000;

export async function cleanOldCopies(now = Date.now()): Promise<number> {
  let removed = 0;
  const rows = db()
    .prepare("SELECT id FROM runs WHERE worktree IS NOT NULL AND status IN ('done','stopped','review') AND ended_at IS NOT NULL AND ended_at < ? AND workflow_run_id IS NULL")
    .all(now - KEEP_MS) as { id: number }[];
  const busy = new Set((db().prepare("SELECT worktree FROM runs WHERE status IN ('working','waiting','queued') AND worktree IS NOT NULL").all() as { worktree: string }[]).map((r) => r.worktree));
  for (const { id } of rows) {
    const run = getRun(id);
    if (!run?.worktree || busy.has(run.worktree) || !fs.existsSync(run.worktree)) continue;
    const agent = getAgent(run.agentId);
    if (run.worktree.includes(`${path.sep}research${path.sep}run-`)) {
      fs.rmSync(run.worktree, { recursive: true, force: true });
      removed++;
      continue;
    }
    const repo = agent && projectPath(run.extra.project ?? agent.project);
    if (!repo) continue;
    if (run.status === "stopped" && run.branch) {
      const st = await sh("git", ["status", "--porcelain"], run.worktree);
      if (st.out) {
        await sh("git", ["add", "-A"], run.worktree);
        await sh("git", ["commit", "-m", "Work in progress, saved by agentbox before tidying up"], run.worktree);
      }
      const push = await sh("git", ["push", "-u", "origin", `HEAD:refs/heads/${run.branch}`], run.worktree);
      if (!push.ok) continue; // keep it rather than lose work
      log(run.id, `Saved its unfinished work to the branch ${run.branch} before tidying up its copy.`);
    }
    const r = await sh("git", ["worktree", "remove", "--force", run.worktree], repo);
    if (r.ok) {
      removed++;
      log(run.id, "Its copy of the project was tidied up (older than 3 days).");
    }
  }
  // Stopped or finished workflow runs.
  const wfs = db()
    .prepare("SELECT id, workflow_id, worktree FROM workflow_runs WHERE worktree IS NOT NULL AND status IN ('done','stopped') AND ended_at IS NOT NULL AND ended_at < ?")
    .all(now - KEEP_MS) as { id: number; workflow_id: number; worktree: string }[];
  for (const w of wfs) {
    if (!fs.existsSync(w.worktree)) continue;
    const wf = getWorkflow(w.workflow_id);
    const repo = wf && projectPath(wf.project);
    if (!repo) continue;
    const r = await sh("git", ["worktree", "remove", "--force", w.worktree], repo);
    if (r.ok) removed++;
  }
  for (const p of fs.readdirSync(path.join(os.homedir(), "projects"), { withFileTypes: true })) {
    if (p.isDirectory() && fs.existsSync(path.join(os.homedir(), "projects", p.name, ".git"))) await sh("git", ["worktree", "prune"], path.join(os.homedir(), "projects", p.name));
  }
  if (removed) console.log(`[cleanup] tidied up ${removed} old copies`);
  return removed;
}

export { updateRun };
