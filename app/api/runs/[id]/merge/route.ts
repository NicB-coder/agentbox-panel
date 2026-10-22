import { execFile } from "node:child_process";
import os from "node:os";
import { db, getAgent, getRun } from "@/lib/db";
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
    return Response.json({ error: conflict ? "GitHub can't merge it because it clashes with newer changes. Use Send back with a note and ask it to bring the branch up to date." : "GitHub wouldn't merge it. Open it on GitHub to see why." }, { status: 409 });
  }
  // Follow-ups share one pull request: they're all done now.
  db().prepare("UPDATE runs SET status = 'done' WHERE pr_url = ? AND status = 'review'").run(run.prUrl);
  import("@/lib/notices").then((m) => m.onMerged(run.id)).catch(() => {});
  return Response.json({ ok: true });
}
