import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const PROJECTS_DIR = path.join(os.homedir(), "projects");

// Repos cloned directly under ~/projects.
export function listProjects(): string[] {
  try {
    return fs
      .readdirSync(PROJECTS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(PROJECTS_DIR, d.name, ".git")))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export function projectPath(name: string): string | null {
  if (!name || name.includes("/") || name.startsWith(".")) return null;
  const p = path.join(PROJECTS_DIR, name);
  return fs.existsSync(path.join(p, ".git")) ? p : null;
}
