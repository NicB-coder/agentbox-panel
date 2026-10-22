import { terminalSession } from "@/lib/terminal";

export const dynamic = "force-dynamic";

// Opens the terminal (or the one that's already open). {fresh: true} starts a new one.
export async function POST(req: Request) {
  const { fresh } = (await req.json().catch(() => ({}))) as { fresh?: boolean };
  const s = terminalSession(!!fresh);
  return Response.json({ id: s.id });
}
