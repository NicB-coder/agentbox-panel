import { getRun } from "@/lib/db";
import { canContinue, continueRun, startRun } from "@/lib/runner";

export const dynamic = "force-dynamic";

// "Try again": pick up where it stopped if its copy is still there, otherwise the same task as a fresh run.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const run = getRun(Number((await params).id));
  if (!run) return Response.json({ error: "That run isn't here any more." }, { status: 404 });
  if (run.workflowRunId) return Response.json({ error: "This was part of a workflow. Run the workflow again instead." }, { status: 400 });
  try {
    if (canContinue(run)) {
      continueRun(run.id, {});
      return Response.json({ ok: true, continued: true }, { status: 201 });
    }
    const usual = run.task === "Its usual job" || run.task === "Scheduled run" || run.extra.jobStart;
    const fresh = await startRun(run.agentId, {
      task: usual ? undefined : run.task, mode: run.mode, trigger: "manual",
      extra: run.extra.followUp ? { followUp: true, careful: run.extra.careful, model: run.extra.model, allowed: run.extra.allowed, maxMinutes: run.extra.maxMinutes } : undefined,
    });
    return Response.json(fresh, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
