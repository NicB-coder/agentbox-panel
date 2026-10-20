import { deleteIdea } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  deleteIdea(Number((await params).id));
  return Response.json({ ok: true });
}
