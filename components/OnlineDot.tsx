"use client";
import { useEffect, useState } from "react";

// Green when the panel's server answers, gray when it doesn't.
export default function OnlineDot() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const r = await fetch("/api/ping", { cache: "no-store" });
        if (alive) setOnline(r.ok);
      } catch {
        if (alive) setOnline(false);
      }
    };
    const t = setInterval(check, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted" role="status">
      <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-online" : "bg-[#9AA0A8]"}`} aria-hidden="true" />
      <span className="max-sm:sr-only">{online ? "Online" : "Offline"}</span>
    </span>
  );
}
