"use client";
import { useEffect, useId, useState } from "react";
import type { Freedom, Model, NotifyOn, ScheduleKind } from "@/lib/types";
import { FREEDOM_ORDER, FREEDOM_WORDS } from "@/lib/job";
import { DAY_NAMES, DAY_SHORT, NOTIFY_WORDS, SCHEDULE_WORDS, dayAt, nextRunAfter } from "@/lib/words";
import { InfoTip, Label } from "./bits";
import Segmented from "./Segmented";
import { field } from "./ui";

// The shared controls of the "Start a task" panel, the job settings and workflow steps.
// Short labels only; every explanation lives in an ⓘ bubble.

export const FREEDOM_TIP = "How much it may do on its own. Look only: it reads and reports, never changes anything. Check with me first: it shows you a short plan and waits for your OK. On its own: it works by itself and you get the result as a pull request to look at.";
export const CAREFUL_TIP = "Careful: after it builds, a second AI (a different model) reviews the work, it fixes what's found (up to 2 rounds), polishes it, and it's checked once more before it reaches your Inbox. Quick: just does it. Good for tiny tasks.";

export function FreedomPicker({ value, onChange, legend = "Freedom", tip = FREEDOM_TIP }: { value: Freedom; onChange: (v: Freedom) => void; legend?: string; tip?: string }) {
  return <Segmented<Freedom> legend={legend} tip={tip} value={value} onChange={onChange} options={FREEDOM_ORDER.map((f) => ({ value: f, label: FREEDOM_WORDS[f].label }))} />;
}

export function CarefulPicker({ value, onChange, tip = CAREFUL_TIP }: { value: boolean; onChange: (v: boolean) => void; tip?: string }) {
  return (
    <Segmented<"careful" | "quick">
      legend="How thorough?"
      tip={tip}
      value={value ? "careful" : "quick"}
      onChange={(v) => onChange(v === "careful")}
      options={[
        { value: "careful", label: "Careful" },
        { value: "quick", label: "Quick" },
      ]}
    />
  );
}

export function ModelPicker({ value, onChange }: { value: Model; onChange: (v: Model) => void }) {
  return (
    <Segmented<Model>
      legend="Model"
      tip="Fast (Sonnet) is good for most jobs. Smartest (Opus) thinks harder but takes longer and uses more of your Claude usage."
      value={value}
      onChange={onChange}
      options={[
        { value: "sonnet", label: "Fast" },
        { value: "opus", label: "Smartest" },
      ]}
    />
  );
}

export function MinutesSlider({ value, onChange, min = 5, max = 180, label = "Time limit", tip = "The longest one run may take. It's a safety cap: if it runs out, you can press Keep going. Waiting for you or for usage doesn't count.", off }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label?: string; tip?: string; off?: string }) {
  const words = value >= 60 ? `${Math.floor(value / 60)} h${value % 60 ? ` ${value % 60} min` : ""}` : `${value} min`;
  return <Slider value={value} onChange={onChange} min={min} max={max} label={label} tip={tip} words={off ? "Doesn't apply" : words} off={off} />;
}

// A share of a usage meter, "about 75%".
export function PercentSlider({ value, onChange, label, tip }: { value: number; onChange: (v: number) => void; label: string; tip: string }) {
  return <Slider value={value} onChange={onChange} min={5} max={100} label={label} tip={tip} words={`about ${value}%`} />;
}

// `off`: greyed out, with one line saying why it doesn't apply.
function Slider({ value, onChange, min, max, label, tip, words, off }: { value: number; onChange: (v: number) => void; min: number; max: number; label: string; tip: string; words: string; off?: string }) {
  const id = useId();
  const noteId = useId();
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center justify-between gap-3">
        <Label as="label" htmlFor={id} tip={tip}>
          {label}
        </Label>
        <span className={`text-[15px] font-semibold ${off ? "text-muted" : ""}`}>{words}</span>
      </span>
      <input id={id} type="range" min={min} max={max} step={5} value={value} disabled={!!off} aria-describedby={off ? noteId : undefined} onChange={(e) => onChange(Number(e.target.value))} className="h-11 w-full accent-[#15171B] disabled:cursor-not-allowed disabled:opacity-40" />
      {off && (
        <p id={noteId} className="text-[14px] text-muted">
          {off}
        </p>
      )}
    </div>
  );
}

