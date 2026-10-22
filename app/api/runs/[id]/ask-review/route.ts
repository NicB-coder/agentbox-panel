import { getRun } from "@/lib/db";
import { reviewRunPr } from "@/lib/prReview";

export const dynamic = "force-dynamic";

// "Get a second opinion": a look-only reviewer reads the pull request and writes what it finds.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const run = getRun(Number((await params).id));
  if (!run?.prUrl) return Response.json({ error: "There's no pull request for this." }, { status: 404 });
  try {
    // A second opinion uses the other model from the one that reviewed it last.
    const last = run.extra.flow?.reviews.at(-1)?.model;
    const r = await reviewRunPr(run, { model: last === "opus" ? "sonnet" : "opus" });
    return Response.json({ runId: r.id }, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
