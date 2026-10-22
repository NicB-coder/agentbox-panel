import { currentTerminal } from "@/lib/terminal";

export const dynamic = "force-dynamic";

// Server-sent events: what the shell prints, starting with what it printed before you opened the page.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  const s = currentTerminal();
  if (!s || s.id !== id) return new Response("No such terminal.", { status: 404 });
  const enc = new TextEncoder();
  let off: (() => void) | null = null;
  const stream = new ReadableStream({
    start(c) {
      const send = (d: string) => c.enqueue(enc.encode(`data: ${JSON.stringify(d)}\n\n`));
      if (s.buf) send(s.buf);
      const l = (d: string) => send(d);
      s.listeners.add(l);
      const ping = setInterval(() => c.enqueue(enc.encode(": ping\n\n")), 20_000);
      off = () => {
        s.listeners.delete(l);
        clearInterval(ping);
      };
      req.signal.addEventListener("abort", () => {
        off?.();
        try {
          c.close();
        } catch {
          /* closed */
        }
      });
    },
    cancel() {
      off?.();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" } });
}
