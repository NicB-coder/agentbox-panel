import { execFileSync } from "node:child_process";

export const dynamic = "force-dynamic";

// Is the panel up, and which version is it? (The updater checks this after switching versions.)
let version: string | null = null;
function currentVersion(): string {
  if (version === null) {
    try {
      version = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: process.cwd(), timeout: 5000 }).toString().trim();
    } catch {
      version = "";
    }
  }
  return version;
}

export function GET() {
  return Response.json({ ok: true, version: currentVersion() });
}
