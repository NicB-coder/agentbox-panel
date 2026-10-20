"use client";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { InfoTip } from "./bits";
import { field } from "./ui";

const ADD = "__add__";

// The project dropdown, with "Add a project…" at the end (opens the Projects page).
export default function ProjectSelect({ value, onChange, projects, tip, label = "Project" }: { value: string; onChange: (v: string) => void; projects: string[]; tip?: string; label?: string }) {
  const router = useRouter();
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center text-[15px] font-semibold">
        <label htmlFor={id}>{label}</label>
        {tip && <InfoTip text={tip} label={label} />}
      </span>
      <select
        id={id}
        value={projects.includes(value) ? value : ""}
        onChange={(e) => (e.target.value === ADD ? router.push("/projects") : onChange(e.target.value))}
        className={`${field} min-h-11`}
      >
        {!projects.includes(value) && <option value="">Pick a project…</option>}
        {projects.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
        <option value={ADD}>Add a project…</option>
      </select>
    </div>
  );
}
