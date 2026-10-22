import { startUpdate, updateLog, updateStatus } from "@/lib/update";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const withLog = new URL(req.url).searchParams.get("log") === "1";
  return Response.json({ status: updateStatus(), log: withLog ? updateLog() : undefined });
}

export async function POST(req: Request) {
  const { force } = (await req.json().catch(() => ({}))) as { force?: boolean };
  try {
    await startUpdate({ force: !!force });
    return Response.json({ ok: true }, { status: 202 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
