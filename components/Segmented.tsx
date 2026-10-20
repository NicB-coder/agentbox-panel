"use client";
import { useId } from "react";

// A segmented choice built on real radio buttons, so it works with a keyboard and screen readers.
export default function Segmented<T extends string>({
  legend,
  value,
  onChange,
  options,
  hint,
}: {
  legend: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  hint?: string;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[15px] font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-1 rounded-[16px] bg-soft p-1">
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-[12px] px-3 text-center text-[14px] font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[#2f4fd8] ${
              value === o.value ? "bg-white text-ink shadow-[0_1px_3px_rgba(21,23,27,0.12)]" : "text-muted hover:text-ink"
            }`}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
      {hint && <p className="text-[14px] text-muted">{hint}</p>}
    </fieldset>
  );
}
