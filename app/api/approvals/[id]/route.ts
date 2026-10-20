import { decideApproval, getApproval } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const a = getApproval(Number((await params).id));
  if (!a) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ status: a.status, message: a.message });
}

// Nic's Allow / Deny click.
export async function POST(req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const a = getApproval(id);
  if (!a) return Response.json({ error: "Not found." }, { status: 404 });
  if (a.status !== "pending") return Response.json({ error: "That was already answered." }, { status: 409 });
  const { allow, message } = (await req.json().catch(() => ({}))) as { allow?: boolean; message?: string };
  decideApproval(id, !!allow, message?.slice(0, 2000) ?? null);
  return Response.json({ ok: true });
}
