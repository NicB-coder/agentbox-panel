import { dismissRun } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  dismissRun(Number((await params).id));
  return Response.json({ ok: true });
}
