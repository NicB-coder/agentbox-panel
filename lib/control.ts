import { getSetting, setSetting } from "./db";
import { inboxCount } from "./inbox";
import { stopAllRuns } from "./runner";
import type { HeaderState } from "./types";
import { refreshUsage, usageView } from "./usage";
import { stopAllWorkflowRuns } from "./workflowRunner";

// "Pause everything": stop what's running now, and hold schedules, workflows and queued runs until Resume.
export function pauseEverything() {
  setSetting("pausedAll", true);
  stopAllRuns();
  stopAllWorkflowRuns();
}

export function resumeEverything() {
  setSetting("pausedAll", false);
}

export function headerState(): HeaderState {
  refreshUsage(); // at most every few minutes; free
  return {
    inboxCount: inboxCount(),
    pausedAll: getSetting<boolean>("pausedAll", false),
    usage: usageView(),
    tourDone: getSetting<boolean>("tourDone", false),
  };
}
