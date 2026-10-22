import { getAgent, getSetting, getWorkflow, listWfRuns, readRecentRuns } from "./db";
import type { HelperContext } from "./helperTypes";
import { inboxCount } from "./inbox";
import { usageState } from "./usage";
import { agentView } from "./views";
import { activeWfRun } from "./workflowRunner";

// 2–3 questions under the Helper's input that fit the page and what's going on.
// A question ending in "…" fills the box instead of sending, so Nic can finish it.

export function suggestions(ctx: HelperContext): string[] {
  const p = ctx.path || "/";
  const out: string[] = [];
  if (getSetting<boolean>("pausedAll", false)) out.push("Why is everything paused?");
  const u = usageState();

  if (p === "/") {
    out.push("What's running right now?");
    out.push(inboxCount() ? "What needs me?" : "What can my agents do?");
    if (readRecentRuns(5).some((r) => r.status === "stopped" && r.endedAt && Date.now() - r.endedAt < 86400_000)) out.push("Why did something stop?");
    out.push("Make me an agent that…");
  } else if (/^\/agents\/new/.test(p) || /^\/agents\/\d+\/edit/.test(p)) {
    out.push("Help me write what it should do", "Which way of working should I pick?", "Make me an agent that…");
  } else if (/^\/agents\/\d+/.test(p)) {
    const a = ctx.agentId ? getAgent(ctx.agentId) : null;
    const v = a ? agentView(a) : null;
    if (a?.kind === "heartbeat") out.push("What is the heartbeat?", "Is it checking in on time?");
    else {
      if (v?.status === "stopped") out.push("Why did this stop?");
      if (v?.status === "needs") out.push("What does it need from me?");
      out.push(v?.status === "working" ? "What is this agent doing?" : "What is this agent for?");
      out.push("Give me a task idea for it");
    }
  } else if (p === "/workflows") {
    out.push("What is a workflow?", "Help me build a workflow");
  } else if (p === "/workflows/new") {
    out.push("Help me build a workflow", "Which template should I pick?");
  } else if (/^\/workflows\/\d+/.test(p)) {
    const w = ctx.workflowId ? getWorkflow(ctx.workflowId) : null;
    if (ctx.stepId) out.push("What does this step do?");
    const active = w ? activeWfRun(w.id) : null;
    const last = w ? listWfRuns(w.id, 1)[0] : null;
    if (active) out.push(active.status === "needs" ? "What is it waiting for?" : "What's happening in this run?");
    else if (last?.status === "stopped") out.push("Why did this stop?");
    out.push("What does this workflow do?", "Help me build a workflow");
  } else if (p.startsWith("/inbox")) {
    out.push(inboxCount() ? "What should I do first?" : "What will show up here?", "What is a pull request?");
  } else if (p.startsWith("/projects")) {
    out.push("How do I add a project?", "What's a repo?");
  } else if (p.startsWith("/settings")) {
    out.push("What does the usage limit do?", "What should I set it to?");
  } else if (p.startsWith("/help")) {
    out.push("What should I try first?", "What does the usage meter mean?");
  }
  // An error on screen comes first, unless "Why did this stop?" already covers it.
  if (ctx.errors.length && !out.includes("Why did this stop?")) out.unshift("What does this error mean?");
  if (u.session && u.session.pct >= 75 && out.length < 3) out.push("Will I run out of usage?");
  if (out.length < 2) out.push("What can you help me with?");
  return [...new Set(out)].slice(0, 3);
}
