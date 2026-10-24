import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./db";
import { projectPath } from "./projects";
import type { BriefRef } from "./types";

// Briefs: a long Markdown file that says what to build (Nic's Lookout CLAUDE.md, for example).
// Attached ones are kept here by their content, so undo, version history and old runs always find the same text.
// At the start of a run the brief is copied into the run's own copy of the project, at the top, as CLAUDE.md
// (if the project has none) or BRIEF.md, and the agent is told to follow it. It's never committed.

const STORE = path.join(DATA_DIR, "briefs", "store");
export const MAX_BRIEF = 400_000;
const PLACED = path.join(".agentbox", "placed-brief"); // which file a run's brief was copied to, so commits leave it out

export const isBriefFile = (name: string) => /\.(md|markdown|txt)$/i.test(name);
export const lineCount = (text: string) => (text.replace(/\n+$/, "") ? text.replace(/\n+$/, "").split("\n").length : 0);

export function cleanBriefName(name: unknown): string {
  const base = path.basename(String(name ?? "")).replace(/[^\w.\- ]+/g, "").trim().slice(0, 80);
  return base && !base.startsWith(".") ? base : "brief.md";
}

// Keeps a brief and returns how to refer to it. Errors are plain sentences for the panel.
export function storeBrief(name: unknown, text: unknown): BriefRef {
  const n = cleanBriefName(name);
  const t = String(text ?? "");
  if (!isBriefFile(n)) throw new Error("Pick a Markdown (.md) or text (.txt) file.");
  if (!t.trim()) throw new Error("That file is empty.");
  if (t.length > MAX_BRIEF) throw new Error("That brief file is too big. Keep it under about 400 KB.");
  const hash = createHash("sha256").update(t).digest("hex").slice(0, 24);
  fs.mkdirSync(STORE, { recursive: true });
  const file = path.join(STORE, `${hash}.md`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, t, { mode: 0o600 });
  return { name: n, lines: lineCount(t), hash };
}

export function readStoredBrief(hash: string): string | null {
  if (!/^[a-f0-9]{24}$/.test(hash)) return null;
  try {
    return fs.readFileSync(path.join(STORE, `${hash}.md`), "utf8");
  } catch {
    return null;
  }
}

// ---------- in the run's copy ----------

// Puts the brief at the top of the run's folder and returns the file name it got.
export function placeBrief(dir: string, text: string): string {
  fs.mkdirSync(path.join(dir, ".agentbox"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".agentbox", ".gitignore"), "*\n");
  const before = placedBrief(dir); // a follow-up in the same copy: same file again
  const name = before ?? (["CLAUDE.md", "BRIEF.md", "AGENTBOX-BRIEF.md"].find((n) => !fs.existsSync(path.join(dir, n))) ?? "AGENTBOX-BRIEF.md");
  fs.writeFileSync(path.join(dir, name), text);
  fs.writeFileSync(path.join(dir, PLACED), name);
  return name;
}

export function placedBrief(dir: string): string | null {
  try {
    const n = fs.readFileSync(path.join(dir, PLACED), "utf8").trim();
    return /^[A-Z-]+\.md$/.test(n) ? n : null;
  } catch {
    return null;
  }
}

// `git add` for the panel's own commits: everything except the brief it copied in.
export function addAllArgs(dir: string): string[] {
  const placed = placedBrief(dir);
  return placed ? ["add", "-A", "--", ".", `:(exclude)${placed}`] : ["add", "-A"];
}

// What the agent is told about it.
export function briefPromptLine(name: string, placedAs: string): string {
  const same = name.toLowerCase() === placedAs.toLowerCase() ? "" : ` (Nic's file "${name}")`;
  return `Nic attached a brief${same}. Follow ${placedAs} in the repo root: read all of it first, it says what to make. Don't commit ${placedAs} and don't change it; the panel keeps it out of the pull request.`;
}

// ---------- the project's own brief ----------

function git(args: string[], cwd: string, timeout = 20_000): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) =>
    execFile("git", args, { cwd, timeout, maxBuffer: 20 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }, (e, out) => resolve({ ok: !e, out: String(out) })),
  );
}

