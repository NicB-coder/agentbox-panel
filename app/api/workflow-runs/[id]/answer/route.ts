import { answer } from "@/lib/workflowRunner";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { action, note } = (await req.json().catch(() => ({}))) as { action?: "approve" | "send_back" | "stop"; note?: string };
  if (!action || !["approve", "send_back", "stop"].includes(action)) return Response.json({ error: "Pick Approve, Send back or Stop." }, { status: 400 });
  try {
    await answer(id, action, note?.slice(0, 4000));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
