import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DATA_DIR, db, getAgent, getRun, getSetting } from "./db";
import { canPreview, previewDir, refToken } from "./preview";
import { listProjects, projectPath } from "./projects";
import { carefulLine, sh } from "./runner";
import type { Run } from "./types";
import { plainText } from "./words";

// "See what changed" for any pull request: a plain-English summary, before/after pictures when it's a page or game,
// and the code changes behind a toggle.

export type PrFile = { path: string; additions: number; deletions: number };
export type ChangesView = {
  prUrl: string;
  number: number;
  title: string;
  state: "OPEN" | "MERGED" | "CLOSED";
  project: string | null;
  branch: string;
  summary: string;
  careful: string | null;
  review: { status: "running" | "done" | "stopped"; verdict?: "passed" | "needs work"; text?: string } | null;
  files: PrFile[];
  additions: number;
  deletions: number;
  clash: boolean; // a newer change touched the same lines: it can't go in as it is
  run: { id: number; agentId: number; agentName: string; task: string } | null;
  playable: boolean;
  before: string | null; // preview tokens
  after: string | null;
  page: string; // which page the pictures are of
};

const PR_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/;
export const validPr = (u: string) => PR_URL.test(u);

// The project on this Mac that this pull request belongs to.
async function projectFor(prUrl: string): Promise<string | null> {
  const repo = prUrl.split("/").slice(3, 5).join("/").toLowerCase();
  for (const p of listProjects()) {
    const r = await sh("git", ["remote", "get-url", "origin"], projectPath(p)!, 10_000);
    if (r.ok && r.out.toLowerCase().replace(/\.git$/, "").endsWith(repo)) return p;
  }
  return null;
}

export function runForPr(prUrl: string): Run | null {
  const r = db().prepare("SELECT id FROM runs WHERE pr_url = ? ORDER BY id DESC LIMIT 1").get(prUrl) as { id: number } | undefined;
  return r ? getRun(r.id) : null;
}

export async function changesView(prUrl: string): Promise<ChangesView | null> {
  if (!validPr(prUrl)) return null;
  const project = await projectFor(prUrl);
  const cwd = (project && projectPath(project)) || os.homedir();
  const r = await sh("gh", ["pr", "view", prUrl, "--json", "number,title,state,headRefName,body,additions,deletions,files,mergeCommit,mergeable"], cwd, 30_000);
  if (!r.ok) return null;
  const pr = JSON.parse(r.out) as {
    number: number; title: string; state: ChangesView["state"]; headRefName: string; body: string; additions: number; deletions: number;
    files: PrFile[]; mergeCommit: { oid: string } | null; mergeable?: string;
  };
  const run = runForPr(prUrl);
  const agent = run && getAgent(run.agentId);
  const first = runForPrFirst(prUrl);
  let summary = run?.result ? plainText(run.result) : "";
  if (!summary) {
    const what = pr.body.match(/\*\*What it did:\*\*\s*(.+)/)?.[1];
    summary = plainText(what ?? pr.body.split(/\n\s*\n/).find((p) => p.trim() && !p.startsWith("<")) ?? pr.title).slice(0, 1200);
  }
  const playable = !!project && (await canPreview(project));
  let before: string | null = null;
  let after: string | null = null;
  if (playable && project) {
    if (pr.state === "MERGED" && pr.mergeCommit) {
      const parent = await sh("git", ["rev-parse", `${pr.mergeCommit.oid}^`], cwd, 10_000);
      after = `sha-${pr.mergeCommit.oid.slice(0, 12)}`;
      before = parent.ok ? `sha-${parent.out.slice(0, 12)}` : null;
    } else if (pr.state === "OPEN") {
      before = "live";
      after = refToken(pr.headRefName);
    }
  }
  const html = pr.files.map((f) => f.path).find((p) => /\.html?$/i.test(p) && !/(^|\/)(tests?|node_modules)\//.test(p));
  const page = html ? html.replace(/^(public|dist|build|out|docs|site|www)\//, "").replace(/(^|\/)index\.html$/, "$1") : "";
  const review = run?.extra.review ?? getSetting<ChangesView["review"]>(`review:${prUrl}`, null);
  return {
    prUrl, number: pr.number, title: pr.title, state: pr.state, project, branch: pr.headRefName, summary,
    careful: carefulLine(run?.extra.flow) ?? carefulLine(first?.extra.flow), review: review ? { status: review.status, verdict: review.verdict, text: review.text } : null,
    files: pr.files.map((f) => ({ path: f.path, additions: f.additions, deletions: f.deletions })), additions: pr.additions, deletions: pr.deletions,
    run: run && agent ? { id: run.id, agentId: agent.id, agentName: agent.name, task: run.task } : null,
    playable, before, after, page, clash: pr.state === "OPEN" && pr.mergeable === "CONFLICTING",
  };
}

function runForPrFirst(prUrl: string): Run | null {
  const r = db().prepare("SELECT id FROM runs WHERE pr_url = ? AND extra LIKE '%\"careful\":true%' ORDER BY id DESC LIMIT 1").get(prUrl) as { id: number } | undefined;
  return r ? getRun(r.id) : null;
}

export async function prDiff(prUrl: string): Promise<string> {
  const project = await projectFor(prUrl);
  const r = await sh("gh", ["pr", "diff", prUrl], (project && projectPath(project)) || os.homedir(), 30_000);
  return r.ok ? r.out.slice(0, 400_000) : "";
}

// ---------- before/after pictures ----------

export const SHOT_DIR = path.join(DATA_DIR, "shots");
const shotKey = (project: string, before: string, after: string, page: string) => crypto.createHash("sha1").update([project, before, after, page].join("|")).digest("hex").slice(0, 16);

export function shotFiles(project: string, before: string, after: string, page: string) {
  const dir = path.join(SHOT_DIR, shotKey(project, before, after, page));
  const names = ["before-laptop", "after-laptop", "before-phone", "after-phone"];
  return { dir, names, ready: names.every((n) => fs.existsSync(path.join(dir, `${n}.png`))) };
}

type G = typeof globalThis & { __shooting?: Set<string> };
const shooting = ((globalThis as G).__shooting ??= new Set());

// Opens the before and after versions in a real browser (laptop and phone width) and saves pictures.
export async function takeShots(project: string, before: string, after: string, page: string, port: number): Promise<boolean> {
  const { dir, names, ready } = shotFiles(project, before, after, page);
  if (ready) return true;
  if (shooting.has(dir)) return false;
  shooting.add(dir);
  try {
    for (const t of [before, after]) await previewDir(project, t);
    fs.mkdirSync(dir, { recursive: true });
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    try {
      for (const name of names) {
        const [which, size] = name.split("-");
        const p = await browser.newPage({ viewport: size === "phone" ? { width: 390, height: 844 } : { width: 1366, height: 860 }, deviceScaleFactor: 1 });
        await p.goto(`http://127.0.0.1:${port}/preview/${project}/${which === "before" ? before : after}/${page}`, { waitUntil: "load", timeout: 20_000 }).catch(() => {});
        await p.waitForTimeout(800);
        await p.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true, clip: undefined });
        await p.close();
      }
    } finally {
      await browser.close();
    }
    return true;
  } catch (e) {
    console.warn("[shots]", e);
    return false;
  } finally {
    shooting.delete(dir);
  }
}
