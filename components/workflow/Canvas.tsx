"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WfStep, WfStepRun, WfStepState } from "@/lib/types";
import { STEP_INFO, stepIconOf, hasFailPath, stepSubtitle, stepTitle, type AgentRef } from "@/lib/wf";
import { Icon } from "../ui";
import { plainText } from "@/lib/words";

// The step row. Tiles snap into a left-to-right row (top-to-bottom on a phone); the app draws the lines.

export type LiveInfo = { stepRuns: Record<string, WfStepRun>; current: number; nowText: Record<string, string> } | null;

type Props = {
  steps: WfStep[];
  agents: AgentRef[];
  selected: string | null;
  onSelect: (id: string) => void;
  onInsert: (index: number) => void; // insert before this index (steps.length = at the end)
  onMove: (from: number, to: number) => void;
  live: LiveInfo;
};

export function stepColor(s: WfStep, agents: AgentRef[]) {
  if (s.type === "agent" && s.agentId != null) return agents.find((a) => a.id === s.agentId)?.color ?? STEP_INFO.agent.color;
  return STEP_INFO[s.type].color;
}

export function stepIcon(s: WfStep, agents: AgentRef[]) {
  if (s.type === "agent" && s.agentId != null) return agents.find((a) => a.id === s.agentId)?.icon ?? "sparkle";
  return stepIconOf(s);
}

const STATE_WORD: Record<WfStepState, string> = {
  todo: "Waiting",
  now: "Doing it now",
  done: "Done",
  passed: "Passed",
  needs_work: "Needs work",
  failed: "Stopped here",
  skipped: "Skipped",
  waiting: "Waiting for you",
};

