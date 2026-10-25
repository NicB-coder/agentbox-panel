"use client";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { HelperContext, HelperMessage, HelperState, HelperStreamEvent } from "@/lib/helperTypes";
import { clockOf } from "@/lib/words";
import { post } from "../bits";
import { btn } from "../ui";
import { helperExtra, screenErrors, useHelperStoreVersion } from "./helperStore";
import { useHelperSpot } from "./helperSpot";
import { MessageView } from "./HelperMessageView";

// The Helper: a round chat bubble in the bottom-right corner of every page.
// It explains the site, what's on screen and what's running, and helps make agents and workflows.
// It follows Nic into every pop-up and panel: a pop-up (a modal <dialog>) makes the rest of the page
// unclickable, so the bubble and chat are moved inside the pop-up that's open on top while it's open.

function currentContext(path: string): HelperContext {
  const a = path.match(/^\/agents\/(\d+)/);
  const w = path.match(/^\/workflows\/(\d+)/);
  const run = Number(new URLSearchParams(window.location.search).get("run"));
  const h1 = document.querySelector("main h1")?.textContent?.trim();
  return {
    path,
    title: h1 || undefined,
    agentId: a ? Number(a[1]) : undefined,
    workflowId: w ? Number(w[1]) : undefined,
    wfRunId: run > 0 ? run : undefined,
    ...helperExtra(),
    errors: screenErrors(),
  };
}

const isPhone = () => window.matchMedia("(max-width: 1023px)").matches;

function until(ms: number) {
  const mins = Math.max(1, Math.ceil((ms - Date.now()) / 60000));
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
}

