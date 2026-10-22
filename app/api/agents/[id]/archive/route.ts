import { activeRun, getAgent, setArchived } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const a = getAgent(id);
  if (!a || a.kind !== "claude") return Response.json({ error: "There's no job with that number." }, { status: 404 });
  const { archived } = (await req.json().catch(() => ({}))) as { archived?: boolean };
  if (archived !== false && activeRun(id)) return Response.json({ error: "It's still working. Stop it or wait until it's done first." }, { status: 409 });
  setArchived(id, archived !== false);
  return Response.json({ ok: true });
}
