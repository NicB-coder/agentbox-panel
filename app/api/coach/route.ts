import { readStoredBrief } from "@/lib/briefs";
import { coachCheck, coachIdeas, coachImprove, type CoachAnswer, type CoachWhere } from "@/lib/coach";
import { pausedAll } from "@/lib/runner";
import { usageBlocked } from "@/lib/usage";

export const dynamic = "force-dynamic";
export const maxDuration = 150;

// The prompt coach (lib/coach.ts). When it can't help right now (paused, out of usage), it answers
// { skip: reason } so the screen carries on with Nic's own words instead of blocking him.
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { step?: string; goal?: string; where?: string; brief?: { name?: string; hash?: string } | null; answers?: CoachAnswer[]; interests?: string; current?: string[] };
  const where: CoachWhere = b.where === "build" || b.where === "research" ? b.where : "workflow";
  const goal = String(b.goal ?? "").trim();
  const current = Array.isArray(b.current) ? b.current.map(String).slice(0, 10) : [];
  if (pausedAll()) return Response.json({ skip: "Everything is paused, so the coach is resting too." });
  if (usageBlocked().reason === "out") return Response.json({ skip: "You're out of Claude usage right now, so the coach is resting." });

  const text = b.brief?.hash ? readStoredBrief(String(b.brief.hash)) : null;
  const brief = text !== null && b.brief ? { name: String(b.brief.name ?? "brief.md").slice(0, 80), text } : null;
  try {
    if (b.step === "ideas") return Response.json({ ideas: await coachIdeas(String(b.interests ?? "").slice(0, 2000), where) });
    if (!goal && !brief) return Response.json({ error: "Write what you want first. One line is enough." }, { status: 400 });
    if (goal.length > 40_000) return Response.json({ error: "That's very long. Attach it as a brief file instead." }, { status: 400 });
    const g = goal || `Make what the attached brief (${brief!.name}) describes.`;
    if (b.step === "improve") {
      const answers = (Array.isArray(b.answers) ? b.answers : []).slice(0, 6).map((a) => ({ q: String(a?.q ?? "").slice(0, 200), a: String(a?.a ?? "").slice(0, 400) }));
      return Response.json(await coachImprove(g, where, answers, brief, current));
    }
    return Response.json(await coachCheck(g, where, brief, current));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
