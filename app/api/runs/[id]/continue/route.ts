import { continueRun } from "@/lib/runner";

export const dynamic = "force-dynamic";

// Keep going (+30 min), Raise the budget, Pick up where it stopped: the same job, same copy, same conversation.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const b = (await req.json().catch(() => ({}))) as { addMinutes?: number; addBudget?: number };
  const addMinutes = b.addMinutes ? Math.min(240, Math.max(5, Math.round(Number(b.addMinutes)))) : undefined;
  const addBudget = b.addBudget ? Math.min(100, Math.max(5, Math.round(Number(b.addBudget)))) : undefined;
  try {
    continueRun(id, { addMinutes, addBudget });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
