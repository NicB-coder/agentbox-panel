import { getRun } from "@/lib/db";
import { startRun } from "@/lib/runner";

export const dynamic = "force-dynamic";

// "Try again": the same task, the same way, as a fresh run.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const run = getRun(Number((await params).id));
  if (!run) return Response.json({ error: "That run isn't here any more." }, { status: 404 });
  if (run.workflowRunId) return Response.json({ error: "This was part of a workflow. Run the workflow again instead." }, { status: 400 });
  const usual = run.task === "Its usual job" || run.task === "Scheduled run";
  try {
    const fresh = await startRun(run.agentId, { task: usual ? undefined : run.task, mode: run.mode, trigger: "manual" });
    return Response.json(fresh, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
