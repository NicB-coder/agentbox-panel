import { createTask, parseTaskInput } from "@/lib/tasks";

export const dynamic = "force-dynamic";

// "Ask Claude to fix this": a new job on this panel's own code with the error attached. It shows its plan first.
export async function POST(req: Request) {
  const { error, where } = (await req.json().catch(() => ({}))) as { error?: string; where?: string };
  const task = [
    `Nic saw this error in the agentbox panel${where ? ` (on ${String(where).slice(0, 200)})` : ""} and wants it fixed:`,
    "",
    `"${String(error ?? "").slice(0, 2000)}"`,
    "",
    "Find out why it happens and fix it in this panel's code (the agentbox-panel project). If it isn't a bug in the panel (for example the Mac was offline or a setting is wrong), don't change code: explain what Nic should do in plain words instead.",
  ].join("\n");
  const parsed = parseTaskInput({ kind: "build", task, project: "agentbox-panel", freedom: "check", careful: true });
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    const { agent } = await createTask(parsed.t);
    return Response.json({ agentId: agent.id }, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
