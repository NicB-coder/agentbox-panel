import { missingFile } from "@/lib/briefs";
import { deleteIdea, getAgent } from "@/lib/db";
import { createTask, followUp, parseTaskInput } from "@/lib/tasks";

export const dynamic = "force-dynamic";

// The "Start a task" panel: a new job (a new agent named after it), or a follow-up on an existing one.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parseTaskInput(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const followUpOf = Number(body?.followUpOf);
  const isFollowUp = Number.isInteger(followUpOf) && followUpOf > 0;
  // Files the task says to follow must be in the project or attached: say so now instead of starting a run that can't work.
  const earlier = isFollowUp ? getAgent(followUpOf) : null;
  const project = earlier?.project ?? parsed.t.project;
  const missing = project ? await missingFile(project, [parsed.t.task], parsed.t.brief?.name ?? earlier?.job.brief) : null;
  if (missing) return Response.json({ error: missing.message, missing }, { status: 409 });
  try {
    const out = isFollowUp ? await followUp(followUpOf, parsed.t) : await createTask(parsed.t);
    const ideaId = Number(body?.ideaId);
    if (Number.isInteger(ideaId) && ideaId > 0) deleteIdea(ideaId);
    return Response.json({ agentId: out.agent.id, runId: out.runId, name: out.agent.name }, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
