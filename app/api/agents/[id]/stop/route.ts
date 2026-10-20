import { activeRun } from "@/lib/db";
import { stopRun } from "@/lib/runner";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const run = activeRun(Number((await params).id));
  if (!run) return Response.json({ error: "It isn't working on anything right now." }, { status: 409 });
  stopRun(run.id);
  return Response.json({ ok: true });
}
