import { getWfRun, updateWfRun } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const wr = getWfRun(Number((await params).id));
  if (wr && wr.status === "stopped") updateWfRun(wr.id, { summary: "dismissed" });
  return Response.json({ ok: true });
}
