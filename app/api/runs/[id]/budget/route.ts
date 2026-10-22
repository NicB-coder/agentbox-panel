import { getRun } from "@/lib/db";
import { log, patchExtra } from "@/lib/runner";

export const dynamic = "force-dynamic";

// A big job's usage budget can be raised any time while it works.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const run = getRun(Number((await params).id));
  const big = run?.extra.flow?.big;
  if (!run || !big) return Response.json({ error: "That isn't a big job." }, { status: 404 });
  const { add } = (await req.json().catch(() => ({}))) as { add?: number };
  const n = Math.min(100, Math.max(5, Math.round(Number(add ?? 20))));
  patchExtra(run.id, { flow: { ...run.extra.flow!, big: { ...big, budgetPct: big.budgetPct + n } } });
  log(run.id, `Nic raised the usage budget to ${big.budgetPct + n}%.`);
  return Response.json({ ok: true, budgetPct: big.budgetPct + n });
}
