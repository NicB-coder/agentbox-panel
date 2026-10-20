import { activeRun, listAgents } from "@/lib/db";
import { startRun } from "@/lib/runner";

export const dynamic = "force-dynamic";

// "Ask Claude to fix this": starts a Builder task on this panel's own code with the error attached.
export async function POST(req: Request) {
  const { error, where } = (await req.json().catch(() => ({}))) as { error?: string; where?: string };
  const agents = listAgents().filter((a) => a.kind === "claude" && a.enabled && a.allowed !== "look");
  const builder = agents.find((a) => a.slug === "builder") ?? agents[0];
  if (!builder) return Response.json({ error: "There's no agent that can make changes. Add one first." }, { status: 409 });
  if (activeRun(builder.id)) return Response.json({ error: `${builder.name} is busy right now. Try again when it's done.` }, { status: 409 });
  const task = [
    `Nic saw this error in the agentbox panel${where ? ` (on ${String(where).slice(0, 200)})` : ""} and wants it fixed:`,
    "",
    `"${String(error ?? "").slice(0, 2000)}"`,
    "",
    "Find out why it happens and fix it in this panel's code (the agentbox-panel project). If it isn't a bug in the panel (for example the Mac was offline or a setting is wrong), don't change code: explain what Nic should do in plain words instead.",
  ].join("\n");
  try {
    await startRun(builder.id, { task, mode: "plan", trigger: "manual", project: "agentbox-panel" });
    return Response.json({ agentId: builder.id }, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
