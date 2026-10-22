import { changesView, validPr } from "@/lib/changes";
import { reviewExternalPr } from "@/lib/prReview";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const pr = new URL(req.url).searchParams.get("pr") ?? "";
  if (!validPr(pr)) return Response.json({ error: "That isn't a pull request address." }, { status: 400 });
  const v = await changesView(pr);
  if (!v) return Response.json({ error: "Couldn't load that pull request from GitHub. Check you're online and try again." }, { status: 502 });
  // Pull requests that agentbox didn't review get a reviewer automatically (Nic never has to ask).
  if (!v.careful && !v.review && v.state === "OPEN" && v.project) reviewExternalPr(pr, v.project).catch(() => {});
  return Response.json(v);
}
