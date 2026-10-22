import { changesView, validPr } from "@/lib/changes";
import { createTask, parseTaskInput } from "@/lib/tasks";

export const dynamic = "force-dynamic";

// Send back to fix, for a pull request agentbox didn't make: a new job that works on that pull request's own branch.
export async function POST(req: Request) {
  const { pr, note } = (await req.json().catch(() => ({}))) as { pr?: string; note?: string };
  if (!pr || !validPr(pr)) return Response.json({ error: "That isn't a pull request address." }, { status: 400 });
  const v = await changesView(pr);
  if (!v?.project) return Response.json({ error: "That pull request's project isn't on this Mac. Add it on the Projects page first." }, { status: 409 });
  if (v.state !== "OPEN") return Response.json({ error: "That pull request isn't open any more." }, { status: 409 });
  const findings = v.review?.verdict === "needs work" ? v.review.text ?? "" : "";
  const task = [
    `Fix pull request #${v.number} ("${v.title}"): ${pr}. You're on its branch, so your commits update that pull request.`,
    note?.trim() ? `\nNic says:\n${note.trim().slice(0, 4000)}` : "",
    findings ? `\nA reviewer found these problems:\n${findings}` : "",
  ].join("\n");
  const parsed = parseTaskInput({ kind: "build", task, project: v.project, freedom: "auto", careful: true });
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    const { agent } = await createTask(parsed.t, { onBranch: { branch: v.branch, prUrl: pr } });
    return Response.json({ agentId: agent.id }, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
