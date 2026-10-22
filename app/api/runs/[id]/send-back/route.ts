import { getRun } from "@/lib/db";
import { freedomOf } from "@/lib/job";
import { followUp, parseTaskInput } from "@/lib/tasks";
import { getAgent } from "@/lib/db";

export const dynamic = "force-dynamic";

// "Send back to fix" / "Send back with a note": continues the same job with the review findings and/or Nic's note.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const run = getRun(Number((await params).id));
  const agent = run && getAgent(run.agentId);
  if (!run || !agent || agent.kind !== "claude") return Response.json({ error: "That job isn't here any more." }, { status: 404 });
  const { note } = (await req.json().catch(() => ({}))) as { note?: string };
  const findings = run.extra.review?.verdict === "needs work" ? run.extra.review.text : "";
  if (!note?.trim() && !findings) return Response.json({ error: "Write what it should change first." }, { status: 400 });
  const task = [
    note?.trim() ? `Nic looked at the pull request and says:\n${note.trim().slice(0, 4000)}` : "",
    findings ? `${note?.trim() ? "\n" : ""}A reviewer found these problems in the pull request:\n${findings}` : "",
    "\nFix this on the same branch, so the same pull request updates.",
  ].join("\n").trim();
  const parsed = parseTaskInput({ kind: agent.job.kind, task, project: agent.project, freedom: freedomOf(agent) === "look" ? "auto" : freedomOf(agent), careful: agent.job.careful, model: agent.model, maxMinutes: agent.maxMinutes });
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    const out = await followUp(agent.id, parsed.t);
    return Response.json({ agentId: agent.id, runId: out.runId }, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
