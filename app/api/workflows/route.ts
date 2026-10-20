import { createWorkflow, listAgents } from "@/lib/db";
import { listProjects } from "@/lib/projects";
import { cleanLimits, cleanSteps, templateWorkflow, TEMPLATES, type TemplateKey } from "@/lib/wf";
import { agentRefs } from "@/lib/workflowViews";

export const dynamic = "force-dynamic";

// New workflow: from a template, or from steps (e.g. the "Describe it" draft). Always starts Off.
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { template?: TemplateKey; name?: string; project?: string; steps?: unknown; limits?: unknown };
  const projects = listProjects();
  const project = b.project && projects.includes(b.project) ? b.project : projects[0] ?? "";
  if (b.template) {
    if (!TEMPLATES.some((t) => t.key === b.template)) return Response.json({ error: "That template isn't here." }, { status: 400 });
    const w = createWorkflow(templateWorkflow(b.template, agentRefs(), project), "Made from a template");
    return Response.json(w, { status: 201 });
  }
  const ids = listAgents().map((a) => a.id);
  const name = String(b.name ?? "").trim().slice(0, 60) || "New workflow";
  const w = createWorkflow({ name, project, steps: cleanSteps(b.steps, ids), limits: cleanLimits(b.limits) }, "First version");
  return Response.json(w, { status: 201 });
}
