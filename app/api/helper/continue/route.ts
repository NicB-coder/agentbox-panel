import { continueReply } from "@/lib/helper";

export const dynamic = "force-dynamic";

// Continue on a reply that stopped partway (only when Nic presses Continue).
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { msgId?: unknown };
  const id = Number(b.msgId);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "There's nothing to continue here." }, { status: 400 });
  try {
    return Response.json({ reply: continueReply(id) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
