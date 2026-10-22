"use client";
import { openTaskPanel } from "./TaskPanel";

// "New task" as a link-looking button inside text (the Help page).
export default function StartTaskLink({ label = "New task" }: { label?: string }) {
  return (
    <button type="button" onClick={() => openTaskPanel()} className="inline-flex min-h-11 items-center px-0.5 font-semibold underline">
      {label}
    </button>
  );
}
