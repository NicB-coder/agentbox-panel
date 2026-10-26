import { getRun } from "@/lib/db";
import { readLog } from "@/lib/runner";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const text = readLog(id);
  const r = getRun(id);
  const ended = !!r && !["working", "queued", "waiting"].includes(r.status);
  return new Response(text || (ended ? "No log was kept for this run. Old logs are cleared after a while, and the result above is all that's left." : "There's nothing in this log yet."), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
