import { setSetting } from "@/lib/db";
import { discordLog, pingSettings, sendDiscord } from "@/lib/notify";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ log: discordLog(), ping: pingSettings() });
}

// {test: true} sends a test message; {ping: {shipped, needs_ok}} changes when it @here's.
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { test?: boolean; ping?: { shipped?: boolean; needs_ok?: boolean } };
  if (b.ping) setSetting("discordPing", { ...pingSettings(), ...b.ping });
  if (b.test) {
    const ok = await sendDiscord("If you can read this, agentbox can reach you on Discord.", { title: "Test message from agentbox" });
    if (!ok) return Response.json({ error: discordLog()[0]?.why ?? "Discord didn't take the message." }, { status: 502 });
  }
  return Response.json({ log: discordLog(), ping: pingSettings() });
}
