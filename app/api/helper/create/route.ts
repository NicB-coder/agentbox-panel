import { createAgent, createWorkflow, listWorkflows } from "@/lib/db";
import { cardOf, markCreated } from "@/lib/helper";
import { listProjects } from "@/lib/projects";
import { parseAgentInput } from "@/lib/validate";

export const dynamic = "force-dynamic";

// "Create it" on a Helper preview card: saves it switched Off, then the browser opens it in the normal editor.
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { msgId?: number; index?: number };
  const card = cardOf(Number(b.msgId), Number(b.index ?? 0));
  if (!card) return Response.json({ error: "That preview isn't here any more. Ask the Helper again." }, { status: 404 });
  if (card.problem) return Response.json({ error: card.problem }, { status: 400 });
  if (card.type === "agent") {
    const parsed = parseAgentInput({ ...card.draft, enabled: false }, listProjects());
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
    const a = createAgent({ ...parsed.agent, enabled: false });
    const href = `/agents/${a.id}/edit`;
    markCreated(Number(b.msgId), { index: Number(b.index ?? 0), kind: "agent", id: a.id, href });
    return Response.json({ href }, { status: 201 });
  }
  const taken = new Set(listWorkflows().map((x) => x.name));
  let name = card.draft.name;
  for (let i = 2; taken.has(name); i++) name = `${card.draft.name} ${i}`;
  const w = createWorkflow({ ...card.draft, name }, "Made by the Helper");
  const href = `/workflows/${w.id}`;
  markCreated(Number(b.msgId), { index: Number(b.index ?? 0), kind: "workflow", id: w.id, href });
  return Response.json({ href }, { status: 201 });
}
