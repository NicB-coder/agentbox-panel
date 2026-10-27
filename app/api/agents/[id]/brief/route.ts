import { getAgent } from "@/lib/db";
import { readBrief } from "@/lib/tasks";

export const dynamic = "force-dynamic";

// The brief attached to a job, to read on its page.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = getAgent(Number((await params).id));
  const text = a?.job.brief ? readBrief(a.id) : null;
  if (!a?.job.brief || text === null) return Response.json({ error: "This job has no brief." }, { status: 404 });
  return Response.json({ name: a.job.brief, text });
}
