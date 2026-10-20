import { getWfRun } from "@/lib/db";
import { startWorkflow } from "@/lib/workflowRunner";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const wr = getWfRun(Number((await params).id));
  if (!wr) return Response.json({ error: "That run isn't here any more." }, { status: 404 });
  try {
    const fresh = await startWorkflow(wr.workflowId, { input: wr.input, test: wr.test, trigger: wr.test ? "test" : "manual" });
    return Response.json(fresh, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
