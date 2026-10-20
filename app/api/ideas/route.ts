import { addIdea } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  const t = String(text ?? "").trim();
  if (!t) return Response.json({ error: "Write the idea first." }, { status: 400 });
  if (t.length > 2000) return Response.json({ error: "Keep ideas under 2,000 characters." }, { status: 400 });
  return Response.json({ id: addIdea(t) }, { status: 201 });
}
