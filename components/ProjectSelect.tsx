"use client";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { InfoTip } from "./bits";
import { field } from "./ui";

const ADD = "__add__";

// The project dropdown, with "Start a new project…" at the end (opens the Projects page).

// Where a new task or workflow goes when Nic hasn't picked: the project he used last, else the first one
// that isn't the panel itself (a beginner's "make a game" should never land inside agentbox).
export function defaultProjectOf(projects: string[]): string {
  let last = "";
  try {
    last = localStorage.getItem("agentbox:last-project") ?? "";
  } catch {
    /* private mode */
  }
  if (last && projects.includes(last)) return last;
  return projects.find((p) => p !== "agentbox-panel") ?? projects[0] ?? "";
}

export function rememberProject(p: string) {
  try {
    if (p) localStorage.setItem("agentbox:last-project", p);
  } catch {
    /* private mode */
  }
}
export default function ProjectSelect({
  value, onChange, projects, tip, label = "Project", optional,
}: { value: string; onChange: (v: string) => void; projects: string[]; tip?: string; label?: string; optional?: boolean }) {
  const router = useRouter();
  const id = useId();
  const known = projects.includes(value) || (optional && value === "");
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center text-[15px] font-semibold">
        <label htmlFor={id}>{label}</label>
        {tip && <InfoTip text={tip} label={label} />}
      </span>
      <select
        id={id}
        value={known ? value : "__pick__"}
        onChange={(e) => {
          if (e.target.value !== ADD) return onChange(e.target.value === "__pick__" ? "" : e.target.value);
          document.querySelectorAll("dialog[open]").forEach((d) => (d as HTMLDialogElement).close());
          router.push("/projects");
        }}
        className={`${field} min-h-11`}
      >
        {!known && <option value="__pick__">Pick a project…</option>}
        {optional && <option value="">No project</option>}
        {projects.map((p) => (
          <option key={p} value={p}>
            {p === "agentbox-panel" ? "agentbox-panel (this app itself)" : p}
          </option>
        ))}
        <option value={ADD}>Start a new project…</option>
      </select>
    </div>
  );
}
