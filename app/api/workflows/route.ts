import { createWorkflow, listAgents, listWorkflows } from "@/lib/db";
import { listProjects } from "@/lib/projects";
import { cleanLimits, cleanSteps, goalTooLong, templateWorkflow, TEMPLATES, type TemplateKey } from "@/lib/wf";
import { agentRefs } from "@/lib/workflowViews";

export const dynamic = "force-dynamic";

// New workflow: from a template, or from steps (e.g. the start screen: the goal plus its steps). Always starts Off.
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { template?: TemplateKey; name?: string; project?: string; steps?: unknown; limits?: unknown };
  const projects = listProjects();
  const project = b.project && projects.includes(b.project) ? b.project : projects[0] ?? "";
  if (b.template) {
    if (!TEMPLATES.some((t) => t.key === b.template)) return Response.json({ error: "That template isn't here." }, { status: 400 });
    const t = templateWorkflow(b.template, agentRefs(), project);
    const taken = new Set(listWorkflows().map((x) => x.name));
    let name = t.name;
    for (let i = 2; taken.has(name); i++) name = `${t.name} ${i}`;
    const w = createWorkflow({ ...t, name }, "Made from a template");
    return Response.json(w, { status: 201 });
  }
  const long = goalTooLong(b.steps);
  if (long) return Response.json({ error: long }, { status: 400 });
  const ids = listAgents().map((a) => a.id);
  const name = String(b.name ?? "").trim().slice(0, 60) || "New workflow";
  const w = createWorkflow({ name, project, steps: cleanSteps(b.steps, ids), limits: cleanLimits(b.limits) }, "First version");
  return Response.json(w, { status: 201 });
}
