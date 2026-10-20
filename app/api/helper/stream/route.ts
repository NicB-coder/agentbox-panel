import { subscribe } from "@/lib/helper";
import { getMessage } from "@/lib/helperDb";
import type { HelperStreamEvent } from "@/lib/helperTypes";

export const dynamic = "force-dynamic";

// Follow one reply as it's written: one JSON line per update, ending with the saved message.
export async function GET(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("msg"));
  const enc = new TextEncoder();
  let unsub: (() => void) | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        unsub?.();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      const send = (e: HelperStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
        } catch {
          close();
          return;
        }
        if (e.t === "done") close();
      };
      unsub = subscribe(id, send);
      if (!unsub) {
        // Already finished (or never started): send what's saved.
        const m = getMessage(id);
        if (m) send({ t: "done", message: m });
        close();
      }
      req.signal.addEventListener("abort", close);
    },
    cancel() {
      unsub?.();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
