import { getSetting, setSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ usageGuardPct: getSetting<number | null>("usageGuardPct", null), tourDone: getSetting("tourDone", false) });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { usageGuardPct?: number | null; tourDone?: boolean };
  if ("usageGuardPct" in b) {
    const v = b.usageGuardPct;
    if (v !== null && !(Number.isInteger(v) && v! >= 50 && v! <= 99)) return Response.json({ error: "Pick a number between 50 and 99." }, { status: 400 });
    setSetting("usageGuardPct", v);
  }
  if ("tourDone" in b) setSetting("tourDone", !!b.tourDone);
  return Response.json({ ok: true });
}
