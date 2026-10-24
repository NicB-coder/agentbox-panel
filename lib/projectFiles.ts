import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { db } from "./db";
import { projectPath } from "./projects";

// Projects → "Add a file": the file goes on a new branch files/<name> as one commit, and a pull request opens.
// Nic merges it from the Inbox with one click, so he never needs GitHub or Terminal.

export const MAX_FILE = 5_000_000;
const WORKTREES = path.join(os.homedir(), "agents", "worktrees");
const PATH = [path.join(os.homedir(), ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].join(":");

export type FilePr = { id: number; project: string; file: string; branch: string; prUrl: string; replaces: boolean; status: "open" | "merged" | "closed"; createdAt: number };
type Row = { id: number; project: string; file: string; branch: string; pr_url: string; replaces: number; status: string; created_at: number };
const toFilePr = (r: Row): FilePr => ({ id: r.id, project: r.project, file: r.file, branch: r.branch, prUrl: r.pr_url, replaces: !!r.replaces, status: r.status as FilePr["status"], createdAt: r.created_at });

function sh(cmd: string, args: string[], cwd: string, timeout = 120_000): Promise<{ ok: boolean; out: string; err: string }> {
  const env: NodeJS.ProcessEnv = { ...process.env, PATH, GIT_TERMINAL_PROMPT: "0" };
  return new Promise((resolve) =>
    execFile(cmd, args, { cwd, timeout, env, maxBuffer: 10 * 1024 * 1024, encoding: "utf8" }, (e, out, err) => resolve({ ok: !e, out: String(out).trim(), err: String(err).trim() })),
  );
}

// A safe file name for the top of the project: no folders, no hidden files.
export function cleanFileName(name: unknown): string | null {
  const n = path.basename(String(name ?? "")).replace(/[^\w.\- ]+/g, "").trim().slice(0, 100);
  if (!n || n.startsWith(".") || !/\.[a-z0-9]{1,8}$/i.test(n)) return null;
  return n;
}

export const branchFor = (file: string) => `files/${file.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "file"}`;

export function listOpenFilePrs(): FilePr[] {
  return (db().prepare("SELECT * FROM file_prs WHERE status = 'open' ORDER BY id DESC").all() as Row[]).map(toFilePr);
}

export function getFilePr(id: number): FilePr | null {
  const r = db().prepare("SELECT * FROM file_prs WHERE id = ?").get(id) as Row | undefined;
  return r ? toFilePr(r) : null;
}

function setStatus(id: number, status: FilePr["status"]) {
  db().prepare("UPDATE file_prs SET status = ?, decided_at = ? WHERE id = ?").run(status, Date.now(), id);
}

export async function addFile(project: string, rawName: unknown, data: Buffer): Promise<FilePr> {
  const repo = projectPath(project);
  if (!repo) throw new Error(`Can't find the project "${project}" on this Mac.`);
  const file = cleanFileName(rawName);
  if (!file) throw new Error("That file needs a normal name, like CLAUDE.md.");
  if (!data.length) throw new Error("That file is empty.");
  if (data.length > MAX_FILE) throw new Error("That file is too big. Keep it under 5 MB.");

  await sh("git", ["fetch", "origin", "--prune"], repo);
  const head = await sh("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], repo);
  const base = head.ok && head.out ? head.out : "origin/main";
  const exists = (await sh("git", ["cat-file", "-e", `${base}:${file}`], repo)).ok;

  // A fresh branch name: files/claude-md, then files/claude-md-2, …
  let branch = branchFor(file);
  for (let i = 2; i < 50; i++) {
    const remote = await sh("git", ["ls-remote", "--heads", "origin", branch], repo, 30_000);
    const local = await sh("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], repo);
    if (!remote.out && !local.ok) break;
    branch = `${branchFor(file)}-${i}`;
  }
  const dir = path.join(WORKTREES, project, `${branch.replace(/\//g, "-")}-${Date.now()}`);
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const add = await sh("git", ["worktree", "add", "-b", branch, dir, base], repo);
  if (!add.ok) throw new Error("It couldn't make a copy of the project to add the file to.");
  let sent = false;
  try {
    fs.writeFileSync(path.join(dir, file), data);
    await sh("git", ["add", "--", file], dir);
    const verb = exists ? "Update" : "Add";
    const commit = await sh("git", ["commit", "-m", `${verb} ${file}\n\nAdded from the agentbox panel's Projects page.`], dir);
    if (!commit.ok) throw new Error(`${file} is already in ${project}, exactly the same.`);
    const up = await sh("git", ["push", "-u", "origin", `HEAD:refs/heads/${branch}`], dir);
    if (!up.ok) throw new Error("It couldn't send the file to GitHub. Check that GitHub is signed in on the Machine page.");
    sent = true;
    const pr = await sh(
      "gh",
      ["pr", "create", "--base", base.replace(/^origin\//, ""), "--head", branch, "--title", `${verb} ${file}`, "--body", `Nic ${exists ? "updated" : "added"} \`${file}\` from the agentbox panel. Merge this to put it in the project, so every agent can read it.`],
      dir,
    );
    const url = pr.out.split("\n").filter((l) => l.startsWith("http")).pop();
    if (!url) throw new Error("The file is on GitHub, but the pull request didn't open. Try again in a minute.");
    const r = db()
      .prepare("INSERT INTO file_prs (project, file, branch, pr_url, replaces, created_at) VALUES (?,?,?,?,?,?)")
      .run(project, file, branch, url, exists ? 1 : 0, Date.now());
    return getFilePr(Number(r.lastInsertRowid))!;
  } finally {
    await sh("git", ["worktree", "remove", "--force", dir], repo);
    await sh("git", ["branch", "-D", branch], repo);
    if (!sent) await sh("git", ["worktree", "prune"], repo);
  }
}

// The Inbox's "Merge it": one click and it's in the project.
export async function mergeFile(id: number): Promise<FilePr> {
  const f = getFilePr(id);
  if (!f) throw new Error("That isn't here any more.");
  const repo = projectPath(f.project) ?? os.homedir();
  const m = await sh("gh", ["pr", "merge", f.prUrl, "--squash", "--delete-branch"], repo, 60_000);
  if (!m.ok) {
    const state = await sh("gh", ["pr", "view", f.prUrl, "--json", "state", "--jq", ".state"], repo, 30_000);
    if (state.out === "MERGED") setStatus(id, "merged");
    else if (state.out === "CLOSED") {
      setStatus(id, "closed");
      throw new Error("That pull request was closed on GitHub, so the file wasn't added. Add it again on the Projects page.");
    } else throw new Error("GitHub wouldn't merge it. Open it on GitHub to see why.");
  } else setStatus(id, "merged");
  await sh("git", ["fetch", "origin", "--prune"], repo); // so the next run (and "has a brief ✓") sees it straight away
  return getFilePr(id)!;
}

// "Don't add it": closes the pull request and deletes its branch.
export async function closeFile(id: number): Promise<void> {
  const f = getFilePr(id);
  if (!f) return;
  await sh("gh", ["pr", "close", f.prUrl, "--delete-branch"], projectPath(f.project) ?? os.homedir(), 60_000);
  setStatus(id, "closed");
}
