import { resizeTerminal, sendInput } from "@/lib/terminal";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { id?: string; data?: string; cols?: number; rows?: number };
  if (!b.id) return Response.json({ error: "No terminal." }, { status: 400 });
  if (b.cols && b.rows) resizeTerminal(b.id, b.cols, b.rows);
  if (typeof b.data === "string" && b.data && !sendInput(b.id, b.data.slice(0, 100_000))) return Response.json({ error: "That terminal has closed." }, { status: 410 });
  return Response.json({ ok: true });
}
