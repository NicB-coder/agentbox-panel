import { approvePlan, changePlan } from "@/lib/runner";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { approve, message } = (await req.json().catch(() => ({}))) as { approve?: boolean; message?: string };
  try {
    if (approve) approvePlan(id);
    else {
      if (!message?.trim()) return Response.json({ error: "Say what it should change." }, { status: 400 });
      changePlan(id, message.trim().slice(0, 4000));
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
