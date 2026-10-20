"use client";
import { useEffect, useSyncExternalStore } from "react";
import type { HelperContext } from "@/lib/helperTypes";

// What's on screen right now, for the Helper. Pages add what's selected or open;
// error boxes add their message (which also puts a dot on the bubble).

type Extra = Omit<HelperContext, "path" | "errors" | "title">;

let extra: Extra = {};
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

export function helperExtra(): Extra {
  return extra;
}

// A page says what's selected or open. Cleared when the page goes away.
export function useHelperContext(ctx: Extra) {
  const key = JSON.stringify(ctx);
  useEffect(() => {
    extra = JSON.parse(key) as Extra;
    changed();
    return () => {
      extra = {};
      changed();
    };
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
