import { missingFile } from "@/lib/briefs";
import { getAgent } from "@/lib/db";
import { startRun } from "@/lib/runner";
import type { WorkMode } from "@/lib/types";

export const dynamic = "force-dynamic";

const MODES: WorkMode[] = ["auto", "plan", "ask", "look"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const body = (await req.json().catch(() => ({}))) as { task?: string; mode?: WorkMode };
  if (body.mode && !MODES.includes(body.mode)) return Response.json({ error: "Pick how it should work with you." }, { status: 400 });
  if (body.task && body.task.length > 4000) return Response.json({ error: "That task is too long. Keep it under 4,000 characters." }, { status: 400 });
  const agent = getAgent(id);
  const missing = agent?.kind === "claude" && agent.project ? await missingFile(agent.project, [agent.prompt, body.task ?? ""], agent.job.brief) : null;
  if (missing) return Response.json({ error: missing.message, missing }, { status: 409 });
  try {
    const run = await startRun(id, { task: body.task, mode: body.mode, trigger: "manual" });
    return Response.json(run, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