function useVertical() {
  const [v, setV] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setV(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return v;
}

type Rect = { x: number; y: number; w: number; h: number };

export default function Canvas({ steps, agents, selected, onSelect, onInsert, onMove, live }: Props) {
  const vertical = useVertical();
  const inner = useRef<HTMLDivElement>(null);
  const tileRefs = useRef(new Map<string, HTMLDivElement>());
  const [rects, setRects] = useState<Record<string, Rect>>({});
  const [drag, setDrag] = useState<null | { id: string; order: string[] }>(null);
  const dragStart = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);

  const order = drag ? drag.order.map((id) => steps.find((s) => s.id === id)!).filter(Boolean) : steps;

  const measure = useCallback(() => {
    const box = inner.current?.getBoundingClientRect();
    if (!box) return;
    const next: Record<string, Rect> = {};
    tileRefs.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      next[id] = { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
    });
    setRects(next);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, order.length, vertical, steps, drag]);
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [measure]);

  // Dragging by the grip. Pointer events work for mouse and touch alike.
  function onGripDown(e: React.PointerEvent, id: string) {
    if (live) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = { id, x: e.clientX, y: e.clientY, moved: false };
  }
  function onGripMove(e: React.PointerEvent) {
    const st = dragStart.current;
    if (!st) return;
    if (!st.moved && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 6) return;
    st.moved = true;
    const box = inner.current!.getBoundingClientRect();
    const p = vertical ? e.clientY - box.top : e.clientX - box.left;
    const base = (drag?.order ?? steps.map((s) => s.id)).filter((id) => id !== st.id);
    let idx = base.length;
    for (let i = 1; i < base.length; i++) {
      const r = rects[base[i]];
      if (!r) continue;
      const mid = vertical ? r.y + r.h / 2 : r.x + r.w / 2;
      if (p < mid) {
        idx = i;
        break;
      }
    }
    idx = Math.max(1, idx);
    const next = [...base.slice(0, idx), st.id, ...base.slice(idx)];
    if (!drag || next.join() !== drag.order.join()) setDrag({ id: st.id, order: next });
  }
  function onGripUp() {
    const st = dragStart.current;
    dragStart.current = null;
    if (!st) return;
    if (st.moved && drag) {
      const from = steps.findIndex((s) => s.id === st.id);
      const to = drag.order.indexOf(st.id);
      setDrag(null);
      if (from !== to) onMove(from, to);
    } else {
      setDrag(null);
      onSelect(st.id);
    }
  }
  function onGripKey(e: React.KeyboardEvent, index: number) {
    const back = vertical ? "ArrowUp" : "ArrowLeft";
    const fwd = vertical ? "ArrowDown" : "ArrowRight";
    if (e.key === back && index > 1) {
      e.preventDefault();
      onMove(index, index - 1);
    } else if (e.key === fwd && index < steps.length - 1) {
      e.preventDefault();
      onMove(index, index + 1);
    }
  }

  // "Needs work" lines.
  const fails = order
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => hasFailPath(s))
    .map(({ s, i }, level) => ({ s, i, level, target: s.onFail && s.onFail !== "stop" ? s.onFail : null }));
  const extra = fails.length ? 56 + fails.length * 30 : 24;

  const scroller = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el || vertical) return setMore(false);
    const check = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
    check();
    el.addEventListener("scroll", check);
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [vertical, rects]);

  return (
    <div className="relative">
    {more && (
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-20 items-center justify-end bg-gradient-to-l from-[#FAFAFB] to-transparent pr-1" aria-hidden="true">
        <span className="rounded-full bg-white px-2 py-1 text-[18px] text-[#4A4F57] shadow">→</span>
      </div>
    )}
    <div ref={scroller} className={vertical ? "" : "overflow-x-auto pb-2"} role="region" aria-label="Workflow steps" tabIndex={vertical ? undefined : 0}>
      <div
        ref={inner}
        className={`relative ${vertical ? "flex flex-col items-start pl-2" : "flex w-max items-center px-2 pt-6"}`}
        style={vertical ? { paddingRight: extra } : { paddingBottom: extra }}
      >
        <ol className={vertical ? "flex flex-col items-start" : "flex items-center"}>
          {order.map((s, i) => {
            const sr = live?.stepRuns[s.id];
            const state: WfStepState | null = live ? sr?.state ?? "todo" : null;
            const color = stepColor(s, agents);
            const title = stepTitle(s, agents);
            const isNow = state === "now" || state === "waiting";
            const faded = live && (state === "todo" || state === "skipped");
            const subtitle = live && isNow ? plainText(live.nowText[s.id] ?? sr?.note ?? "") : live && sr?.note && state !== "todo" ? plainText(sr.note) : stepSubtitle(s, order, agents);
            return (
              <li key={s.id} className={vertical ? "flex flex-col items-start" : "flex items-center"}>
                {i > 0 && <Connector vertical={vertical} label={hasFailPath(order[i - 1]) ? "passed" : null} onAdd={live ? null : () => onInsert(i)} />}
                <div
                  ref={(el) => {
                    if (el) tileRefs.current.set(s.id, el);
                    else tileRefs.current.delete(s.id);
                  }}
                  className={`relative h-40 w-40 shrink-0 ${drag?.id === s.id ? "z-10 scale-[1.04]" : ""} transition-transform`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    aria-pressed={selected === s.id}
                    aria-label={`Step ${i + 1}: ${title}. ${subtitle}${state ? `. ${STATE_WORD[state]}` : ""}`}
                    className={`relative flex h-full w-full flex-col overflow-hidden rounded-[40px] border bg-white p-4 pt-5 text-left transition-[box-shadow,opacity] ${
                      selected === s.id ? "border-ink ring-2 ring-ink" : "border-[rgba(21,23,27,0.28)]"
                    } ${faded ? "opacity-50" : ""} ${isNow ? "glow" : ""}`}
                    style={{
                      boxShadow: isNow ? `0 0 0 4px ${color}33, 0 10px 30px ${color}33` : drag?.id === s.id ? "0 16px 40px rgba(21,23,27,0.18)" : "0 1px 2px rgba(21,23,27,0.04), 0 10px 30px rgba(21,23,27,0.05)",
                      ["--glow" as string]: `${color}55`,
                    }}
                  >
                    <span className="absolute inset-x-0 top-0 h-[6px]" style={{ background: color, opacity: 0.55 }} aria-hidden="true" />
                    <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                      <span className="absolute inset-0 rounded-full" style={{ background: color, opacity: 0.1 }} />
                      <span className="relative">
                        <Icon name={stepIcon(s, agents)} color={color} size={18} />
                      </span>
                    </span>
                    <span className="mt-2 truncate text-[15px] font-semibold leading-tight">{title}</span>
                    <span className="clamp-3 mt-0.5 text-[12.5px] leading-snug text-muted">{subtitle}</span>
                    {state && state !== "todo" && <StateBadge state={state} />}
                  </button>
                  {!live && i > 0 && (
                    <button
                      type="button"
                      className="absolute right-2 top-3 flex h-11 w-9 cursor-grab touch-none items-center justify-center rounded-[12px] text-[#80868F] hover:bg-soft hover:text-ink active:cursor-grabbing"
                      aria-label={`Move ${title}. Drag it, or use the arrow keys.`}
                      onPointerDown={(e) => onGripDown(e, s.id)}
                      onPointerMove={onGripMove}
                      onPointerUp={onGripUp}
                      onPointerCancel={() => {
                        dragStart.current = null;
                        setDrag(null);
                      }}
                      onKeyDown={(e) => onGripKey(e, i)}
                    >
                      <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true" fill="currentColor">
                        {[3, 9, 15].map((y) => (
                          <g key={y}>
                            <circle cx="4" cy={y} r="1.6" />
                            <circle cx="10" cy={y} r="1.6" />
                          </g>
                        ))}
                      </svg>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
          {!live && (
            <li className={vertical ? "flex flex-col items-start" : "flex items-center"}>
              <Connector vertical={vertical} label={null} onAdd={() => onInsert(steps.length)} end />
            </li>
          )}
        </ol>

        {/* Lines that loop back. Drawn over the row, measured from the real tiles. */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          <defs>
            <marker id="arrow-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10z" fill="#B45309" />
            </marker>
          </defs>
          {fails.map(({ s, level, target }) => {
            const a = rects[s.id];
            const b = target ? rects[target] : null;
            if (!a) return null;
            const d = 40 + level * 30;
            if (!b) {
              // "Stop and tell me": a short line to a small end label.
              if (vertical) {
                const x1 = a.x + a.w, y1 = a.y + a.h / 2;
                return <path key={s.id} d={`M${x1} ${y1} h${d - 16}`} stroke="#B45309" strokeWidth="2" fill="none" strokeDasharray="5 4" markerEnd="url(#arrow-amber)" />;
              }
              const x1 = a.x + a.w / 2, y1 = a.y + a.h;
              return <path key={s.id} d={`M${x1} ${y1} v${d - 12}`} stroke="#B45309" strokeWidth="2" fill="none" strokeDasharray="5 4" markerEnd="url(#arrow-amber)" />;
            }
            if (vertical) {
              const x = a.x + a.w, y1 = a.y + a.h / 2, y2 = b.y + b.h / 2;
              return <path key={s.id} d={`M${x} ${y1} C${x + d * 1.4} ${y1}, ${x + d * 1.4} ${y2}, ${x + 4} ${y2}`} stroke="#B45309" strokeWidth="2" fill="none" strokeDasharray="5 4" markerEnd="url(#arrow-amber)" />;
            }
            const x1 = a.x + a.w / 2, x2 = b.x + b.w / 2, y = a.y + a.h;
            return <path key={s.id} d={`M${x1} ${y} C${x1} ${y + d * 1.3}, ${x2} ${y + d * 1.3}, ${x2} ${y + 4}`} stroke="#B45309" strokeWidth="2" fill="none" strokeDasharray="5 4" markerEnd="url(#arrow-amber)" />;
          })}
        </svg>
        {fails.map(({ s, level, target }) => {
          const a = rects[s.id];
          const b = target ? rects[target] : null;
          if (!a) return null;
          const d = 40 + level * 30;
          const text = b ? "needs work" : "needs work: stop and tell me";
          const style: React.CSSProperties = vertical
            ? b
              ? { left: a.x + a.w + d * 0.9, top: (a.y + b.y + b.h) / 2, transform: "translate(-50%,-50%) rotate(-90deg)" }
              : { left: a.x + a.w + d - 8, top: a.y + a.h / 2 + 10, transform: "translateX(-60%)" }
            : b
              ? { left: (a.x + a.w / 2 + b.x + b.w / 2) / 2, top: a.y + a.h + d * 0.98, transform: "translate(-50%,-50%)" }
              : { left: a.x + a.w / 2, top: a.y + a.h + d, transform: "translateX(-50%)" };
          return (
            <span key={s.id} className="pointer-events-none absolute whitespace-nowrap rounded-full bg-[#FDF0DC] px-2.5 py-0.5 text-[12px] font-semibold text-[#8A4600]" style={style}>
              {text}
            </span>
          );
        })}
      </div>
    </div>
    </div>
  );
}

function StateBadge({ state }: { state: WfStepState }) {
  const map: Partial<Record<WfStepState, { t: string; bg: string; fg: string }>> = {
    done: { t: "✓", bg: "#E6F4EA", fg: "#1E6B34" },
    passed: { t: "✓", bg: "#E6F4EA", fg: "#1E6B34" },
    needs_work: { t: "↺", bg: "#FDF0DC", fg: "#8A4600" },
    failed: { t: "!", bg: "#FDE8E6", fg: "#A11B12" },
    skipped: { t: "–", bg: "#EEF0F3", fg: "#4A4F57" },
    now: { t: "●", bg: "#EEF1FD", fg: "#2A3F9E" },
    waiting: { t: "?", bg: "#FDF0DC", fg: "#8A4600" },
  };
  const m = map[state];
  if (!m) return null;
  return (
    <span className={`absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-bold ${state === "now" ? "pulse" : ""}`} style={{ background: m.bg, color: m.fg }} aria-hidden="true">
      {m.t}
    </span>
  );
}

function Connector({ vertical, label, onAdd, end }: { vertical: boolean; label: string | null; onAdd: (() => void) | null; end?: boolean }) {
  const len = vertical ? 64 : 76;
  return (
    <div className={`relative flex shrink-0 items-center justify-center ${vertical ? "ml-[58px] w-11 flex-col" : "h-11"}`} style={vertical ? { height: len } : { width: len }}>
      {!end && (
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          {vertical ? (
            <>
              <line x1="22" y1="0" x2="22" y2={len - 6} stroke="#80868F" strokeWidth="2" />
              <path d={`M16 ${len - 9} 22 ${len - 1} 28 ${len - 9}`} fill="none" stroke="#80868F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </>
          ) : (
            <>
              <line x1="0" y1="22" x2={len - 6} y2="22" stroke="#80868F" strokeWidth="2" />
              <path d={`M${len - 9} 16 ${len - 1} 22 ${len - 9} 28`} fill="none" stroke="#80868F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
        </svg>
      )}
      {label && (
        <span className={`absolute whitespace-nowrap text-[12px] font-semibold text-[#1E6B34] ${vertical ? "left-12 top-1" : "-top-4 left-1/2 -translate-x-1/2"}`}>{label}</span>
      )}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          aria-label={end ? "Add a step at the end" : "Add a step here"}
          className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[#C9CDD4] bg-white text-[22px] font-medium leading-none text-[#4A4F57] shadow-sm hover:border-ink hover:text-ink"
        >
          <span aria-hidden="true">+</span>
        </button>
      )}
    </div>
  );
}
