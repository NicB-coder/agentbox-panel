import { createWorkflow } from "@/lib/db";
import { draftWorkflow } from "@/lib/draft";
import { listProjects } from "@/lib/projects";
import { pausedAll } from "@/lib/runner";
import { usageBlocked } from "@/lib/usage";
import { agentRefs } from "@/lib/workflowViews";

export const dynamic = "force-dynamic";
export const maxDuration = 200;

export async function POST(req: Request) {
  const { text, project, goal, preview } = (await req.json().catch(() => ({}))) as { text?: string; project?: string; goal?: string; preview?: boolean };
  const t = String(text ?? "").trim();
  if (t.length < 10) return Response.json({ error: "Write a sentence or two about the steps, for example: research first, then build." }, { status: 400 });
  if (t.length > 4000) return Response.json({ error: "That's long. Keep it under 4,000 characters." }, { status: 400 });
  if (pausedAll()) return Response.json({ error: "Everything is paused. Press Resume everything at the top first." }, { status: 409 });
  if (usageBlocked().reason === "out") return Response.json({ error: "You're out of Claude usage right now. Start from a template instead, or try again after it resets." }, { status: 409 });
  const projects = listProjects();
  try {
    const d = await draftWorkflow(t, agentRefs(), String(goal ?? ""));
    // The start screen only wants the steps to show; it makes the workflow itself once Nic presses Next.
    if (preview) return Response.json(d);
    const w = createWorkflow({ name: d.name, project: project && projects.includes(project) ? project : projects[0] ?? "", steps: d.steps, limits: d.limits }, "Drafted by Claude");
    return Response.json(w, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
