"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { HeaderState, UsageView } from "@/lib/types";
import { clockOf } from "@/lib/words";
import { Confirm, post } from "./bits";
import NewTaskButton, { openNewTask } from "./NewTaskButton";
import OnlineDot from "./OnlineDot";
import Tour from "./Tour";
import { Icon, btn } from "./ui";
import type { WorkMode } from "@/lib/types";

type AgentPick = { id: number; name: string; mode: WorkMode };

// Everyone shares this, so the badge, meter and pause button stay in step across pages.
export function useHeaderState(initial: HeaderState) {
  const [data, setData] = useState(initial);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/header", { cache: "no-store" });
        if (r.ok && alive) setData(await r.json());
      } catch {
        /* keep last */
      }
    };
    const t = setInterval(load, 5000);
    const now = () => load();
    window.addEventListener("agentbox:refresh", now);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("agentbox:refresh", now);
    };
  }, []);
  return data;
}

export function refreshHeader() {
  window.dispatchEvent(new Event("agentbox:refresh"));
}

const NAV = [
  { href: "/", label: "Agents", icon: "sparkle", match: (p: string) => p === "/" || p.startsWith("/agents") },
  { href: "/workflows", label: "Workflows", icon: "flow", match: (p: string) => p.startsWith("/workflows") },
  { href: "/inbox", label: "Inbox", icon: "inbox", match: (p: string) => p.startsWith("/inbox") },
];

