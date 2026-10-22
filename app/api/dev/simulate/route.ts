import { getRun } from "@/lib/db";
import { log, patchExtra, simulateUsageLimit } from "@/lib/runner";

export const dynamic = "force-dynamic";

// Test helpers for the dev copy only (AGENTBOX_DEV=1): pretend a run hit the usage limit, or used up its time.
export async function POST(req: Request) {
  if (process.env.AGENTBOX_DEV !== "1") return Response.json({ error: "Not here." }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { runId?: number; what?: "usage" | "time"; seconds?: number };
  const run = b.runId ? getRun(b.runId) : null;
  if (!run) return Response.json({ error: "No such run." }, { status: 404 });
  if (b.what === "time") {
    log(run.id, "(test) Pretending it used up its time.");
    patchExtra(run.id, { activeMs: 10 * 3600_000 });
    return Response.json({ ok: true });
  }
  simulateUsageLimit(run.id, b.seconds ?? 60);
  return Response.json({ ok: true });
}
