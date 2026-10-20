import { agentPageState } from "@/lib/views";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const state = agentPageState(Number((await params).id));
  if (!state) return Response.json({ error: "There's no agent with that number." }, { status: 404 });
  return Response.json(state);
}
