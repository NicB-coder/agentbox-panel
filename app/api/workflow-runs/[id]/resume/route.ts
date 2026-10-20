import { resumeWorkflow } from "@/lib/workflowRunner";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await resumeWorkflow(Number((await params).id));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
