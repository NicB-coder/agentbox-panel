"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Keeps a piece of server state fresh by asking for it every few seconds.
export function usePoll<T>(url: string, initial: T, everyMs = 3000) {
  const [data, setData] = useState<T>(initial);
  const busy = useRef(false);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch {
      /* offline: keep showing the last known state */
    } finally {
      busy.current = false;
    }
  }, [url]);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, everyMs);
    return () => clearInterval(t);
  }, [refresh, everyMs]);
  return { data, refresh };
}
