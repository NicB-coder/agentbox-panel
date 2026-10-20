import { createFromCard } from "@/lib/helper";

export const dynamic = "force-dynamic";

const isIndex = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= 0;

// "Create it" on a Helper preview card: saves it switched Off, then the browser opens it in the normal editor.
// Pressing it again gives back the one already made.
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { msgId?: unknown; index?: unknown };
  if (!isIndex(b.msgId) || !isIndex(b.index)) return Response.json({ error: "That preview isn't here any more. Ask the Helper again." }, { status: 400 });
  const out = createFromCard(b.msgId as number, b.index as number);
  if (!out.ok) return Response.json({ error: out.error }, { status: out.status });
  return Response.json({ href: out.href, existing: out.existing }, { status: out.existing ? 200 : 201 });
}
