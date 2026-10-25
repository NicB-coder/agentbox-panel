"use client";
import { useEffect, useState, type CSSProperties } from "react";

// Where the Helper bubble sits. Normally the bottom-right corner (CSS does that). When a pop-up is
// open, the bubble moves inside it (see HelperBubble) and picks a spot that doesn't cover any of the
// pop-up's buttons or boxes. Side panels and bottom sheets that mark themselves `data-helper-avoid`
// (a workflow step's settings) are stepped around: the bubble sits beside or above them.

const SIZE = 56;
const MARGIN = 8; // breathing room around the bubble
const INTERACTIVE = "button, a[href], input, select, textarea, summary, label, [role=button], [role=radio], [role=switch], [role=tab], [tabindex]:not([tabindex='-1'])";

type Spot = { host: HTMLElement | null; bubble?: { left: number; top: number }; panel?: CSSProperties };

// The pop-up open on top, if any. A modal <dialog> makes everything outside it unclickable.
export function topModal(): HTMLDialogElement | null {
  const open = [...document.querySelectorAll("dialog")].filter((d) => {
    if (!d.open || d.closest("[data-helper-root]")) return false;
    try {
      return d.matches(":modal");
    } catch {
      return true;
    }
  });
  return open.at(-1) ?? null;
}

const shown = (r: DOMRect) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
const hits = (r: DOMRect, x: number, y: number) => r.left < x + SIZE + MARGIN && r.right > x - MARGIN && r.top < y + SIZE + MARGIN && r.bottom > y - MARGIN;

export function computeSpot(open: boolean): Spot {
  const host = topModal();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const phone = vw < 1024;
  const avoid = [...document.querySelectorAll<HTMLElement>("[data-helper-avoid]")]
    .filter((el) => !el.closest("[data-helper-root]") && (!host || host.contains(el)))
    .map((el) => el.getBoundingClientRect())
    .filter(shown);
  if (!host && !avoid.length) return { host: null };

  const blockers: DOMRect[] = [...avoid];
  if (host)
    for (const el of host.querySelectorAll<HTMLElement>(INTERACTIVE)) {
      if (el.closest("[data-helper-root]")) continue;
      const r = el.getBoundingClientRect();
      if (!shown(r)) continue;
      // Hidden behind something (e.g. scrolled under the pop-up's bottom bar): nothing to cover there.
      const x = Math.min(Math.max(r.left + r.width / 2, 0), vw - 1);
      const y = Math.min(Math.max(r.top + r.height / 2, 0), vh - 1);
      const top = document.elementFromPoint(x, y);
      if (top && !el.contains(top) && !top.contains(el) && !top.closest("[data-helper-root]")) continue;
      blockers.push(r);
    }

  const right0 = phone ? 16 : 24;
  const bottom0 = host ? 16 : phone ? 72 : 24;
  // The corner first, then beside side panels, then anywhere along the row (a crowded pop-up on a phone).
  const across: number[] = [];
  for (let x = vw - right0 - SIZE - 64; x > 16; x -= 64) across.push(x);
  const xs = [vw - right0 - SIZE, ...avoid.map((r) => r.left - 12 - SIZE).filter((x) => x >= MARGIN), 16, ...across];
  let bubble: Spot["bubble"];
  for (let y = vh - bottom0 - SIZE; y >= 72 && !bubble; y -= 60) {
    for (const x of xs)
      if (!blockers.some((r) => hits(r, x, y))) {
        bubble = { left: Math.round(x), top: Math.round(y) };
        break;
      }
  }
  bubble ??= { left: vw - right0 - SIZE, top: vh - bottom0 - SIZE };

  // On a laptop the chat opens just above the bubble, lined up with it.
  let panel: CSSProperties | undefined;
  if (open && !phone) {
    const width = Math.min(380, vw - 16);
    const right = Math.min(Math.max(MARGIN, vw - (bubble.left + SIZE)), vw - width - MARGIN);
    const bottom = vh - bubble.top + 16;
    const height = Math.min(640, vh - bottom - 16);
    panel = height >= 320 ? { right, bottom, height, left: "auto", top: "auto" } : { right, top: 16, bottom: 16, height: "auto", left: "auto" };
  }
  return { host, bubble, panel };
}

export function useHelperSpot(open: boolean): { host: HTMLElement | null; bubbleStyle?: CSSProperties; panelStyle?: CSSProperties } {
  const [spot, setSpot] = useState<Spot>({ host: null });
  useEffect(() => {
    let last = "";
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = computeSpot(open);
        const key = JSON.stringify({ ...next, host: next.host ? [...document.querySelectorAll("dialog")].indexOf(next.host as HTMLDialogElement) : -1 });
        if (key !== last) {
          last = key;
          setSpot(next);
        }
      });
    };
    update();
    // Pop-ups opening and closing, panels appearing, the window changing size.
    const mine = (n: Node) => !!(n instanceof Element ? n : n.parentElement)?.closest("[data-helper-root]");
    const mo = new MutationObserver((records) => {
      // The chat's own typing doesn't move anything else.
      if (records.every((r) => mine(r.target))) return;
      update();
    });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open", "data-helper-avoid", "class", "style"] });
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    const t = setInterval(update, 1000);
    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
      clearInterval(t);
    };
  }, [open]);
  return {
    host: spot.host,
    bubbleStyle: spot.bubble ? { left: spot.bubble.left, top: spot.bubble.top, right: "auto", bottom: "auto" } : undefined,
    panelStyle: spot.panel,
  };
}
