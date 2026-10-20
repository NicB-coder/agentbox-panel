import type { PillStatus } from "@/lib/types";
import type { ReactNode } from "react";
import { COLOR_CHOICES, ICON_CHOICES } from "@/lib/choices";

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

// Icons for workflow steps and the app itself (not offered as agent icons).
const EXTRA_PATHS: Record<string, ReactNode> = {
  play: <path d="M7 4.5v15l12-7.5-12-7.5Z" />,
  check: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m8 12.5 2.6 2.6L16.5 9" />
    </>
  ),
  hand: (
    <>
      <path d="M18 11V6.5a1.5 1.5 0 0 0-3 0V11M15 10.5V4.5a1.5 1.5 0 0 0-3 0v6M12 10V5.5a1.5 1.5 0 0 0-3 0V14" />
      <path d="M18 8.5a1.5 1.5 0 0 1 3 0V14a8 8 0 0 1-8 8h-1a7 7 0 0 1-5.6-2.8L3.2 15a1.6 1.6 0 0 1 2.5-2L9 16" />
    </>
  ),
  rocket: (
    <>
      <path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1Z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2Z" />
      <path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
    </>
  ),
  flow: (
    <>
      <rect x="2.5" y="3" width="7" height="7" rx="2" />
      <rect x="14.5" y="14" width="7" height="7" rx="2" />
      <path d="M6 10v3a3 3 0 0 0 3 3h5.5" />
      <path d="m12 13.5 2.5 2.5-2.5 2.5" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
  bulb: (
    <>
      <path d="M9 18h6M10 21.5h4" />
      <path d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.5.4.8 1 .8 1.7v.5h6V16c0-.7.3-1.3.8-1.7A6.5 6.5 0 0 0 12 2.5Z" />
    </>
  ),
  inbox: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1Z" />
    </>
  ),
  pause: (
    <>
      <rect x="6" y="4.5" width="4" height="15" rx="1" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" />
    </>
  ),
};

export { COLOR_CHOICES, ICON_CHOICES };
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

export function Icon({ name, color, size = 22 }: { name: string; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name] ?? EXTRA_PATHS[name] ?? ICON_PATHS.sparkle}
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

const PILL: Record<PillStatus, { label: string; bg: string; fg: string; dot?: string }> = {
  working: { label: "Working", bg: "#EEF1FD", fg: "#2A3F9E" },
  needs: { label: "Needs you", bg: "#FDF0DC", fg: "#8A4600" },
  done: { label: "Done", bg: "#E6F4EA", fg: "#1E6B34" },
  stopped: { label: "Stopped", bg: "#FDE8E6", fg: "#A11B12" },
  scheduled: { label: "Scheduled", bg: "#EEF0F3", fg: "#4A4F57" },
  paused: { label: "Paused", bg: "#EEF0F3", fg: "#4A4F57" },
  off: { label: "Off", bg: "#EEF0F3", fg: "#4A4F57" },
  ready: { label: "Ready", bg: "#EEF0F3", fg: "#4A4F57" },
  queued: { label: "Waiting", bg: "#EEF0F3", fg: "#4A4F57" },
  running: { label: "Running", bg: "#EEF1FD", fg: "#2A3F9E" },
  on: { label: "On", bg: "#EEF0F3", fg: "#4A4F57", dot: "#1F9D55" },
};

export const PILL_LABEL = Object.fromEntries(Object.entries(PILL).map(([k, v]) => [k, v.label])) as Record<PillStatus, string>;

export function StatusPill({ status, label }: { status: PillStatus; label?: string }) {
  const p = PILL[status];
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold leading-none whitespace-nowrap" style={{ background: p.bg, color: p.fg }}>
      <span className={`h-2 w-2 rounded-full ${status === "working" || status === "running" ? "pulse" : ""}`} style={{ background: p.dot ?? p.fg }} aria-hidden="true" />
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
  link: "inline-flex min-h-11 items-center px-1 text-[15px] font-semibold text-ink underline underline-offset-2 hover:text-black",
};

export const field = "rounded-[14px] border border-[#C9CDD4] bg-white px-3 text-[15px]";
