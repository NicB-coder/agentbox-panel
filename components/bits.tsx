"use client";
import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Icon, btn } from "./ui";
import { useReportError } from "./helper/helperStore";

export async function post<T = Record<string, unknown>>(url: string, body: unknown = {}, method = "POST"): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(body) });
  } catch {
    throw new Error("Couldn't reach agentbox. Check that you're online and try again.");
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? "Something went wrong. Try again in a moment.");
  return j as T;
}

// ⓘ: one plain sentence about a setting. Opens on click or tap, closes with Escape or a click elsewhere.
export function InfoTip({ text, label }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open || !bubble.current) return;
    const r = bubble.current.getBoundingClientRect();
    const over = r.right - (window.innerWidth - 12);
    const under = 12 - r.left;
    setShift(over > 0 ? -over : under > 0 ? under : 0);
  }, [open]);
  return (
    <span ref={wrap} className="relative -my-2 inline-flex align-middle">
      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#4A4F57] hover:text-ink"
        aria-label={label ? `What's this: ${label}` : "What's this?"}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShift(0);
          setOpen(!open);
        }}
      >
        <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-current text-[12px] font-bold leading-none">
          i
        </span>
      </button>
      {open && (
        <span
          ref={bubble}
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full z-40 mt-1 block w-[260px] -translate-x-1/2 rounded-[14px] bg-ink px-4 py-3 text-left text-[14px] font-normal leading-snug text-white shadow-lg"
          style={{ marginLeft: shift }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

// A label line with an optional help bubble.
export function Label({ children, tip, as = "span", htmlFor, className = "" }: { children: ReactNode; tip?: string; as?: "span" | "legend" | "label"; htmlFor?: string; className?: string }) {
  const inner = (
    <>
      {children}
      {tip && <InfoTip text={tip} label={typeof children === "string" ? children : undefined} />}
    </>
  );
  const cls = `flex items-center gap-0.5 text-[15px] font-semibold ${className}`;
  if (as === "legend") return <legend className={`${cls} mb-2`}>{inner}</legend>;
  if (as === "label")
    return (
      <span className={cls}>
        <label htmlFor={htmlFor}>{children}</label>
        {tip && <InfoTip text={tip} label={typeof children === "string" ? children : undefined} />}
      </span>
    );
  return <span className={cls}>{inner}</span>;
}

// Errors in plain words, with Try again and "Ask Claude to fix this".
export function ErrorBox({ message, onRetry, where, compact }: { message: string; onRetry?: () => void; where?: string; compact?: boolean }) {
  const [asked, setAsked] = useState<null | { agentId: number }>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useReportError(message); // the Helper bubble gets a dot and can explain it
  async function ask() {
    setBusy(true);
    setErr("");
    try {
      const j = await post<{ agentId: number }>("/api/fix", { error: message, where: where ?? (typeof location !== "undefined" ? location.pathname : "") });
      setAsked(j);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div role="alert" className={`rounded-[18px] bg-[#FDE8E6] ${compact ? "p-4" : "p-5"} text-[#A11B12]`}>
      <p className="text-[15px] font-semibold leading-snug">{message}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {onRetry && (
          <button type="button" className={btn.secondary} onClick={onRetry}>
            Try again
          </button>
        )}
        {asked ? (
          <Link href={`/agents/${asked.agentId}`} className={btn.link + " !text-[#A11B12]"}>
            Builder is looking into it. See how it's going
          </Link>
        ) : (
          <button type="button" className={btn.secondary} onClick={ask} disabled={busy}>
            {busy ? "Asking…" : "Ask Claude to fix this"}
          </button>
        )}
      </div>
      {err && <p className="mt-2 text-[14px]">{err}</p>}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[24px] border-2 border-dashed border-dash px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-soft">
        <Icon name={icon} color="#555A63" size={26} />
      </span>
      <p className="mt-4 text-[19px] font-semibold">{title}</p>
      <p className="mt-1 max-w-[440px] text-[15px] leading-relaxed text-muted">{text}</p>
      {action && <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

export function Loading({ text = "Loading…" }: { text?: string }) {
  return (
    <p className="flex items-center gap-2 py-6 text-[15px] text-muted" role="status">
      <span className="pulse h-2.5 w-2.5 rounded-full bg-[#9AA0A8]" aria-hidden="true" />
      {text}
    </p>
  );
}

export function Switch({ checked, onChange, label, hint, tip, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; tip?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <span>
        <span className="flex items-center text-[15px] font-semibold">
          <label htmlFor={id} className="cursor-pointer">
            {label}
          </label>
          {tip && <InfoTip text={tip} label={label} />}
        </span>
        {hint && <span className="block text-[14px] text-muted">{hint}</span>}
      </span>
      <label htmlFor={id} className="relative inline-flex min-h-11 shrink-0 cursor-pointer items-center">
        <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span
          aria-hidden="true"
          className={`relative h-8 w-14 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#2f4fd8] peer-disabled:opacity-50 ${checked ? "bg-[#1E6B34]" : "bg-[#80868F]"}`}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? "left-7" : "left-1"}`} />
        </span>
      </label>
    </div>
  );
}

// A small "Are you sure?" window built on <dialog>, so focus and Escape work.
export function Confirm({
  open, title, text, yes, no = "Cancel", danger, onYes, onClose, children,
}: { open: boolean; title: string; text?: string; yes: string; no?: string; danger?: boolean; onYes: () => void; onClose: () => void; children?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onClose} className="m-auto w-[min(480px,calc(100vw-32px))] rounded-[24px] p-0 backdrop:bg-black/30">
      <div className="flex flex-col gap-4 p-6 sm:p-8">
        <h2 id={titleId} className="text-[22px] font-bold">
          {title}
        </h2>
        {text && <p className="text-[15px] leading-relaxed text-muted">{text}</p>}
        {children}
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <button type="button" className={btn.secondary} onClick={onClose}>
            {no}
          </button>
          <button type="button" className={danger ? btn.danger : btn.primary} onClick={onYes}>
            {yes}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-muted hover:text-ink">
      <span aria-hidden="true">←</span> {children}
    </Link>
  );
}

export function PageTitle({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 pb-10 pt-10 sm:flex-row sm:items-end sm:justify-between sm:pt-14">
      <div>
        <h1 className="text-[30px] font-bold leading-tight tracking-tight sm:text-[36px]">{title}</h1>
        {sub && <p className="mt-2 text-[17px] text-muted">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-3">{children}</div>}
    </section>
  );
}
