import { getRun, helperAgentId, runsWithStatus } from "./db";
import { patchExtra, startRun } from "./runner";
import type { Run } from "./types";

// Reviews of pull requests that weren't made in Careful mode (Quick tasks, workflows, and "Get a second opinion").
// A look-only reviewer (Opus) reads the pull request's branch and writes findings; the Inbox shows them
// with Send back to fix, which continues the same job.

export function reviewPrompt(prUrl: string, task: string | null): string {
  return [
    `Review this pull request for Nic: ${prUrl}`,
    task ? `\nWhat it was meant to do:\n${task}` : "",
    "",
    "You're in a copy of the project with the pull request's changes checked out. Read the pull request and its comments (gh pr view --comments), look at what changed (gh pr diff), and run the tests or open the page if you can, without changing anything.",
    "Does it do what was asked? Are there bugs, broken or risky changes, or missing pieces? Only real problems, not style preferences.",
    "Write a short review in plain words for a high-school developer: one line on what's good, then a numbered list of what should be fixed (or say nothing needs fixing).",
    "End with exactly one line:",
    "VERDICT: passed",
    "or",
    "VERDICT: needs work",
  ].join("\n");
}

async function branchOf(prUrl: string, cwd: string): Promise<string | null> {
  const { sh } = await import("./runner");
  const r = await sh("gh", ["pr", "view", prUrl, "--json", "headRefName", "--jq", ".headRefName"], cwd, 30_000);
  return r.ok && r.out ? r.out : null;
}

// Starts a review of a run's pull request. Returns the reviewer's run.
export async function reviewRunPr(source: Run, opts: { model?: "opus" | "sonnet" } = {}): Promise<Run> {
  if (!source.prUrl) throw new Error("There's no pull request for this.");
  if (source.extra.review?.status === "running") throw new Error("A reviewer is already looking at it.");
  const { projectPath } = await import("./projects");
  const project = source.extra.project ?? "";
  const repo = projectPath(project);
  if (!repo) throw new Error(`Can't find the project "${project}" on this Mac.`);
  const branch = await branchOf(source.prUrl, repo);
  if (!branch) throw new Error("Couldn't find that pull request on GitHub.");
  const run = await startRun(helperAgentId(), {
    task: `Review: ${source.task}`.slice(0, 200),
    mode: "look",
    trigger: "manual",
    project,
    extra: {
      label: "Reviewer", role: "review", allowed: "look", model: opts.model ?? "opus", maxMinutes: 20, careful: false,
      prompt: reviewPrompt(source.prUrl, source.task), checkoutRef: `origin/${branch}`, prReview: { prUrl: source.prUrl, sourceRunId: source.id },
    },
  });
  patchExtra(source.id, { review: { runId: run.id, status: "running", at: Date.now() } });
  return run;
}

// A pull request that agentbox didn't make (or whose job is gone): reviewed once per visit to See what changed.
export async function reviewExternalPr(prUrl: string, project: string): Promise<void> {
  const { getSetting, setSetting } = await import("./db");
  const cur = getSetting<{ status: string; at: number } | null>(`review:${prUrl}`, null);
  if (cur && (cur.status === "running" || Date.now() - cur.at < 6 * 3600_000)) return;
  const { projectPath } = await import("./projects");
  const repo = projectPath(project);
  if (!repo) return;
  const branch = await branchOf(prUrl, repo);
  if (!branch) return;
  const run = await startRun(helperAgentId(), {
    task: `Review: pull request #${prUrl.split("/").pop()}`, mode: "look", trigger: "manual", project,
    extra: { label: "Reviewer", role: "review", allowed: "look", model: "opus", maxMinutes: 20, careful: false, prompt: reviewPrompt(prUrl, null), checkoutRef: `origin/${branch}`, prReview: { prUrl, sourceRunId: null } },
  });
  setSetting(`review:${prUrl}`, { runId: run.id, status: "running", at: Date.now() });
}

// Called when a reviewer run ends: copy its findings onto the run whose pull request it reviewed.
export function onReviewEnded(reviewRun: Run) {
  const src = reviewRun.extra.prReview?.sourceRunId;
  const source = src ? getRun(src) : null;
  const text = reviewRun.result ?? "";
  const verdict = /VERDICT:\s*needs work/i.test(text) ? "needs work" : "passed";
  if (!source) {
    const url = reviewRun.extra.prReview?.prUrl;
    if (url) import("./db").then((m) => m.setSetting(`review:${url}`, { runId: reviewRun.id, status: reviewRun.status === "done" ? "done" : "stopped", verdict, text: text.replace(/^\s*VERDICT:.*$/gim, "").trim().slice(0, 8000), at: Date.now() }));
    return;
  }
  patchExtra(source.id, {
    review: { runId: reviewRun.id, status: reviewRun.status === "done" ? "done" : "stopped", verdict, text: text.replace(/^\s*VERDICT:.*$/gim, "").trim().slice(0, 8000), at: Date.now() },
  });
}

export function reviewsRunning(): number {
  return runsWithStatus("working", "queued").filter((r) => r.extra.prReview).length;
}
