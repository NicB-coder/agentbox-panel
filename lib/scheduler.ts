import { activeRun, listAgents, setNextRunAt } from "./db";
import { sweepProcFiles } from "./proc";
import { checkPullRequests, pausedAll, pumpRuns, recoverOnBoot, startQueued, startRun } from "./runner";
import { refreshUsage } from "./usage";
import { tickWorkflows } from "./workflowRunner";
import { nextRunAfter } from "./words";

// A small scheduler inside the server process. Every 30 seconds it starts any scheduled agent
// whose time has come, and once a minute it checks open pull requests for merges.
// Every second or so it reads what running agents wrote (they run under launchd, not inside the panel).

type G = typeof globalThis & { __agentboxBackground?: boolean; __agentboxPumping?: boolean };

export function tickSchedules(now = Date.now()) {
  // Pause everything holds schedules; dev copies (AGENTBOX_NO_SCHEDULE=1) never start scheduled runs.
  if (pausedAll() || process.env.AGENTBOX_NO_SCHEDULE === "1") return;
  for (const a of listAgents()) {
    if (a.kind !== "claude") continue;
    if (!a.enabled || a.paused || a.archived || a.scheduleKind === "manual") {
      if (a.nextRunAt !== null) setNextRunAt(a.id, null);
      continue;
    }
    // First time we see this schedule (or it was just edited/resumed): plan the next run from now.
    // Missed runs (e.g. the Mac was asleep or the panel was down) are skipped, not replayed.
    if (a.nextRunAt === null || a.nextRunAt < now - 10 * 60_000) {
      setNextRunAt(a.id, nextRunAfter(a.scheduleKind, a.scheduleDays, a.scheduleTime, now));
      continue;
    }
    if (a.nextRunAt > now) continue;
    setNextRunAt(a.id, nextRunAfter(a.scheduleKind, a.scheduleDays, a.scheduleTime, now));
    if (activeRun(a.id)) {
      console.log(`[scheduler] ${a.name} is still busy, skipping this run`);
      continue;
    }
    console.log(`[scheduler] starting ${a.name}`);
    startRun(a.id, { trigger: "schedule" }).catch((e) => console.warn(`[scheduler] ${a.name}: ${(e as Error).message}`));
  }
}

export function startBackground() {
  const g = globalThis as G;
  if (g.__agentboxBackground) return;
  g.__agentboxBackground = true;
  recoverOnBoot();
  tickSchedules();
  refreshUsage(true);
  const tick = () => {
    try {
      tickSchedules();
      startQueued();
    } catch (e) {
      console.warn("[scheduler]", e);
    }
    tickWorkflows().catch((e) => console.warn("[workflows]", e));
  };
  setTimeout(tick, 5_000);
  setInterval(tick, 30_000);
  setInterval(() => {
    if (g.__agentboxPumping) return;
    g.__agentboxPumping = true;
    try {
      pumpRuns();
    } catch (e) {
      console.warn("[runs]", e);
    } finally {
      g.__agentboxPumping = false;
    }
  }, 1_500);
  const tidy = () => {
    sweepProcFiles();
    import("./cleanup").then((m) => m.cleanOldCopies()).catch((e) => console.warn("[cleanup]", e));
  };
  setTimeout(tidy, 60_000);
  setInterval(tidy, 6 * 3600_000);
  setInterval(() => refreshUsage(), 5 * 60_000);
  setInterval(() => checkPullRequests().catch((e) => console.warn("[pr-check]", e)), 60_000);
  console.log("[agentbox] scheduler running");
}