export function NotifyPicker({ value, onChange }: { value: NotifyOn[]; onChange: (v: NotifyOn[]) => void }) {
  const never = value.length === 0;
  const toggle = (n: NotifyOn | "never") => {
    if (n === "never") return onChange(never ? ["finished", "needs_ok", "problems"] : []);
    onChange(value.includes(n) ? value.filter((x) => x !== n) : [...value, n]);
  };
  return (
    <fieldset>
      <Label as="legend" tip="agentbox can send you a message on Discord (a chat app) when these things happen. Tick as many as you like, or Never for no messages.">
        Tell me when
      </Label>
      <div className="flex flex-wrap gap-2">
        {(["finished", "needs_ok", "problems", "never"] as const).map((n) => {
          const on = n === "never" ? never : value.includes(n);
          return (
            <label
              key={n}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-[14px] font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[#2f4fd8] ${on ? "border-ink bg-ink text-white" : "border-[#C9CDD4]"}`}
            >
              <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(n)} />
              {on && <span aria-hidden="true">✓</span>}
              {NOTIFY_WORDS[n]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export type When = { scheduleKind: ScheduleKind; scheduleDays: number[]; scheduleTime: string };

// When does it run? Now · Every hour · Every day · Certain days, with the pickers right there and the next run in words.
export function WhenPicker({ value, onChange, nowLabel = "Now" }: { value: When; onChange: (v: When) => void; nowLabel?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const timeId = useId();
  const set = (p: Partial<When>) => onChange({ ...value, ...p });
  const next = nextRunAfter(value.scheduleKind, value.scheduleDays, value.scheduleTime, now);
  return (
    <div className="flex flex-col gap-3">
      <Segmented<ScheduleKind>
        legend="When does it run?"
        tip={`${nowLabel === "Now" ? "Now starts it straight away, once." : `${nowLabel}: it only runs when you press Run now.`} The others start it by themselves on a timetable, until you pause or archive it.`}
        value={value.scheduleKind}
        onChange={(k) => set({ scheduleKind: k, scheduleDays: k === "days" && !value.scheduleDays.length ? [1, 2, 3, 4, 5] : value.scheduleDays })}
        options={(["manual", "hourly", "daily", "days"] as ScheduleKind[]).map((k) => ({ value: k, label: k === "manual" ? nowLabel : SCHEDULE_WORDS[k] }))}
      />
      {value.scheduleKind === "days" && (
        <fieldset>
          <legend className="sr-only">Which days?</legend>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const on = value.scheduleDays.includes(d);
              return (
                <label
                  key={d}
                  className={`flex min-h-11 min-w-12 cursor-pointer items-center justify-center rounded-[14px] border px-3 text-[14px] font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[#2f4fd8] ${on ? "border-ink bg-ink text-white" : "border-[#C9CDD4] text-ink"}`}
                >
                  <input type="checkbox" className="sr-only" checked={on} aria-label={DAY_NAMES[d]} onChange={() => set({ scheduleDays: on ? value.scheduleDays.filter((x) => x !== d) : [...value.scheduleDays, d] })} />
                  {DAY_SHORT[d]}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      {(value.scheduleKind === "daily" || value.scheduleKind === "days") && (
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor={timeId} className="text-[14px] font-semibold">
            At
          </label>
          <input id={timeId} type="time" value={value.scheduleTime} onChange={(e) => set({ scheduleTime: e.target.value || "18:00" })} className={`${field} min-h-11 w-[150px]`} />
        </div>
      )}
      {value.scheduleKind !== "manual" && (
        <p className="text-[14px] font-medium" aria-live="polite">
          {next ? `Next run: ${dayAt(next, now)}` : "Pick at least one day."}
        </p>
      )}
    </div>
  );
}

// A checkbox chip used for small multi-choices (connectors).
export function Chip({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-[14px] font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[#2f4fd8] ${checked ? "border-ink bg-ink text-white" : "border-[#C9CDD4]"} ${disabled ? "opacity-50" : ""}`}
    >
      <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {checked && <span aria-hidden="true">✓</span>}
      {children}
    </label>
  );
}

export { InfoTip };