// "This project has a brief ✓": a CLAUDE.md at the top of the project, here or on GitHub.
export async function projectBrief(project: string): Promise<{ name: string; lines: number; text: string } | null> {
  const root = projectPath(project);
  if (!root) return null;
  for (const name of ["CLAUDE.md"]) {
    const local = path.join(root, name);
    if (fs.existsSync(local)) {
      const text = fs.readFileSync(local, "utf8").slice(0, MAX_BRIEF);
      return { name, lines: lineCount(text), text };
    }
    const remote = await git(["show", `origin/HEAD:${name}`], root, 10_000);
    if (remote.ok && remote.out.trim()) return { name, lines: lineCount(remote.out), text: remote.out.slice(0, MAX_BRIEF) };
  }
  return null;
}

// ---------- "I can't find CLAUDE.md in lookout" ----------

const DOC = "md|markdown|txt|pdf|docx?|rtf";
const FILE_RE = new RegExp(`(?:^|[\\s"'\`(\\[*_])((?:[\\w.-]+/)*[\\w-][\\w.-]*\\.(?:${DOC}))(?=$|[\\s"'\`)\\],.;:!?*_])`, "gi");
const NEEDS = /\b(follow(s|ing|ed)?|read|reading|see|per|according to|based on|described in|written in|as in|from|use|using|check|open|stick to|in line with|instructions|spec|brief|plan)\b/i;
const MAKES = /\b(make|makes|making|create|creates|creating|write|writes|writing|add|adds|adding|generate|draft|produce|save|update|edit|rename|delete|remove|new)\b/i;
const BRIEF_NAMES = new Set(["claude.md", "agents.md", "brief.md"]);

// Files the goal says to follow or read (not ones it asks to make): "follow CLAUDE.md", "read docs/plan.md".
export function mentionedFiles(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(FILE_RE)) {
    const file = m[1].replace(/^\.\//, "");
    const before = text.slice(Math.max(0, (m.index ?? 0) - 60), (m.index ?? 0) + m[0].indexOf(m[1]));
    const clause = before.split(/\n|[.!?]\s/).pop() ?? "";
    const words = clause.split(/\s+/).slice(-6).join(" ");
    if (MAKES.test(words)) continue;
    if (NEEDS.test(words) || BRIEF_NAMES.has(path.basename(file).toLowerCase())) out.push(file);
  }
  return [...new Set(out)];
}

function walkHas(root: string, file: string): boolean {
  if (fs.existsSync(path.join(root, file))) return true;
  const want = path.basename(file).toLowerCase();
  let found = false;
  const skip = new Set(["node_modules", ".git", ".next", "dist", "build", "out", ".agentbox", "vendor", ".venv"]);
  const walk = (dir: string, depth: number) => {
    if (found || depth > 4) return;
    let list: fs.Dirent[] = [];
    try {
      list = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of list) {
      if (found) return;
      if (e.isDirectory()) {
        if (!skip.has(e.name)) walk(path.join(dir, e.name), depth + 1);
      } else if (e.name.toLowerCase() === want) found = true;
    }
  };
  walk(root, 0);
  return found;
}

export type Missing = { file: string; project: string; message: string };

// Before a run starts: every file the goal mentions must be in the project (here or on GitHub) or be the attached brief.
export async function missingFile(project: string, texts: string[], briefName?: string | null): Promise<Missing | null> {
  const root = projectPath(project);
  if (!root) return null; // "can't find the project" is said elsewhere
  const files = mentionedFiles(texts.filter(Boolean).join("\n"));
  if (!files.length) return null;
  const brief = briefName?.toLowerCase() ?? null;
  const left = files.filter((f) => {
    const base = path.basename(f).toLowerCase();
    if (brief && (base === brief || base === "claude.md" || base === "brief.md")) return false; // the brief is copied in as one of those
    return !walkHas(root, f);
  });
  if (!left.length) return null;
  // Maybe it was added on GitHub (for example with Add a file) and isn't on this Mac yet.
  await git(["fetch", "origin", "--quiet"], root, 30_000);
  const tree = await git(["ls-tree", "-r", "--name-only", "origin/HEAD"], root);
  const names = tree.ok ? tree.out.split("\n").filter(Boolean) : [];
  const lower = new Set(names.map((n) => n.toLowerCase()));
  const bases = new Set(names.map((n) => path.basename(n).toLowerCase()));
  const gone = left.find((f) => !lower.has(f.toLowerCase()) && !bases.has(path.basename(f).toLowerCase()));
  if (!gone) return null;
  return { file: gone, project, message: `I can't find ${gone} in ${project}. Attach it here or add it to the project, then start it again.` };
}
