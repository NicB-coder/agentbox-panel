import os from "node:os";
import { validPr } from "@/lib/changes";
import { sh } from "@/lib/runner";

export const dynamic = "force-dynamic";

// A comment from Nic on the pull request, posted from the panel.
export async function POST(req: Request) {
  const { pr, body } = (await req.json().catch(() => ({}))) as { pr?: string; body?: string };
  if (!pr || !validPr(pr)) return Response.json({ error: "That isn't a pull request address." }, { status: 400 });
  if (!body?.trim()) return Response.json({ error: "Write your comment first." }, { status: 400 });
  const r = await sh("gh", ["pr", "comment", pr, "--body", `${body.trim().slice(0, 20000)}\n\n<sub>Nic, from agentbox</sub>`], os.homedir(), 30_000);
  if (!r.ok) return Response.json({ error: "GitHub didn't take the comment. Try again in a moment." }, { status: 502 });
  return Response.json({ ok: true });
}
