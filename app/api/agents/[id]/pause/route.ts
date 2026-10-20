import { getAgent, setPaused } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const a = getAgent(id);
  if (!a || a.kind !== "claude") return Response.json({ error: "There's no agent with that number." }, { status: 404 });
  const { paused } = (await req.json().catch(() => ({}))) as { paused?: boolean };
  setPaused(id, paused ?? !a.paused);
  return Response.json({ ok: true });
}
