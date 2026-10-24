import { changeWorkflow } from "@/lib/change";
import { getWorkflow } from "@/lib/db";
import { pausedAll } from "@/lib/runner";
import { usageBlocked } from "@/lib/usage";
import { cleanLimits, cleanSteps } from "@/lib/wf";
import { agentRefs } from "@/lib/workflowViews";

export const dynamic = "force-dynamic";
export const maxDuration = 200;

// Drafts a change in Nic's own words. It only answers with the new steps; nothing is saved until he presses Apply.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const w = getWorkflow(Number((await params).id));
  if (!w) return Response.json({ error: "There's no workflow with that number." }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { text?: string; def?: { name?: string; project?: string; steps?: unknown; limits?: unknown } };
  const text = String(b.text ?? "").trim();
  if (text.length < 4) return Response.json({ error: "Say what to change, for example: Add a step that tests it on a phone." }, { status: 400 });
  if (text.length > 2000) return Response.json({ error: "That's long. Keep it under 2,000 characters." }, { status: 400 });
  if (pausedAll()) return Response.json({ error: "Everything is paused. Press Resume everything at the top first." }, { status: 409 });
  if (usageBlocked().reason === "out") return Response.json({ error: "You're out of Claude usage right now. Change the steps by clicking them instead, or try again after it resets." }, { status: 409 });
  const agents = agentRefs();
  // The editor sends what's on screen (it may have changes that aren't saved yet); else the saved workflow.
  const def = b.def && Array.isArray(b.def.steps)
    ? { name: String(b.def.name ?? w.name), project: String(b.def.project ?? w.project), steps: cleanSteps(b.def.steps, agents.map((a) => a.id)), limits: cleanLimits(b.def.limits) }
    : { name: w.name, project: w.project, steps: w.steps, limits: w.limits };
  try {
    // "before" is the steps as Claude saw them (cleaned the same way), so the preview compares like with like.
    return Response.json({ ...(await changeWorkflow(def, text, agents)), before: def.steps });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
