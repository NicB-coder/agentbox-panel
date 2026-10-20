import { pauseEverything, resumeEverything } from "@/lib/control";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { paused } = (await req.json().catch(() => ({}))) as { paused?: boolean };
  if (paused) pauseEverything();
  else resumeEverything();
  return Response.json({ ok: true, paused: !!paused });
}
