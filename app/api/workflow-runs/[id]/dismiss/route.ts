import { getWfRun, updateWfRun } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const wr = getWfRun(Number((await params).id));
  if (wr && wr.status === "stopped") updateWfRun(wr.id, { summary: "dismissed" });
  if (wr && wr.status === "done" && wr.quiet) updateWfRun(wr.id, { quiet: null });
  if (wr && wr.status === "done" && wr.prWaiting) updateWfRun(wr.id, { prWaiting: false });
  return Response.json({ ok: true });
}
