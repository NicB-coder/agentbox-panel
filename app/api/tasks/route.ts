import { deleteIdea } from "@/lib/db";
import { createTask, followUp, parseTaskInput } from "@/lib/tasks";

export const dynamic = "force-dynamic";

// The "Start a task" panel: a new job (a new agent named after it), or a follow-up on an existing one.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parseTaskInput(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    const followUpOf = Number(body?.followUpOf);
    const out = Number.isInteger(followUpOf) && followUpOf > 0 ? await followUp(followUpOf, parsed.t) : await createTask(parsed.t);
    const ideaId = Number(body?.ideaId);
    if (Number.isInteger(ideaId) && ideaId > 0) deleteIdea(ideaId);
    return Response.json({ agentId: out.agent.id, runId: out.runId, name: out.agent.name }, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
