import { execFile } from "node:child_process";
import os from "node:os";
import { getAgent, getRun, updateRun } from "@/lib/db";
import { projectPath } from "@/lib/projects";

export const dynamic = "force-dynamic";

// Nic pressed "Merge it" in the Inbox. Merges the agent's pull request into main on GitHub.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const run = getRun(Number((await params).id));
  if (!run?.prUrl) return Response.json({ error: "There's no pull request for this." }, { status: 404 });
  const agent = getAgent(run.agentId);
  const dir = projectPath(run.extra.project ?? agent?.project ?? "") ?? os.homedir();
  const out = await new Promise<{ ok: boolean; err: string }>((resolve) =>
    execFile("gh", ["pr", "merge", run.prUrl!, "--squash"], { cwd: dir, timeout: 60_000, env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin` } }, (e, _o, stderr) =>
      resolve({ ok: !e, err: String(stderr) }),
    ),
  );
  if (!out.ok) {
    const conflict = /conflict|not mergeable/i.test(out.err);
    return Response.json({ error: conflict ? "GitHub can't merge it because it clashes with newer changes. Ask Builder to update it." : "GitHub wouldn't merge it. Open it on GitHub to see why." }, { status: 409 });
  }
  updateRun(run.id, { status: "done" });
  return Response.json({ ok: true });
}
