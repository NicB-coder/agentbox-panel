"use client";
import type { WorkMode } from "@/lib/types";
import { MODE_WORDS } from "@/lib/words";
import Segmented from "./Segmented";

const ORDER: WorkMode[] = ["auto", "plan", "ask", "look"];

export default function ModePicker({ value, onChange, legend }: { value: WorkMode; onChange: (m: WorkMode) => void; legend: string }) {
  return (
    <Segmented
      legend={legend}
      value={value}
      onChange={onChange}
      options={ORDER.map((m) => ({ value: m, label: MODE_WORDS[m].label }))}
      hint={MODE_WORDS[value].hint}
    />
  );
}
