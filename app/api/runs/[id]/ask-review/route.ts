import { activeRun, getRun, listAgents } from "@/lib/db";
import { startRun } from "@/lib/runner";

export const dynamic = "force-dynamic";

// "Ask Reviewer to check it": a Reviewer task for one pull request.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const run = getRun(Number((await params).id));
  if (!run?.prUrl) return Response.json({ error: "There's no pull request for this." }, { status: 404 });
  const reviewer = listAgents().find((a) => a.slug === "reviewer" && a.enabled) ?? listAgents().find((a) => a.kind === "claude" && a.enabled && a.allowed === "look");
  if (!reviewer) return Response.json({ error: "There's no reviewer agent. Add one that's set to Look only." }, { status: 409 });
  if (activeRun(reviewer.id)) return Response.json({ error: `${reviewer.name} is busy right now. Try again when it's done.` }, { status: 409 });
  try {
    await startRun(reviewer.id, { task: `Review this pull request and leave your comments on it: ${run.prUrl}`, trigger: "manual", project: run.extra.project });
    return Response.json({ agentId: reviewer.id }, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
