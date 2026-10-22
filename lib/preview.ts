import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { projectPath } from "./projects";
import { sh } from "./runner";

// Preview / Play: a project's site or game, served by the panel itself on 127.0.0.1, so it also works over Tailscale.
// Each preview is a read-only copy (git worktree) of a branch: "live" is what's on main right now, or a pull request's branch.
// Sites that need a build step aren't served yet; only plain HTML/CSS/JS (or an already-built folder).

const PREVIEWS = path.join(os.homedir(), "agents", "previews");
const ROOTS = ["", "public", "dist", "build", "out", "docs", "site", "www"];
type G = typeof globalThis & { __previewFresh?: Map<string, number>; __previewBusy?: Map<string, Promise<string | null>> };
const g = globalThis as G;
const fresh = (g.__previewFresh ??= new Map());
const busy = (g.__previewBusy ??= new Map());

export const refToken = (branch: string | null) => (branch ? branch.replace(/\//g, "~") : "live");
export const tokenRef = (token: string) => (token === "live" ? null : token.replace(/~/g, "/"));

// The copy for project@ref, refreshed at most once a minute. Returns the folder that has index.html, or null.
export async function previewDir(project: string, token: string): Promise<string | null> {
  const key = `${project}/${token}`;
  if (busy.has(key)) return busy.get(key)!;
  const p = (async () => {
    const repo = projectPath(project);
    if (!repo || !/^[\w.~-]+$/.test(token)) return null;
    const dir = path.join(PREVIEWS, project, token);
    const sha = token.startsWith("sha-") ? token.slice(4) : null; // one exact commit: never changes
    if ((!sha && Date.now() - (fresh.get(key) ?? 0) > 60_000) || !fs.existsSync(dir)) {
      await sh("git", ["fetch", "origin", "--prune"], repo, 60_000);
      let ref = sha ?? (tokenRef(token) ? `origin/${tokenRef(token)}` : "");
      if (!ref) {
        const head = await sh("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], repo);
        ref = head.ok && head.out ? head.out : "origin/main";
      }
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(path.dirname(dir), { recursive: true });
        await sh("git", ["worktree", "prune"], repo);
        const r = await sh("git", ["worktree", "add", "--detach", dir, ref], repo);
        if (!r.ok) return null;
      } else {
        const r = await sh("git", ["checkout", "--detach", "--force", ref], dir);
        if (!r.ok) return null;
      }
      fresh.set(key, Date.now());
    }
    for (const r of ROOTS) if (fs.existsSync(path.join(dir, r, "index.html"))) return path.join(dir, r);
    return null;
  })().finally(() => busy.delete(key));
  busy.set(key, p);
  return p;
}

// Can this project be played/previewed? (Has an index.html on its default branch.)
export async function canPreview(project: string): Promise<boolean> {
  const repo = projectPath(project);
  if (!repo) return false;
  for (const r of ROOTS) {
    const ok = await sh("git", ["cat-file", "-e", `origin/HEAD:${r ? `${r}/` : ""}index.html`], repo, 10_000);
    if (ok.ok) return true;
  }
  return false;
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
  ".ttf": "font/ttf", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".mp4": "video/mp4", ".webm": "video/webm", ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8", ".wasm": "application/wasm",
};

export function previewFile(root: string, rel: string): { body: Buffer; type: string } | null {
  const clean = path.normalize(decodeURIComponent(rel || "")).replace(/^(\.\.(\/|\\|$))+/, "");
  let file = path.join(root, clean);
  if (!file.startsWith(root) || file.split(path.sep).includes(".git")) return null;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file) && !path.extname(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  return { body: fs.readFileSync(file), type: TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream" };
}
