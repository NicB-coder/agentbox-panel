import { stopWorkflow } from "@/lib/workflowRunner";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  stopWorkflow(Number((await params).id), "You stopped it.", { byUser: true });
  return Response.json({ ok: true });
}
