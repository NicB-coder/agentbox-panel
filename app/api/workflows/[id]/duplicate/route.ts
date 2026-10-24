import { createWorkflow, getWorkflow, listAgents } from "@/lib/db";
import { copyName } from "@/lib/changeView";
import { cleanLimits, cleanSteps } from "@/lib/wf";

export const dynamic = "force-dynamic";

// Makes a copy, switched off. The editor sends what's on screen, so changes that aren't saved yet come along too.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const w = getWorkflow(Number((await params).id));
  if (!w) return Response.json({ error: "There's no workflow with that number." }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { def?: { name?: string; project?: string; steps?: unknown; limits?: unknown } };
  const src = b.def && Array.isArray(b.def.steps)
    ? { name: String(b.def.name ?? w.name).trim() || w.name, project: String(b.def.project ?? w.project), steps: cleanSteps(b.def.steps, listAgents().map((a) => a.id)), limits: cleanLimits(b.def.limits) }
    : w;
  const copy = createWorkflow({ name: copyName(src.name), project: src.project, steps: src.steps, limits: src.limits }, `Copied from ${w.name}`);
  return Response.json(copy, { status: 201 });
}

