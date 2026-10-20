import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PROJECTS_DIR, listProjects } from "./projects";

// The Projects page: what's cloned under ~/projects, and adding more with gh.

const PATH = [path.join(os.homedir(), ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].join(":");

function sh(cmd: string, args: string[], cwd: string, timeout = 60_000): Promise<{ ok: boolean; out: string; err: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, timeout, env: { ...process.env, PATH, GIT_TERMINAL_PROMPT: "0" }, maxBuffer: 10 * 1024 * 1024 }, (e, o, er) =>
      resolve({ ok: !e, out: String(o).trim(), err: String(er).trim() }),
    );
  });
}

export type ProjectInfo = {
  name: string;
  repo: string | null;
  url: string | null;
  lastActivity: number | null;
  lastMessage: string | null;
  prs: { number: number; title: string; url: string; draft: boolean }[];
};

type G = typeof globalThis & { __projCache?: { at: number; list: ProjectInfo[] } };
const g = globalThis as G;

export async function projectInfos(fresh = false): Promise<ProjectInfo[]> {
  if (!fresh && g.__projCache && Date.now() - g.__projCache.at < 60_000) return g.__projCache.list;
  const list = await Promise.all(
    listProjects().map(async (name): Promise<ProjectInfo> => {
      const dir = path.join(PROJECTS_DIR, name);
      const [repo, log, prs] = await Promise.all([
        sh("gh", ["repo", "view", "--json", "nameWithOwner,url"], dir, 20_000),
        sh("git", ["log", "-1", "--format=%ct%n%s"], dir, 10_000),
        sh("gh", ["pr", "list", "--state", "open", "--json", "number,title,url,isDraft", "--limit", "10"], dir, 20_000),
      ]);
      const r = repo.ok ? (JSON.parse(repo.out) as { nameWithOwner: string; url: string }) : null;
      const [ts, msg] = log.out.split("\n");
      return {
        name, repo: r?.nameWithOwner ?? null, url: r?.url ?? null,
        lastActivity: ts ? Number(ts) * 1000 : null, lastMessage: msg ?? null,
        prs: prs.ok ? (JSON.parse(prs.out || "[]") as { number: number; title: string; url: string; isDraft: boolean }[]).map((p) => ({ number: p.number, title: p.title, url: p.url, draft: p.isDraft })) : [],
      };
    }),
  );
  g.__projCache = { at: Date.now(), list };
  return list;
}

// Repos the bot owns or can work on, that aren't cloned yet.
export async function availableRepos(): Promise<{ name: string; description: string }[]> {
  const r = await sh("gh", ["api", "user/repos?affiliation=owner,collaborator&sort=updated&per_page=100", "--jq", ".[] | [.full_name, (.description // \"\")] | @tsv"], os.homedir(), 30_000);
  if (!r.ok) return [];
  const have = new Set(listProjects());
  return r.out
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [name, description] = l.split("\t");
      return { name, description };
    })
    .filter((x) => !have.has(x.name.split("/")[1]));
}

export async function cloneRepo(full: string): Promise<string> {
  const m = full.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!m) throw new Error("Type it like owner/name, for example NicB-coder/portfolio.");
  const name = m[2];
  if (name.startsWith(".")) throw new Error("That name won't work as a folder.");
  const dest = path.join(PROJECTS_DIR, name);
  if (fs.existsSync(dest)) throw new Error(`There's already a project called ${name} on this Mac.`);
  const r = await sh("gh", ["repo", "clone", `${m[1]}/${name}`, dest], PROJECTS_DIR, 5 * 60_000);
  if (!r.ok) throw new Error(/not found|Could not resolve/i.test(r.err) ? "GitHub couldn't find that repo, or the bot can't see it. Check the name, or invite NicB-coder-bot to it." : "Couldn't copy it from GitHub. Try again in a moment.");
  g.__projCache = undefined;
  return name;
}

export async function createRepo(rawName: string, description: string): Promise<string> {
  const name = rawName.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[-.]+|-+$/g, "").slice(0, 60);
  if (!name) throw new Error("Give the new repo a name, like my-first-site.");
  if (fs.existsSync(path.join(PROJECTS_DIR, name))) throw new Error(`There's already a project called ${name} on this Mac.`);
  const args = ["repo", "create", name, "--public", "--add-readme", "--clone"];
  if (description.trim()) args.push("--description", description.trim().slice(0, 200));
  const r = await sh("gh", args, PROJECTS_DIR, 2 * 60_000);
  if (!r.ok) throw new Error(/already exists/i.test(r.err) ? "The bot already has a repo with that name. Pick another name, or add it from the list." : "GitHub wouldn't make the repo. Try again in a moment.");
  g.__projCache = undefined;
  return name;
}
