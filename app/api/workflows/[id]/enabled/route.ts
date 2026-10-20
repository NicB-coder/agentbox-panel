import { getWorkflow, setWorkflowEnabled } from "@/lib/db";
import { listProjects } from "@/lib/projects";
import { workflowProblems } from "@/lib/wf";
import { agentRefs } from "@/lib/workflowViews";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const w = getWorkflow(id);
  if (!w) return Response.json({ error: "There's no workflow with that number." }, { status: 404 });
  const { enabled } = (await req.json().catch(() => ({}))) as { enabled?: boolean };
  if (enabled) {
    const p = workflowProblems(w, agentRefs(), listProjects());
    if (p.length) return Response.json({ error: p[0] }, { status: 400 });
  }
  setWorkflowEnabled(id, !!enabled);
  return Response.json({ ok: true });
}
