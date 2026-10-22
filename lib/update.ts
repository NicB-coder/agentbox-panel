import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DATA_DIR, getAgent, getRun } from "./db";
import { cleanupFinished, launch } from "./proc";
import { cleanEnv, log, sh } from "./runner";

// Update agentbox: runs scripts/update-panel.sh as its own launchd job (it restarts the panel, so it can't be
// a child of it), and the panel shows its progress from the status file it writes.

export const STATUS_FILE = path.join(DATA_DIR, "update.json");

export type UpdateStatus = {
  state: "running" | "done" | "failed" | "rolledback" | "uptodate";
  step: number;
  steps: string[];
  message: string;
  startedAt: number;
  endedAt: number | null;
  from: string;
  to: string;
  pid: number;
};

export function updateStatus(): UpdateStatus | null {
  try {
    const s = JSON.parse(fs.readFileSync(STATUS_FILE, "utf8")) as UpdateStatus;
    if (s.state === "running") {
      // The updater died without finishing (e.g. the Mac restarted).
      try {
        process.kill(s.pid, 0);
      } catch {
        if (Date.now() - s.startedAt > 60_000) return { ...s, state: "failed", message: "The update stopped part-way (the Mac may have restarted). Press Update again.", endedAt: Date.now() };
      }
    }
    return s;
  } catch {
    return null;
  }
}

export function updateLog(): string {
  try {
    return fs.readFileSync(STATUS_FILE.replace(/\.json$/, ".log"), "utf8").slice(-20000);
  } catch {
    return "";
  }
}

export async function startUpdate(opts: { force?: boolean } = {}): Promise<void> {
  if (process.env.NODE_ENV !== "production" && process.env.AGENTBOX_ALLOW_UPDATE !== "1") throw new Error("Updating only works on the always-on panel, not on a test copy.");
  const cur = updateStatus();
  if (cur?.state === "running") throw new Error("An update is already going.");
  const port = Number(process.env.PORT || 3000);
  await cleanupFinished("update-").catch(() => {});
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ state: "running", step: 0, steps: [], message: "Starting…", startedAt: Date.now(), endedAt: null, from: "", to: "", pid: process.pid }));
  await launch(`update-${Date.now()}`, "/bin/zsh", [path.join(process.cwd(), "scripts", "update-panel.sh")], process.cwd(), {
    ...cleanEnv(),
    HOME: os.homedir(),
    APP_DIR: process.cwd(),
    LABEL: process.env.AGENTBOX_PANEL_LABEL || "com.agentbox.panel",
    PORT: String(port),
    STAGE_PORT: String(port + 1),
    DATA_DIR,
    STATUS: STATUS_FILE,
    BRANCH: process.env.AGENTBOX_UPDATE_BRANCH || "main",
    FORCE: opts.force ? "1" : "0",
  });
}

// "Install it" for a job that changed the panel itself: merge its pull request, then update.
export async function installFromPr(runId: number): Promise<void> {
  const run = getRun(runId);
  const agent = run && getAgent(run.agentId);
  if (!run?.prUrl || !agent) throw new Error("There's no pull request to install.");
  if ((run.extra.project ?? agent.project) !== "agentbox-panel") throw new Error("Only changes to agentbox itself can be installed here.");
  log(runId, "Installing: merging the pull request, then updating agentbox.");
  const m = await sh("gh", ["pr", "merge", run.prUrl, "--squash"], process.cwd(), 60_000);
  if (!m.ok && !/already merged/i.test(m.err)) throw new Error("GitHub wouldn't merge it. Open it on GitHub to see why.");
  log(runId, "Merged. Starting the update.");
  await startUpdate();
}
