import { closeFile } from "@/lib/projectFiles";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await closeFile(Number((await params).id));
  return Response.json({ ok: true });
}
