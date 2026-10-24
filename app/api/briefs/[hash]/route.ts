import { readStoredBrief } from "@/lib/briefs";

export const dynamic = "force-dynamic";

// View an attached brief.
export async function GET(_req: Request, { params }: { params: Promise<{ hash: string }> }) {
  const text = readStoredBrief((await params).hash);
  if (text === null) return Response.json({ error: "That brief isn't here any more. Attach it again." }, { status: 404 });
  return Response.json({ text });
}
