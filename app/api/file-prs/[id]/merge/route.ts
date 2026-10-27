import { mergeFile } from "@/lib/projectFiles";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return Response.json(await mergeFile(Number((await params).id)));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