export default function Header({ initial, agents }: { initial: HeaderState; agents: AgentPick[] }) {
  const data = useHeaderState(initial);
  const path = usePathname() ?? "/";
  const [confirm, setConfirm] = useState(false);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);

  async function togglePause() {
    setBusy(true);
    try {
      await post("/api/pause-all", { paused: !data.pausedAll });
    } finally {
      setBusy(false);
      setConfirm(false);
      refreshHeader();
      window.dispatchEvent(new Event("agentbox:changed"));
    }
  }

  const badge = (n: number) =>
    n > 0 ? (
      <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C8281C] px-1.5 text-[12px] font-bold leading-none text-white">
        {n}
        <span className="sr-only"> {n === 1 ? "thing needs" : "things need"} you</span>
      </span>
    ) : null;

  return (
    <>
      <header className="sticky top-0 z-30 h-16 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-full max-w-[1112px] items-center gap-3 px-4">
          <div className="flex shrink-0 items-center gap-3">
            <Link href="/" className="flex min-h-11 items-center text-[20px] font-bold tracking-tight">
              agentbox
            </Link>
            <OnlineDot />
          </div>

          <nav aria-label="Main" className="ml-4 hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV.map((n) => {
                const on = n.match(path);
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      aria-current={on ? "page" : undefined}
                      className={`inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-semibold ${on ? "bg-soft text-ink" : "text-muted hover:text-ink"}`}
                    >
                      {n.label}
                      {n.href === "/inbox" && badge(data.inboxCount)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <UsageMeter u={data.usage} />
            <NewTaskButton agents={agents} buttonClassName="hidden lg:block" />
            <div className="hidden items-center gap-2 lg:flex">
              <button type="button" className={btn.secondary + " !rounded-full !px-4"} onClick={() => (data.pausedAll ? togglePause() : setConfirm(true))} disabled={busy}>
                {data.pausedAll ? "Resume everything" : "Pause everything"}
              </button>
            </div>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#C9CDD4] lg:hidden"
              aria-label="Menu"
              aria-expanded={menu}
              onClick={() => setMenu(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {data.pausedAll && (
        <div className="border-b border-[#F2D3A6] bg-[#FDF0DC]">
          <div className="mx-auto flex max-w-[1112px] flex-wrap items-center justify-between gap-3 px-4 py-2 text-[15px] font-medium text-[#8A4600]">
            <span>Everything is paused. Nothing runs, not even on a schedule, until you resume.</span>
            <button type="button" className={btn.secondary + " !min-h-11"} onClick={togglePause} disabled={busy}>
              Resume everything
            </button>
          </div>
        </div>
      )}

      {/* Phone: tabs at the bottom, everything else in the menu. */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-[560px] grid-cols-3">
          {NAV.map((n) => {
            const on = n.match(path);
            return (
              <li key={n.href}>
                <Link href={n.href} aria-current={on ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[13px] font-semibold ${on ? "text-ink" : "text-muted"}`}>
                  <span className="relative">
                    <Icon name={n.icon} color={on ? "#15171B" : "#555A63"} size={22} />
                    {n.href === "/inbox" && data.inboxCount > 0 && (
                      <span className="absolute -right-3 -top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#C8281C] px-1 text-[11px] font-bold text-white">
                        {data.inboxCount}
                      </span>
                    )}
                  </span>
                  {n.label}
                  {n.href === "/inbox" && data.inboxCount > 0 && <span className="sr-only">, {data.inboxCount} need you</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <PhoneMenu
        open={menu}
        onClose={() => setMenu(false)}
        pausedAll={data.pausedAll}
        onNewTask={() => {
          setMenu(false);
          openNewTask();
        }}
        onPause={() => {
          setMenu(false);
          if (data.pausedAll) togglePause();
          else setConfirm(true);
        }}
      />

      <Confirm
        open={confirm}
        title="Are you sure?"
        text="This stops every agent and workflow that's running right now, and holds all schedules until you press Resume everything. Work in progress is kept but not finished."
        yes="Pause everything"
        danger
        onYes={togglePause}
        onClose={() => setConfirm(false)}
      />
      <Tour done={data.tourDone} />
    </>
  );
}

function PhoneMenu({ open, onClose, onNewTask, onPause, pausedAll }: { open: boolean; onClose: () => void; onNewTask: () => void; onPause: () => void; pausedAll: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const item = "flex min-h-12 w-full items-center gap-3 rounded-[14px] px-4 text-left text-[17px] font-semibold hover:bg-soft";
  return (
    <dialog ref={ref} aria-labelledby={id} onClose={onClose} className="mb-0 mt-auto w-full max-w-none rounded-t-[24px] p-0 backdrop:bg-black/30 lg:hidden">
      <div className="flex flex-col gap-1 p-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between px-2 pb-2">
          <h2 id={id} className="text-[20px] font-bold">
            Menu
          </h2>
          <button type="button" className="min-h-11 px-3 text-[15px] font-semibold underline" onClick={onClose}>
            Close
          </button>
        </div>
        <button type="button" className={`${item} bg-ink text-white hover:bg-black`} onClick={onNewTask}>
          New task
        </button>
        <button type="button" className={item} onClick={onPause}>
          <Icon name={pausedAll ? "play" : "pause"} color="#15171B" />
          {pausedAll ? "Resume everything" : "Pause everything"}
        </button>
        <Link href="/projects" className={item} onClick={onClose}>
          <Icon name="folder" color="#15171B" /> Projects
        </Link>
        <Link href="/settings" className={item} onClick={onClose}>
          <Icon name="bolt" color="#15171B" /> Settings
        </Link>
        <Link href="/help" className={item} onClick={onClose}>
          <Icon name="book" color="#15171B" /> Help
        </Link>
      </div>
    </dialog>
  );
}

// ---------- the usage meter ----------

function until(ms: number, now: number) {
  const mins = Math.max(1, Math.ceil((ms - now) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function dayClock(ms: number) {
  const d = new Date(ms);
  const today = new Date().toDateString() === d.toDateString();
  return today ? clockOf(ms) : `${d.toLocaleDateString("en-US", { weekday: "short" })} ${clockOf(ms)}`;
}

export function usageTone(u: UsageView): "normal" | "amber" | "red" {
  if (u.state.limited) return "red";
  const p = u.state.session?.pct ?? 0;
  return p >= 95 ? "red" : p >= 75 ? "amber" : "normal";
}

const TONE = {
  normal: { bg: "#F6F7F9", fg: "#15171B", bar: "#2F4FD8", border: "#E6E8EC" },
  amber: { bg: "#FDF0DC", fg: "#8A4600", bar: "#B45309", border: "#F2D3A6" },
  red: { bg: "#FDE8E6", fg: "#A11B12", bar: "#C8281C", border: "#F2C4BF" },
};

function UsageMeter({ u }: { u: UsageView }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const wrap = useRef<HTMLDivElement>(null);
  const panelId = useId();
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);
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

  const s = u.state;
  const tone = TONE[usageTone(u)];
  const pct = s.session?.pct ?? null;
  const about = s.exact ? "" : "about ";
  let long: string;
  let short: string;
  if (s.limited) {
    long = s.limitedUntil ? `Out of usage · back in ${until(s.limitedUntil, now)}` : "Out of usage";
    short = s.limitedUntil ? `Out · ${until(s.limitedUntil, now)}` : "Out";
  } else if (pct === null) {
    long = "Claude usage · checking…";
    short = "Usage";
  } else {
    long = `Claude usage ${about}${pct}%${s.session?.resetsAt ? ` · resets ${dayClock(s.session.resetsAt)}` : ""}`;
    short = `${pct}%`;
  }

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${long}. Show usage details`}
        onClick={() => setOpen(!open)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-[14px] font-semibold whitespace-nowrap"
        style={{ background: tone.bg, color: tone.fg, borderColor: tone.border }}
      >
        <span className="relative h-1.5 w-8 overflow-hidden rounded-full bg-[#D5D9DF] sm:w-10" aria-hidden="true">
          <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${s.limited ? 100 : Math.min(100, pct ?? 0)}%`, background: tone.bar }} />
        </span>
        <span className="hidden xl:inline">{long}</span>
        <span className="xl:hidden">{short}</span>
      </button>
      {open && (
        <div id={panelId} className="fixed inset-x-3 top-[72px] z-40 rounded-[24px] border border-line bg-white p-5 shadow-[0_20px_60px_rgba(21,23,27,0.18)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px]">
          <UsagePanel u={u} now={now} />
        </div>
      )}
    </div>
  );
}

export function UsagePanel({ u, now }: { u: UsageView; now: number }) {
  const s = u.state;
  const about = s.exact ? "" : "about ";
  const tone = TONE[usageTone(u)];
  const bar = (p: number, color: string) => (
    <span className="mt-2 block h-2 overflow-hidden rounded-full bg-[#E6E8EC]" aria-hidden="true">
      <span className="block h-full rounded-full" style={{ width: `${Math.min(100, p)}%`, background: color }} />
    </span>
  );
  return (
    <div className="flex flex-col gap-4 text-[15px]">
      <h2 className="text-[18px] font-semibold">Claude usage</h2>
      {s.limited ? (
        <p className="rounded-[14px] bg-[#FDE8E6] p-3 font-semibold text-[#A11B12]">
          You're out of usage{s.limitedUntil ? ` until ${dayClock(s.limitedUntil)} (in ${until(s.limitedUntil, now)})` : ""}. New runs wait and start by themselves after that.
        </p>
      ) : u.blocked ? (
        <p className="rounded-[14px] bg-[#FDF0DC] p-3 font-semibold text-[#8A4600]">
          Usage is past {u.guardPct}%, your limit in Settings. New runs wait until it resets.
        </p>
      ) : null}
      {u.queued > 0 && (
        <p className="text-muted">
          {u.queued} {u.queued === 1 ? "run is" : "runs are"} waiting to start.
        </p>
      )}
      <div>
        <p className="font-semibold">
          This session: {s.session ? `${about}${s.session.pct}% used` : "not checked yet"}
        </p>
        {s.session && bar(s.session.pct, tone.bar)}
        {s.session?.resetsAt && <p className="mt-1 text-[14px] text-muted">Resets at {dayClock(s.session.resetsAt)} (in {until(s.session.resetsAt, now)})</p>}
      </div>
      <div>
        <p className="font-semibold">This week: {s.week ? `${about}${s.week.pct}% used` : "not checked yet"}</p>
        {s.week && bar(s.week.pct, "#7048C8")}
        {s.week?.resetsAt && <p className="mt-1 text-[14px] text-muted">Resets {dayClock(s.week.resetsAt)}</p>}
      </div>
      <Breakdown title="Today, by agent" items={u.byAgent} empty="No agent runs yet today." />
      <Breakdown title="Today, by workflow" items={u.byWorkflow} empty="No workflow runs yet today." />
      <p className="text-[13px] leading-snug text-muted">
        {s.exact ? "Numbers come from Claude Code's own usage check" : "These numbers are an estimate"}
        {s.updatedAt ? `, updated ${Math.max(0, Math.round((now - s.updatedAt) / 60000))} min ago` : ""}. They include everything on your Claude account, not only agentbox.
      </p>
      <Link href="/settings" className="text-[14px] font-semibold underline">
        {u.guardPct ? `New runs wait when usage passes ${u.guardPct}%. Change this` : "Make new runs wait when usage gets high"}
      </Link>
    </div>
  );
}

function Breakdown({ title, items, empty }: { title: string; items: UsageView["byAgent"]; empty: string }) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-[14px] text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {items.map((i) => (
            <li key={i.name} className="text-[14px]">
              <span className="flex justify-between gap-2">
                <span className="truncate">{i.name}</span>
                <span className="shrink-0 text-muted">
                  {i.share}% · {i.runs} {i.runs === 1 ? i.unit?.[0] ?? "run" : i.unit?.[1] ?? "runs"}
                </span>
              </span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#E6E8EC]" aria-hidden="true">
                <span className="block h-full rounded-full" style={{ width: `${Math.max(3, i.share)}%`, background: i.color }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
