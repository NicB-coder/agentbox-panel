import { getWfRun, updateWfRun } from "@/lib/db";
import { startWorkflow } from "@/lib/workflowRunner";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const wr = getWfRun(Number((await params).id));
  if (!wr) return Response.json({ error: "That run isn't here any more." }, { status: 404 });
  try {
    // Older runs stored the goal itself as the run's input: that isn't extra, the goal is always sent anyway.
    const input = wr.input.trim() === (wr.steps[0]?.task ?? "").trim() ? "" : wr.input;
    const fresh = await startWorkflow(wr.workflowId, { input, test: wr.test, trigger: wr.test ? "test" : "manual" });
    if (wr.quiet) updateWfRun(wr.id, { quiet: null }); // its "finished without doing anything" item is answered
    return Response.json(fresh, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
