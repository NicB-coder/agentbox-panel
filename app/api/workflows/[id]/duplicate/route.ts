import { createWorkflow, getWorkflow } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const w = getWorkflow(Number((await params).id));
  if (!w) return Response.json({ error: "There's no workflow with that number." }, { status: 404 });
  const copy = createWorkflow({ name: `${w.name} (copy)`.slice(0, 60), project: w.project, steps: w.steps, limits: w.limits }, `Copied from ${w.name}`);
  return Response.json(copy, { status: 201 });
}