let sendCount = 0;
const newClientId = () => `${Date.now().toString(36)}-${(++sendCount).toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export default function HelperBubble() {
  const path = usePathname() ?? "/";
  const storeVersion = useHelperStoreVersion();
  const [mounted, setMounted] = useState(false);
  const [open, setOpenState] = useState(false);
  // An open chat stays open across pages and reloads of this tab.
  const setOpen = useCallback((v: boolean) => {
    setOpenState(v);
    try {
      sessionStorage.setItem("agentbox:helper-open", v ? "1" : "");
    } catch {
      /* private mode */
    }
  }, []);
  useEffect(() => {
    setMounted(true);
    try {
      if (sessionStorage.getItem("agentbox:helper-open") && !isPhone()) setOpenState(true);
    } catch {
      /* private mode */
    }
  }, []);
  const [data, setData] = useState<HelperState | null>(null);
  const [live, setLive] = useState<Record<number, { text: string; status: string }>>({});
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(false);
  const [showChats, setShowChats] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [newText, setNewText] = useState(false);
  const shownChat = useRef<number | null>(null);
  const jumpToEnd = useRef(false);
  const attached = useRef(new Set<number>());
  const box = useRef<HTMLTextAreaElement>(null);
  const bubble = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const chatId = data?.chat?.id ?? null;
  const busy = sending || (data?.messages ?? []).some((m) => m.status === "streaming");
  const panelId = useId();
  const titleId = useId();
  const errorsOnScreen = screenErrors().length > 0;
  const sendingNow = useRef(false);
  const { host, bubbleStyle, panelStyle } = useHelperSpot(open);
  void storeVersion; // re-render when the page's errors or selection change

  const load = useCallback(
    async (chat?: number | null) => {
      const ctx = currentContext(path);
      const q = new URLSearchParams({ ctx: JSON.stringify({ ...ctx, title: undefined }) });
      if (chat) q.set("chat", String(chat));
      try {
        const r = await fetch(`/api/helper?${q}`, { cache: "no-store" });
        if (r.status === 404 && chat) return load(null); // that chat was cleaned up: show the latest one
        if (r.ok) setData(await r.json());
      } catch {
        /* offline: keep what we have */
      }
    },
    [path],
  );

  // Follow a reply that's being written (also one started on another device or before a reload).
  const attach = useCallback(async (msgId: number) => {
    if (attached.current.has(msgId)) return;
    attached.current.add(msgId);
    try {
      const r = await fetch(`/api/helper/stream?msg=${msgId}`, { cache: "no-store" });
      if (!r.body) throw new Error("no stream");
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 1);
          if (!line.trim()) continue;
          const e = JSON.parse(line) as HelperStreamEvent;
          if (e.t === "text") setLive((l) => ({ ...l, [msgId]: { text: e.text, status: l[msgId]?.status ?? "" } }));
          else if (e.t === "status") setLive((l) => ({ ...l, [msgId]: { text: l[msgId]?.text ?? "", status: e.text } }));
          else if (e.t === "done") {
            setData((d) => (d ? { ...d, messages: d.messages.map((m) => (m.id === msgId ? e.message : m)) } : d));
            setLive((l) => {
              const { [msgId]: _gone, ...rest } = l;
              return rest;
            });
            setAnnounce(`Helper: ${e.message.text.replace(/\[\[[^|\]]*\|([^\]]*)\]\]/g, "$1").slice(0, 400)}`);
            if (!openRef.current) setUnread(true);
          }
        }
      }
    } catch {
      /* the stream dropped: the saved reply loads next time */
    } finally {
      attached.current.delete(msgId);
    }
  }, []);

  // Load when opened, and again when Nic moves to another page while it's open.
  useEffect(() => {
    if (open) load(chatId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, path]);

  useEffect(() => {
    for (const m of data?.messages ?? []) if (m.status === "streaming" && m.id > 0) attach(m.id);
  }, [data, attach]);

  // The suggested questions follow what's open (a panel, a step, an error), not just the page.
  const ctxKey = mounted ? JSON.stringify({ ...helperExtra(), errors: screenErrors().length > 0 }) : "";
  const firstCtx = useRef(true);
  useEffect(() => {
    if (!open) return;
    if (firstCtx.current) {
      firstCtx.current = false;
      return;
    }
    const t = setTimeout(async () => {
      const q = new URLSearchParams({ only: "suggestions", ctx: JSON.stringify({ ...currentContext(path), title: undefined }) });
      try {
        const r = await fetch(`/api/helper?${q}`, { cache: "no-store" });
        if (r.ok) {
          const j = (await r.json()) as { suggestions: string[] };
          setData((d) => (d ? { ...d, suggestions: j.suggestions } : d));
        }
      } catch {
        /* keep the old ones */
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey, open]);

  // The view stays still while a reply is typed. It only jumps to the end when the panel opens,
  // another chat is shown, or Nic sends something. New words below the fold show "↓ New text".
  const atEnd = () => {
    const el = list.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };
  const toEnd = (smooth = false) => {
    const el = list.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setNewText(false);
  };
  useEffect(() => {
    if (!open) {
      shownChat.current = null;
      return;
    }
    const id = data?.chat?.id ?? null;
    if (data && (id !== shownChat.current || jumpToEnd.current)) {
      shownChat.current = id;
      jumpToEnd.current = false;
      requestAnimationFrame(() => toEnd());
    }
  }, [open, data, showChats]);
  useEffect(() => {
    const el = list.current;
    const inner = el?.firstElementChild;
    if (!open || !el || !inner) return;
    let last = inner.getBoundingClientRect().height;
    const ro = new ResizeObserver(() => {
      const h = inner.getBoundingClientRect().height;
      if (h > last + 1 && !atEnd()) setNewText(true);
      last = h;
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, [open, showChats, data?.chat?.id, data?.messages.length]);

  useEffect(() => {
    if (!open) return;
    setUnread(false);
    const t = setTimeout(() => box.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("dialog[open]")) return; // a pop-up is showing: Escape is for it (or handled in the chat itself)
      setOpen(false);
      bubble.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // One question, one request: a double press or a repeated event can't send it twice
  // (and the server answers a repeated send id with the first reply).
  async function send(text: string) {
    const t = text.trim();
    if (!t || sendingNow.current || busy) return;
    sendingNow.current = true;
    const clientId = newClientId();
    setSending(true);
    setError("");
    setShowChats(false);
    const ctx = currentContext(path);
    const temp: HelperMessage[] = [
      { id: -1, chatId: chatId ?? 0, role: "user", text: t, status: "done", meta: {}, createdAt: Date.now() },
      { id: -2, chatId: chatId ?? 0, role: "helper", text: "", status: "streaming", meta: {}, createdAt: Date.now() },
    ];
    jumpToEnd.current = true;
    setData((d) => ({ chat: d?.chat ?? null, chats: d?.chats ?? [], outOfUsage: d?.outOfUsage ?? null, suggestions: d?.suggestions, messages: [...(d?.messages ?? []), ...temp] }));
    setInput("");
    try {
      const j = await post<{ chatId: number; user: HelperMessage; reply: HelperMessage }>("/api/helper/send", { chatId, text: t, context: ctx, clientId });
      setData((d) => {
        const msgs = (d?.messages ?? []).filter((m) => m.id > 0);
        return {
          chat: d?.chat && d.chat.id === j.chatId ? d.chat : { id: j.chatId, title: t.slice(0, 60), createdAt: Date.now(), updatedAt: Date.now() },
          chats: d?.chats ?? [],
          outOfUsage: d?.outOfUsage ?? null,
          suggestions: d?.suggestions,
          messages: [...msgs, j.user, j.reply],
        };
      });
      if (j.reply.status === "streaming") attach(j.reply.id);
      else load(j.chatId);
    } catch (e) {
      setData((d) => (d ? { ...d, messages: d.messages.filter((m) => m.id > 0) } : d));
      setInput(t);
      setError((e as Error).message);
    } finally {
      sendingNow.current = false;
      setSending(false);
    }
  }

  // Continue a reply that stopped partway (or try a failed one again). Only on Nic's click.
  async function continueReply(msgId: number) {
    if (sendingNow.current || busy) return;
    sendingNow.current = true;
    setError("");
    try {
      const j = await post<{ reply: HelperMessage }>("/api/helper/continue", { msgId });
      setData((d) => (d ? { ...d, messages: d.messages.map((m) => (m.id === msgId ? j.reply : m)) } : d));
      attach(msgId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      sendingNow.current = false;
    }
  }

  async function newChat() {
    setError("");
    setShowChats(false);
    try {
      const r = await fetch("/api/helper", { method: "POST" });
      const j = (await r.json()) as HelperState;
      setData(j);
      load(j.chat?.id);
      box.current?.focus();
    } catch {
      setError("Couldn't reach agentbox. Try again.");
    }
  }

  // Open (and maybe ask) from elsewhere on the page, e.g. "Ask the Helper" on an error.
  useEffect(() => {
    const onAsk = (e: Event) => {
      const d = (e as CustomEvent<{ text: string; send: boolean }>).detail;
      setOpen(true);
      if (d.send) setTimeout(() => sendRef.current(d.text), 50);
      else setInput(d.text);
    };
    const onReload = () => load(chatId);
    window.addEventListener("agentbox:helper", onAsk);
    window.addEventListener("agentbox:helper-reload", onReload);
    return () => {
      window.removeEventListener("agentbox:helper", onAsk);
      window.removeEventListener("agentbox:helper-reload", onReload);
    };
  }, [load, chatId]);
  const sendRef = useRef(send);
  sendRef.current = send;

  const onNavigate = () => {
    if (isPhone()) setOpen(false);
  };


  const out = data?.outOfUsage;
  const messages = data?.messages ?? [];
  const suggestions = data?.suggestions ?? [];
  const dot = !open && (unread || errorsOnScreen);

  function pickSuggestion(s: string) {
    if (s.endsWith("…")) {
      setInput(s.replace(/…$/, " "));
      box.current?.focus();
    } else send(s);
  }

  if (!mounted) return null;
  return createPortal(
    <div data-helper-root="" className="contents">
      <button
        ref={bubble}
        type="button"
        data-helper-bubble=""
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close the Helper" : dot ? (errorsOnScreen ? "Helper: I can explain the error on this page" : "Helper: I have an answer for you") : "Open the Helper. Ask anything about agentbox"}
        onClick={() => setOpen(!open)}
        style={bubbleStyle}
        className={`fixed right-4 z-[60] h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-[0_8px_24px_rgba(21,23,27,0.28)] hover:bg-black bottom-[calc(72px+env(safe-area-inset-bottom))] lg:right-6 lg:bottom-6 ${open ? "hidden lg:inline-flex" : "inline-flex"}`}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3 8.9 8.9 0 0 1-3.9-.9L3 20.5l1.6-4.6a8 8 0 0 1-1.1-4.4A8.4 8.4 0 0 1 12 3.2a8.4 8.4 0 0 1 9 8.3Z" />
            <path d="M8.5 11.5h.01M12.5 11.5h.01M16.5 11.5h.01" strokeWidth="2.6" />
          </svg>
        )}
        {dot && <span className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#C8281C]" aria-hidden="true" />}
      </button>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {open && (
        <section
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          style={panelStyle}
          onKeyDown={(e) => {
            // Escape closes the chat, not the pop-up it's sitting in.
            if (e.key !== "Escape" || e.defaultPrevented) return;
            const inner = (e.target as HTMLElement).closest("dialog");
            if (inner && e.currentTarget.contains(inner)) return; // its own "Are you sure?" handles it
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            bubble.current?.focus();
          }}
          className={`fixed inset-x-0 top-2 ${host ? "bottom-2" : "bottom-[calc(57px+env(safe-area-inset-bottom))]"} z-[60] flex flex-col overflow-hidden rounded-t-[24px] border border-line bg-white shadow-[0_-8px_40px_rgba(21,23,27,0.18)] lg:inset-x-auto lg:top-auto lg:right-6 lg:bottom-[96px] lg:h-[min(640px,calc(100vh-128px))] lg:w-[380px] lg:rounded-[24px] lg:shadow-[0_20px_60px_rgba(21,23,27,0.22)]`}
        >
          {/* Header */}
          <div className="flex items-center gap-1 border-b border-line py-2 pl-5 pr-2">
            <h2 id={titleId} className="mr-auto text-[18px] font-bold">
              Helper
            </h2>
            {(data?.chats.length ?? 0) > 1 && (
              <button type="button" className="min-h-11 rounded-full px-3 text-[14px] font-semibold text-muted hover:bg-soft hover:text-ink" aria-expanded={showChats} onClick={() => setShowChats(!showChats)}>
                Earlier chats
              </button>
            )}
            <button type="button" className="min-h-11 rounded-full px-3 text-[14px] font-semibold hover:bg-soft" onClick={newChat} disabled={busy}>
              New chat
            </button>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-soft"
              aria-label="Close the Helper"
              onClick={() => {
                setOpen(false);
                bubble.current?.focus();
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          {showChats ? (
            <div className="flex-1 overflow-y-auto p-3">
              <p className="px-2 pb-2 text-[14px] text-muted">Your last {data?.chats.length} chats. Pick one to see it again.</p>
              <ul className="flex flex-col gap-1">
                {data?.chats.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`flex min-h-12 w-full flex-col items-start justify-center rounded-[14px] px-3 py-2 text-left hover:bg-soft ${c.id === chatId ? "bg-soft" : ""}`}
                      onClick={() => {
                        setShowChats(false);
                        load(c.id);
                      }}
                    >
                      <span className="line-clamp-1 text-[15px] font-semibold">{c.title || "New chat"}</span>
                      <span className="text-[13px] text-muted">{new Date(c.updatedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {clockOf(c.updatedAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div ref={list} className="relative flex-1 overflow-y-auto px-4 py-4" onScroll={() => newText && atEnd() && setNewText(false)}>
              {messages.length === 0 ? (
                <div className="flex flex-col gap-3 pt-2 text-[15px] leading-relaxed">
                  <p className="text-[17px] font-semibold">Hi Nic! I'm the Helper.</p>
                  <p className="text-muted">Ask me anything about agentbox. I can:</p>
                  <ul className="flex list-disc flex-col gap-1 pl-5 text-muted">
                    <li>explain what's on this page and what any button does,</li>
                    <li>tell you what your agents are doing, and why something stopped,</li>
                    <li>help you make a new agent or workflow.</li>
                  </ul>
                  <p className="text-[14px] text-muted">I only look and suggest. Nothing happens unless you click.</p>
                </div>
              ) : (
                <ol className="flex flex-col gap-4" aria-label="Conversation">
                  {messages.map((m) => (
                    <MessageView
                      key={m.id}
                      m={m}
                      live={live[m.id]?.text}
                      status={live[m.id]?.status}
                      onNavigate={onNavigate}
                      onContinue={busy ? undefined : continueReply}
                      onChange={() => {
                        setInput("Change it: ");
                        box.current?.focus();
                      }}
                    />
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* Bottom: out of usage, error, input, suggestions */}
          <div className="relative border-t border-line px-3 pb-3 pt-2">
            {newText && !showChats && (
              <button
                type="button"
                onClick={() => toEnd(true)}
                className="absolute -top-14 left-1/2 z-10 inline-flex min-h-11 -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-semibold text-white shadow-[0_6px_18px_rgba(21,23,27,0.25)] hover:bg-black"
              >
                <span aria-hidden="true">↓</span> New text
              </button>
            )}
            {out && (
              <p className="mb-2 rounded-[14px] bg-[#FDE8E6] px-3 py-2 text-[14px] font-medium text-[#A11B12]">
                Out of Claude usage{out.until ? ` until ${clockOf(out.until)} (in ${until(out.until)})` : ""}. I'll be back then.
              </p>
            )}
            {errorsOnScreen && !busy && messages.length === 0 && (
              <button type="button" className="mb-2 w-full rounded-[14px] bg-[#FDF0DC] px-3 py-2 text-left text-[14px] font-semibold text-[#8A4600]" onClick={() => send("What does this error mean, and what should I do?")}>
                I see an error on this page. Want me to explain it?
              </button>
            )}
            {error && (
              <p role="alert" className="mb-2 text-[14px] font-medium text-[#A11B12]">
                {error}
              </p>
            )}
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <label htmlFor={`${panelId}-in`} className="sr-only">
                Ask the Helper
              </label>
              <textarea
                id={`${panelId}-in`}
                ref={box}
                rows={1}
                value={input}
                maxLength={4000}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder={out ? "Back when usage resets" : "Ask anything…"}
                disabled={!!out}
                className="max-h-32 min-h-11 flex-1 resize-none rounded-[14px] border border-[#C9CDD4] bg-white px-3 py-2.5 text-[15px] leading-snug field-sizing-content"
              />
              <button type="submit" className={btn.primary + " !h-11 !w-11 !rounded-full !p-0"} disabled={busy || !input.trim() || !!out} aria-label="Send">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </form>
            {!out && suggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Suggested questions" role="group">
                {suggestions.map((s) => (
                  <button key={s} type="button" disabled={busy} onClick={() => pickSuggestion(s)} className="min-h-11 rounded-full border border-[#C9CDD4] bg-white px-3 text-[14px] font-medium hover:bg-soft disabled:opacity-50">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>,
    host ?? document.body,
  );
}
