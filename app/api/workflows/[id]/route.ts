import { deleteWorkflow, getWorkflow, listAgents, setWorkflowEnabled, updateWorkflow } from "@/lib/db";
import { cleanLimits, cleanSteps } from "@/lib/wf";
import { activeWfRun } from "@/lib/workflowRunner";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  if (!getWorkflow(id)) return Response.json({ error: "There's no workflow with that number." }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { name?: string; project?: string; steps?: unknown; limits?: unknown; note?: string };
  const name = String(b.name ?? "").trim().slice(0, 60);
  if (!name) return Response.json({ error: "Give the workflow a name." }, { status: 400 });
  const w = updateWorkflow(id, { name, project: String(b.project ?? ""), steps: cleanSteps(b.steps, listAgents().map((a) => a.id)), limits: cleanLimits(b.limits) }, String(b.note ?? "Saved").slice(0, 80));
  return Response.json(w);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  if (activeWfRun(id)) return Response.json({ error: "It's running right now. Stop it first." }, { status: 409 });
  setWorkflowEnabled(id, false);
  deleteWorkflow(id);
  return Response.json({ ok: true });
}
