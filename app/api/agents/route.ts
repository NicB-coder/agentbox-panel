import { createAgent, listAgents } from "@/lib/db";
import { listProjects } from "@/lib/projects";
import { parseAgentInput } from "@/lib/validate";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(listAgents());
}

export async function POST(req: Request) {
  const parsed = parseAgentInput(await req.json().catch(() => null), listProjects());
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  return Response.json(createAgent(parsed.agent), { status: 201 });
}
