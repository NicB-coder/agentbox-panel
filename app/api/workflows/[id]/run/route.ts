import { deleteIdea, getWorkflow } from "@/lib/db";
import { listProjects } from "@/lib/projects";
import { GOAL_MAX, workflowProblems } from "@/lib/wf";
import { startWorkflow } from "@/lib/workflowRunner";
import { agentRefs } from "@/lib/workflowViews";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const w = getWorkflow(id);
  if (!w) return Response.json({ error: "There's no workflow with that number." }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { input?: string; goal?: string; test?: boolean; ideaId?: number };
  const p = workflowProblems(w, agentRefs(), listProjects());
  if (p.length) return Response.json({ error: p[0] }, { status: 400 });
  if (!b.test && !w.enabled) return Response.json({ error: "Turn the workflow on first, or use Test run." }, { status: 400 });
  if (b.input && b.input.length > 8000) return Response.json({ error: "That's too long. Keep it under 8,000 characters." }, { status: 400 });
  if (b.goal && b.goal.length > GOAL_MAX) return Response.json({ error: `That goal is too long. Keep it under ${GOAL_MAX.toLocaleString("en-US")} characters.` }, { status: 400 });
  // Run now with no goal anywhere: say so instead of starting a run that has nothing to work on.
  const manual = (w.steps[0]?.trigger ?? "manual") === "manual";
  if (manual && !(w.steps[0]?.task ?? "").trim() && !String(b.goal ?? "").trim() && !String(b.input ?? "").trim())
    return Response.json({ error: "Write what you want to make in the goal box first." }, { status: 400 });
  try {
    const run = await startWorkflow(id, { input: b.input, goal: typeof b.goal === "string" ? b.goal : undefined, test: !!b.test, trigger: b.test ? "test" : b.ideaId ? "idea" : "manual" });
    if (b.ideaId) deleteIdea(b.ideaId);
    return Response.json(run, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
