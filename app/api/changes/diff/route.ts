import { prDiff, validPr } from "@/lib/changes";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const pr = new URL(req.url).searchParams.get("pr") ?? "";
  if (!validPr(pr)) return new Response("That isn't a pull request address.", { status: 400 });
  return new Response(await prDiff(pr), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
