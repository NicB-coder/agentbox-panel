import { installFromPr } from "@/lib/update";

export const dynamic = "force-dynamic";

// "Install it": merge a job's pull request to agentbox itself, then update (with automatic rollback).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await installFromPr(Number((await params).id));
    return Response.json({ ok: true }, { status: 202 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
