import { workflowPageState } from "@/lib/workflowViews";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const run = new URL(req.url).searchParams.get("run");
  const s = workflowPageState(Number((await params).id), run === null ? null : Number(run));
  return s ? Response.json(s) : Response.json({ error: "There's no workflow with that number." }, { status: 404 });
}
