import { activeRun, deleteAgent, getAgent, updateAgent } from "@/lib/db";
import { listProjects } from "@/lib/projects";
import { parseAgentInput } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const a = getAgent(Number((await params).id));
  return a ? Response.json(a) : Response.json({ error: "There's no agent with that number." }, { status: 404 });
}

export async function PUT(req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const a = getAgent(id);
  if (!a) return Response.json({ error: "There's no agent with that number." }, { status: 404 });
  if (a.kind !== "claude") return Response.json({ error: "This one can only be watched, not changed." }, { status: 400 });
  const parsed = parseAgentInput(await req.json().catch(() => null), listProjects());
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  return Response.json(updateAgent(id, parsed.agent));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const a = getAgent(id);
  if (!a) return Response.json({ error: "There's no agent with that number." }, { status: 404 });
  if (a.kind !== "claude") return Response.json({ error: "This one can't be deleted here." }, { status: 400 });
  if (activeRun(id)) return Response.json({ error: "It's working right now. Stop it first." }, { status: 409 });
  deleteAgent(id);
  return Response.json({ ok: true });
}
