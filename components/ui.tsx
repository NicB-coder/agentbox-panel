import type { PillStatus } from "@/lib/types";
import type { ReactNode } from "react";

// The 8 icon choices. Simple 24px line icons drawn in the agent's color.
const ICON_PATHS: Record<string, ReactNode> = {
  hammer: (
    <>
      <path d="m15 12-8.4 8.4a2.1 2.1 0 0 1-3-3L12 9" />
      <path d="M17.6 15 22 10.6M20.9 11.7l-1.6-1.6a2 2 0 0 1-.6-1.4V7.5L16.4 5.2A5.6 5.6 0 0 0 12.5 3.6H9l.9.8A6.2 6.2 0 0 1 12 9v1.8l2 2h1.2a2 2 0 0 1 1.4.6l1.6 1.6" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
    </>
  ),
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  heart: <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" />,
  bolt: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />,
  book: (
    <>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2Z" />
      <path d="M19 3v4M21 5h-4" />
    </>
  ),
};

export const ICON_CHOICES = Object.keys(ICON_PATHS);
export const ICON_NAMES: Record<string, string> = {
  hammer: "Hammer",
  eye: "Eye",
  globe: "Globe",
  moon: "Moon",
  heart: "Heart",
  bolt: "Lightning",
  book: "Book",
  sparkle: "Sparkle",
};
export const COLOR_CHOICES: { hex: string; name: string }[] = [
  { hex: "#2F4FD8", name: "Blue" },
  { hex: "#0F7B6C", name: "Teal" },
  { hex: "#C2410C", name: "Orange" },
  { hex: "#7048C8", name: "Purple" },
  { hex: "#2B8A3E", name: "Green" },
  { hex: "#BE185D", name: "Pink" },
];

export function Icon({ name, color, size = 22 }: { name: string; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name] ?? ICON_PATHS.sparkle}
    </svg>
  );
}

export function AgentIcon({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size }}>
      <span className="absolute inset-0 rounded-full" style={{ background: color, opacity: 0.1 }} />
      <span className="relative">
        <Icon name={name} color={color} size={Math.round(size * 0.5)} />
      </span>
    </span>
  );
}

const PILL: Record<PillStatus, { label: string; bg: string; fg: string }> = {
  working: { label: "Working", bg: "#EEF1FD", fg: "#2A3F9E" },
  needs: { label: "Needs you", bg: "#FDF0DC", fg: "#8A4600" },
  done: { label: "Done", bg: "#E6F4EA", fg: "#1E6B34" },
  stopped: { label: "Stopped", bg: "#FDE8E6", fg: "#A11B12" },
  scheduled: { label: "Scheduled", bg: "#EEF0F3", fg: "#4A4F57" },
  paused: { label: "Paused", bg: "#EEF0F3", fg: "#4A4F57" },
  off: { label: "Off", bg: "#EEF0F3", fg: "#4A4F57" },
  ready: { label: "Ready", bg: "#EEF0F3", fg: "#4A4F57" },
};

export function StatusPill({ status, label }: { status: PillStatus; label?: string }) {
  const p = PILL[status];
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold leading-none whitespace-nowrap" style={{ background: p.bg, color: p.fg }}>
      <span className={`h-2 w-2 rounded-full ${status === "working" ? "pulse" : ""}`} style={{ background: p.fg }} aria-hidden="true" />
      {label ?? p.label}
    </span>
  );
}

export const btn = {
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] bg-ink px-5 text-[15px] font-semibold text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed",
  secondary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] border border-[#C9CDD4] bg-white px-5 text-[15px] font-semibold text-ink hover:bg-soft disabled:opacity-50 disabled:cursor-not-allowed",
  danger:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] border border-[#F2C4BF] bg-[#FDE8E6] px-5 text-[15px] font-semibold text-[#A11B12] hover:bg-[#FBD9D5] disabled:opacity-50",
  pill: "inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 text-[15px] font-semibold text-white hover:bg-black",
};
