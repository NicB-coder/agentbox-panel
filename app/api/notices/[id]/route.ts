import { openNotice } from "@/lib/notices";

export const dynamic = "force-dynamic";

// Opened (or "Got it"): it stays under its filter for a week but no longer counts as new.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  openNotice(Number((await params).id));
  return Response.json({ ok: true });
}
