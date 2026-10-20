import { readLog } from "@/lib/runner";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const text = readLog(Number((await params).id));
  return new Response(text || "There's nothing in this log yet.", { headers: { "content-type": "text/plain; charset=utf-8" } });
}
