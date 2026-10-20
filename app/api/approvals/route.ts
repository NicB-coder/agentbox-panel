import { createApproval, getAgent, getRun } from "@/lib/db";
import { notify } from "@/lib/notify";
import { plainApprovalSummary } from "@/lib/runner";

export const dynamic = "force-dynamic";

// Called by the permission hook inside an agent run when it wants Nic's OK.
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { runId?: number; toolName?: string; toolInput?: Record<string, unknown> };
  const run = b.runId ? getRun(b.runId) : null;
  if (!run || (run.status !== "working" && run.status !== "waiting")) return Response.json({ error: "No such run." }, { status: 404 });
  const toolName = String(b.toolName ?? "unknown");
  const input = b.toolInput ?? {};
  const a = createApproval({
    runId: run.id,
    kind: "tool",
    toolName,
    summary: plainApprovalSummary(toolName, input),
    detail: JSON.stringify(input, null, 2).slice(0, 20000),
  });
  const agent = getAgent(run.agentId);
  if (agent) notify(agent, "needs_ok", `wants to: ${a.summary}. Waiting for your OK.`);
  return Response.json({ id: a.id }, { status: 201 });
}
