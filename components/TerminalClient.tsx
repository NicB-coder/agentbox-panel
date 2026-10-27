"use client";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";
import { InfoTip, PageTitle, post } from "./bits";
import { btn, field } from "./ui";

// A real terminal into the agent account, for the rare times Nic still needs one.
export default function TerminalClient({ cmd }: { cmd: string }) {
  const box = useRef<HTMLDivElement>(null);
  const idRef = useRef<string>("");
  const [status, setStatus] = useState<"connecting" | "ready" | "closed" | "error">("connecting");
  const [line, setLine] = useState("");
  const [gen, setGen] = useState(0);
  // Keystrokes go out one batch at a time, in order (separate requests could arrive shuffled).
  const pending = useRef("");
  const sending = useRef(false);
  const flush = async () => {
    if (sending.current || !pending.current || !idRef.current) return;
    sending.current = true;
    const data = pending.current;
    pending.current = "";
    try {
      await post("/api/terminal/input", { id: idRef.current, data });
    } catch {
      setStatus("closed");
    } finally {
      sending.current = false;
      if (pending.current) flush();
    }
  };
  const send = (data: string) => {
    pending.current += data;
    flush();
  };

  useEffect(() => {
    let es: EventSource | null = null;
    let term: import("@xterm/xterm").Terminal | null = null;
    let ro: ResizeObserver | null = null;
    let alive = true;
    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]);
      if (!alive || !box.current) return;
      term = new Terminal({ fontSize: 14, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", cursorBlink: true, theme: { background: "#15171B", foreground: "#F6F7F9" }, scrollback: 5000 });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(box.current);
      fit.fit();
      try {
        const j = await post<{ id: string }>("/api/terminal", { fresh: gen > 0 });
        idRef.current = j.id;
      } catch {
        setStatus("error");
        return;
      }
      const sizeUp = () => {
        fit.fit();
        post("/api/terminal/input", { id: idRef.current, cols: term!.cols, rows: term!.rows }).catch(() => {});
      };
      sizeUp();
      ro = new ResizeObserver(sizeUp);
      ro.observe(box.current);
      term.onData((d) => send(d));
      es = new EventSource(`/api/terminal/stream?id=${idRef.current}`);
      es.onmessage = (e) => {
        const d = JSON.parse(e.data) as string;
        term!.write(d);
        if (d.includes("[The terminal closed.")) setStatus("closed");
      };
      es.onerror = () => setStatus((s) => (s === "closed" ? s : "error"));
      setStatus("ready");
      if (cmd && gen === 0) setTimeout(() => send(cmd), 600); // typed in, not run: Nic presses Enter
      term.focus();
    })();
    return () => {
      alive = false;
      es?.close();
      ro?.disconnect();
      term?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen]);

  const keys: [string, string][] = [["Tab", "\t"], ["Ctrl-C", "\x03"], ["↑", "\x1b[A"], ["↓", "\x1b[B"], ["Esc", "\x1b"]];
  return (
    <div>
      <PageTitle
        title="Terminal"
        sub={
          <span className="inline-flex items-center">
            For advanced fixes only: a place to type commands straight into this Mac. You never need it for normal use.
            <InfoTip text="Everything you type runs on agentbox for real. Agents and the panel keep working while it's open. Close the page whenever you like; it stays where you left it." label="Terminal" />
          </span>
        }
      >
        <button className={btn.secondary} onClick={() => setGen(gen + 1)}>
          New terminal
        </button>
      </PageTitle>
      {status === "error" && <p className="mb-4 rounded-[14px] bg-[#FDE8E6] px-4 py-3 text-[15px] font-medium text-[#A11B12]">Lost the connection to the terminal. Press New terminal to open another.</p>}
      <div className="overflow-hidden rounded-[24px] bg-ink p-3 sm:p-4">
        <div ref={box} className="h-[60vh] min-h-[320px] w-full" aria-label="Terminal" role="application" />
      </div>
      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          send(`${line}\r`);
          setLine("");
        }}
      >
        <label className="flex-1">
          <span className="sr-only">Type a command</span>
          <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="Type a command and press Run (handy on a phone)" autoCapitalize="off" autoCorrect="off" spellCheck={false} className={`${field} min-h-11 w-full font-mono`} />
        </label>
        <button type="submit" className={btn.primary} disabled={status !== "ready"}>
          Run
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Keys">
        {keys.map(([label, seq]) => (
          <button key={label} type="button" className={btn.secondary + " !px-4"} onClick={() => send(seq)} disabled={status !== "ready"}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
