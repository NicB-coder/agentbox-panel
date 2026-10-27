"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { HelperContext } from "@/lib/helperTypes";

// What's on screen right now, for the Helper. Pages add what's selected or open; panels and pop-ups
// add themselves on top (a stack, so closing the Start a task panel puts back what the page said).
// Error boxes add their message (which also puts a dot on the bubble).

type Extra = Omit<HelperContext, "path" | "errors" | "title">;
type Layer = { ctx: Extra; fill?: (text: string) => void };

const layers = new Map<number, Layer>();
let nextLayer = 1;
const errors = new Map<number, string>();
let nextErr = 1;
let version = 0;
const subs = new Set<() => void>();

function changed() {
  version++;
  for (const s of subs) s();
}

function subscribe(cb: () => void) {
  subs.add(cb);
  return () => subs.delete(cb);
}

export function useHelperStoreVersion() {
  return useSyncExternalStore(subscribe, () => version, () => 0);
}

export function screenErrors(): string[] {
  return [...errors.values()];
}

// Everything the page and its open panels said, newest on top. Panels are listed in order.
export function helperExtra(): Extra {
  const out: Extra = {};
  const panels: string[] = [];
  for (const { ctx } of layers.values()) {
    const { panels: p, ...rest } = ctx;
    Object.assign(out, rest);
    if (p) panels.push(...p);
  }
  if (panels.length) out.panels = panels;
  const top = topFill();
  if (top) out.fill = top.what;
  else delete out.fill;
  return out;
}

function topFill(): { what: string; fill: (t: string) => void } | null {
  let top: { what: string; fill: (t: string) => void } | null = null;
  for (const l of layers.values()) if (l.fill && l.ctx.fill) top = { what: l.ctx.fill, fill: l.fill };
  return top;
}

// Fill the open form's goal box with the Helper's suggestion (only when Nic presses Use this).
// Returns false if no form is open to take it.
export function fillHelperForm(text: string): boolean {
  const top = topFill();
  if (!top) return false;
  top.fill(text);
  return true;
}

// A page or panel says what's selected or open. Gone again when it closes.
// `fill` lets the Helper's "Use this" put text in its goal box; `ctx.fill` names that box.
export function useHelperContext(ctx: Extra | null, fill?: (text: string) => void) {
  const key = ctx ? JSON.stringify(ctx) : "";
  const fillRef = useRef(fill);
  fillRef.current = fill;
  const id = useRef(0);
  useEffect(() => {
    const mine = nextLayer++;
    id.current = mine;
    return () => {
      if (layers.delete(mine)) changed();
    };
  }, []);
  // Updated in place, so a page that changes stays under a panel that's open on top of it.
  useEffect(() => {
    if (!key) {
      if (layers.delete(id.current)) changed();
      return;
    }
    layers.set(id.current, { ctx: JSON.parse(key) as Extra, fill: (t) => fillRef.current?.(t) });
    changed();
  }, [key]);
}

// An error box on the page tells the Helper about itself.
export function useReportError(message: string | null | undefined) {
  useEffect(() => {
    if (!message) return;
    const id = nextErr++;
    errors.set(id, message);
    changed();
    return () => {
      errors.delete(id);
      changed();
    };
  }, [message]);
}

// Ask the Helper something from anywhere (e.g. "Ask the Helper" on an error).
export function askHelper(text: string, send = true) {
  window.dispatchEvent(new CustomEvent("agentbox:helper", { detail: { text, send } }));
}
