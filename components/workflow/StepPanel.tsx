"use client";
import { useEffect, useRef, useState } from "react";
import type { CheckKind, StartTrigger, WfStep } from "@/lib/types";
import { CHECK_WORDS, STEP_INFO, TRIGGER_WORDS, stepTitle, type AgentRef } from "@/lib/wf";
import { DAY_NAMES, DAY_SHORT } from "@/lib/words";
import { InfoTip, Label } from "../bits";
import { CarefulPicker, Chip, FreedomPicker } from "../controls";
import { modeFor } from "@/lib/job";
import Segmented from "../Segmented";
import { btn, field } from "../ui";
import { stepColor, stepIcon } from "./Canvas";
import { Icon } from "../ui";
import { askHelper } from "../helper/helperStore";

// The side panel (a bottom sheet on a phone) for one step. Same controls as the agent editor.

export function Sheet({ title, icon, color, onClose, children, ask }: { title: string; icon: string; color: string; onClose: () => void; children: React.ReactNode; ask?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <aside data-helper-avoid=""
      ref={ref}
      tabIndex={-1}
      aria-label={`${title} settings`}
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[78vh] flex-col rounded-t-[24px] border border-line bg-white shadow-[0_-20px_60px_rgba(21,23,27,0.18)] outline-none md:inset-x-auto md:bottom-4 md:right-4 md:top-20 md:max-h-none md:w-[420px] md:rounded-[24px]"
    >
      <div className="flex items-center gap-3 border-b border-line px-5 py-3">
        <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          <span className="absolute inset-0 rounded-full" style={{ background: color, opacity: 0.1 }} />
          <span className="relative">
            <Icon name={icon} color={color} size={20} />
          </span>
        </span>
        <h2 className="min-w-0 flex-1 truncate text-[18px] font-semibold">{title}</h2>
        {ask && (
          // The Helper bubble steps aside while this panel is open, so it gets its own way in.
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#C9CDD4] px-3 text-[14px] font-semibold hover:bg-soft"
            onClick={() => askHelper(ask)}
            aria-label={`Ask the Helper: ${ask}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3 8.9 8.9 0 0 1-3.9-.9L3 20.5l1.6-4.6a8 8 0 0 1-1.1-4.4A8.4 8.4 0 0 1 12 3.2a8.4 8.4 0 0 1 9 8.3Z" />
            </svg>
            Ask
          </button>
        )}
        <button type="button" className="min-h-11 rounded-[14px] px-3 text-[15px] font-semibold underline" onClick={onClose}>
          Done
        </button>
      </div>
      <div className="flex flex-col gap-6 overflow-y-auto px-5 py-5 pb-[calc(20px+env(safe-area-inset-bottom))]">{children}</div>
    </aside>
  );
}

type Props = {
  step: WfStep;
  index: number;
  steps: WfStep[];
  agents: AgentRef[];
  project: string;
  onChange: (patch: Partial<WfStep>, key?: string) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onClose: () => void;
};

export default function StepPanel({ step: s, index, steps, agents, project, onChange, onDelete, onMove, onClose }: Props) {
  const info = STEP_INFO[s.type];
  const earlier = steps.slice(1, index);
  const failSelect = (
    <label className="flex flex-col gap-2">
      <Label tip="If it doesn't pass, where should the work go? Back to an earlier step to fix it (counts as one round), or stop and tell you.">If it needs work</Label>
      <select value={s.onFail ?? "stop"} onChange={(e) => onChange({ onFail: e.target.value })} className={`${field} min-h-11`} aria-label="If it needs work">
        {earlier.map((e) => (
          <option key={e.id} value={e.id}>
            Go back to {stepTitle(e, agents)}
          </option>
        ))}
        <option value="stop">Stop and tell me</option>
      </select>
    </label>
  );
  const timeSlider = (
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between">
        <Label tip="The longest this one step may work. The whole workflow also has its own limit (Longest run, under Limits), and whichever comes first stops it. Its work is kept either way.">Time limit for this step</Label>
        <span className="text-[15px] font-semibold">{s.maxMinutes ?? 30} minutes</span>
      </span>
      <input type="range" aria-label="Time limit" aria-valuetext={`${s.maxMinutes ?? 30} minutes`} min={5} max={120} step={5} value={s.maxMinutes ?? 30} onChange={(e) => onChange({ maxMinutes: Number(e.target.value) }, "maxMinutes")} className="h-11 w-full accent-[#15171B]" />
    </label>
  );
  const modelPick = (tip: string) => (
    <Segmented
      legend="Which AI?"
      tip={tip}
      value={s.model ?? "sonnet"}
      onChange={(v) => onChange({ model: v })}
      options={[
        { value: "sonnet", label: "Fast" },
        { value: "opus", label: "Smartest" },
      ]}
    />
  );

  return (
    <Sheet title={s.type === "agent" ? stepTitle(s, agents) : info.title} icon={stepIcon(s, agents)} color={stepColor(s, agents)} onClose={onClose} ask="What does this step do?">
      <p className="text-[15px] leading-relaxed text-muted">{info.help}</p>

      {s.type === "start" && (
        <>
          <fieldset className="flex flex-col gap-2">
            <Label as="legend" tip="Pick what kicks off a run. You can always start it yourself too, with Run now or Test run.">What starts it?</Label>
            <div className="grid gap-2">
              {(Object.keys(TRIGGER_WORDS) as StartTrigger[]).map((t) => (
                <label key={t} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[14px] border px-4 text-[15px] font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[#2f4fd8] ${(s.trigger ?? "manual") === t ? "border-ink bg-soft" : "border-line hover:bg-soft"}`}>
                  <input type="radio" name="trigger" className="sr-only" checked={(s.trigger ?? "manual") === t} onChange={() => onChange({ trigger: t, scheduleKind: s.scheduleKind ?? "daily", scheduleTime: s.scheduleTime ?? "02:00", scheduleDays: s.scheduleDays ?? [1, 2, 3, 4, 5], label: s.label ?? "agent" })} />
                  {TRIGGER_WORDS[t]}
                </label>
              ))}
            </div>
          </fieldset>
          {s.trigger === "schedule" && (
            <>
              <Segmented
                legend="How often?"
                value={s.scheduleKind ?? "daily"}
                onChange={(v) => onChange({ scheduleKind: v })}
                options={[
                  { value: "hourly", label: "Every hour" },
                  { value: "daily", label: "Every day" },
                  { value: "days", label: "Certain days" },
                ]}
              />
              {s.scheduleKind === "days" && (
                <fieldset>
                  <legend className="mb-2 text-[14px] font-semibold">Which days?</legend>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                      const on = (s.scheduleDays ?? []).includes(d);
                      return (
                        <label key={d} className={`flex min-h-11 min-w-12 cursor-pointer items-center justify-center rounded-[14px] border px-3 text-[14px] font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[#2f4fd8] ${on ? "border-ink bg-ink text-white" : "border-[#C9CDD4]"}`}>
                          <input type="checkbox" className="sr-only" checked={on} aria-label={DAY_NAMES[d]} onChange={() => onChange({ scheduleDays: on ? (s.scheduleDays ?? []).filter((x) => x !== d) : [...(s.scheduleDays ?? []), d] })} />
                          {DAY_SHORT[d]}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
              {s.scheduleKind !== "hourly" && (
                <label className="flex flex-col gap-2 sm:max-w-[220px]">
                  <span className="text-[14px] font-semibold">At what time?</span>
                  <input type="time" value={s.scheduleTime ?? "02:00"} onChange={(e) => onChange({ scheduleTime: e.target.value || "02:00" })} className={`${field} min-h-11`} />
                </label>
              )}
            </>
          )}
          {s.trigger === "issue_label" && (
            <label className="flex flex-col gap-2">
              <Label tip="On GitHub, add this label to an issue and the workflow picks it up within about two minutes. Only issues labeled after you turn the workflow on count.">Which label?</Label>
              <input value={s.label ?? "agent"} onChange={(e) => onChange({ label: e.target.value }, "label")} className={`${field} min-h-11`} maxLength={50} />
            </label>
          )}
          {s.trigger === "pr_opened" && (
            <p className="rounded-[14px] bg-soft p-4 text-[14px] leading-relaxed">
              When someone (or an agent) opens a pull request in {project || "this project"}, the workflow works on that pull request's branch. Pull requests opened by this same workflow are skipped. It checks about every two minutes.
            </p>
          )}
        </>
      )}

      {s.type === "agent" && (
        <>
          <label className="flex flex-col gap-2">
            <Label tip="A fresh agent (best for most steps) starts new and just follows this step's instructions. Or pick one of your agents from the home page: it also brings its own job description with it.">Who does it?</Label>
            <select
              value={s.agentId == null ? "quick" : String(s.agentId)}
              onChange={(e) => onChange({ agentId: e.target.value === "quick" ? null : Number(e.target.value), model: e.target.value === "quick" ? s.model ?? "sonnet" : undefined })}
              className={`${field} min-h-11`}
              aria-label="Who does it?"
            >
              <option value="quick">A fresh agent (recommended)</option>
              {agents
                .filter((a) => !a.archived || a.id === s.agentId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} (one of your agents)
                  </option>
                ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <Label tip={s.agentId == null ? "What this step should do with the workflow's task. A sentence or two is enough." : "Anything extra for this step. Leave it empty and the agent does its usual job on the task."}>
              {s.agentId == null ? "This step's instructions" : "This step's instructions (optional)"}
            </Label>
            <textarea
              value={s.prompt ?? ""}
              onChange={(e) => onChange({ prompt: e.target.value }, "prompt")}
              rows={4}
              placeholder={s.agentId == null ? "For example: Build what the task asks for and test it in a browser." : "For example: Keep it to one file."}
              className="rounded-[14px] border border-[#C9CDD4] p-3 text-[15px] leading-relaxed"
              aria-label="This step's instructions"
            />
          </label>
          <FreedomPicker value={s.freedom ?? (s.mode === "look" ? "look" : s.mode === "plan" ? "check" : "auto")} onChange={(f) => onChange({ freedom: f, mode: modeFor(f, false).mode })} />
          <StepConnectors value={s.connectors ?? []} onChange={(c) => onChange({ connectors: c })} />
          {(s.freedom ?? "auto") !== "look" && <CarefulPicker value={!!s.careful} onChange={(c) => onChange({ careful: c, maxMinutes: Math.max(s.maxMinutes ?? 30, c ? 60 : 30) })} />}
          {timeSlider}
          {s.agentId == null && modelPick("Fast is good for most steps. Smartest takes longer and uses more of your usage.")}
        </>
      )}

      {s.type === "research" && (
        <>
          <label className="flex flex-col gap-2">
            <Label tip="Optional. Point it at what matters, like 'compare three ways to do this' or 'check the official docs'.">Anything to focus on? (optional)</Label>
            <textarea value={s.prompt ?? ""} onChange={(e) => onChange({ prompt: e.target.value }, "prompt")} rows={3} className="rounded-[14px] border border-[#C9CDD4] p-3 text-[15px]" aria-label="Anything to focus on?" />
          </label>
          {timeSlider}
          {modelPick("Fast is usually enough for research.")}
        </>
      )}

      {s.type === "review" && (
        <>
          <label className="flex flex-col gap-2">
            <Label tip="Optional. Extra things the reviewer should check, like 'works on phones' or 'no new packages'.">Anything else to check? (optional)</Label>
            <textarea value={s.prompt ?? ""} onChange={(e) => onChange({ prompt: e.target.value }, "prompt")} rows={3} className="rounded-[14px] border border-[#C9CDD4] p-3 text-[15px]" aria-label="Anything else to check?" />
          </label>
          {modelPick("A different AI from the one that built it catches more. Smartest checking Fast's work is a good pair.")}
          {timeSlider}
          {failSelect}
        </>
      )}

      {s.type === "check" && (
        <>
          <fieldset>
            <Label as="legend" tip="Real tests run by agentbox itself, not an opinion. If any fails, the step 'needs work'.">What must pass?</Label>
            <div className="flex flex-col gap-2">
              {(Object.keys(CHECK_WORDS) as CheckKind[]).map((c) => {
                const on = (s.checks ?? []).includes(c);
                return (
                  <label key={c} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[14px] border px-4 text-[15px] font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[#2f4fd8] ${on ? "border-ink bg-soft" : "border-line"}`}>
                    <input type="checkbox" className="h-5 w-5 accent-[#15171B]" checked={on} onChange={() => onChange({ checks: on ? (s.checks ?? []).filter((x) => x !== c) : [...(s.checks ?? []), c] })} />
                    {CHECK_WORDS[c]}
                  </label>
                );
              })}
            </div>
          </fieldset>
          {((s.checks ?? []).includes("page") || (s.checks ?? []).includes("console")) && (
            <label className="flex flex-col gap-2">
              <Label tip="agentbox starts the project on this Mac and opens this page, like / or /about. Or paste a full web address (https://…) to check a live site.">Which page?</Label>
              <input value={s.pagePath ?? "/"} onChange={(e) => onChange({ pagePath: e.target.value }, "pagePath")} className={`${field} min-h-11`} aria-label="Which page?" />
            </label>
          )}
          {failSelect}
        </>
      )}

      {s.type === "ask" && (
        <label className="flex flex-col gap-2">
          <Label tip="What you'll see in the Inbox. You can Approve, Send it back with a note, or Stop.">What should it ask you? (optional)</Label>
          <input value={s.question ?? ""} onChange={(e) => onChange({ question: e.target.value }, "question")} placeholder="For example: Look it over. Put it in?" className={`${field} min-h-11`} aria-label="What should it ask you?" maxLength={300} />
        </label>
      )}

      {s.type === "ship" && (
        <>
          <Segmented
            legend="How should it go in?"
            tip="This puts the finished change into the real version of your project. If your site goes live from GitHub, this also updates the live site."
            value={s.shipMode ?? "ask"}
            onChange={(v) => onChange({ shipMode: v })}
            options={[
              { value: "ask", label: "Ask me first" },
              { value: "auto", label: "Put it in by itself" },
            ]}
          />
          {s.shipMode === "auto" && (
            <p className="rounded-[14px] bg-soft p-4 text-[14px] leading-relaxed">
              {project === "agentbox-panel"
                ? "This project is agentbox itself, so it always asks you first, even with this on."
                : "It only ships on its own if every Review and Check before it passed. Otherwise it asks you in the Inbox."}
            </p>
          )}
          {s.shipMode !== "auto" && <p className="text-[14px] text-muted">If an Ask me step comes right before this one, your OK there counts, so it won't ask twice.</p>}
        </>
      )}

      {s.type === "tell" && (
        <>
          <Segmented
            legend="When?"
            tip="'Always' sends a summary every time. 'Only if something's wrong' stays quiet when everything went fine."
            value={s.tellWhen ?? "always"}
            onChange={(v) => onChange({ tellWhen: v })}
            options={[
              { value: "always", label: "Always" },
              { value: "problems", label: "Only if something's wrong" },
            ]}
          />
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-[#15171B]" checked={!!s.openIssue} onChange={(e) => onChange({ openIssue: e.target.checked })} />
            Also open a GitHub issue when something's wrong
            <InfoTip text="Writes the problems up as an issue in the project on GitHub, so they don't get lost." label="Open a GitHub issue" />
          </label>
          <p className="text-[14px] text-muted">Messages go to your Discord. Test runs never send them.</p>
        </>
      )}

      {index > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-line pt-5">
          <button type="button" className={btn.secondary} onClick={() => onMove(-1)} disabled={index <= 1}>
            Move earlier
          </button>
          <button type="button" className={btn.secondary} onClick={() => onMove(1)} disabled={index >= steps.length - 1}>
            Move later
          </button>
          <button type="button" className={btn.danger + " ml-auto"} onClick={onDelete}>
            Remove step
          </button>
        </div>
      )}
    </Sheet>
  );
}

// Which connected apps this step may use (none by default).
function StepConnectors({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [list, setList] = useState<{ id: string; name: string; state: string }[] | null>(null);
  useEffect(() => {
    fetch("/api/connectors").then((r) => r.json()).then(setList).catch(() => setList([]));
  }, []);
  const usable = (list ?? []).filter((c) => c.state === "connected" && c.id !== "github");
  if (!usable.length) return null;
  return (
    <fieldset>
      <Label as="legend" tip="Apps this step may use, like your email or calendar. Anything that sends, deletes or books something still asks you first.">
        Connectors
      </Label>
      <div className="flex flex-wrap gap-2">
        {usable.map((c) => (
          <Chip key={c.id} checked={value.includes(c.id)} onChange={(v) => onChange(v ? [...value, c.id] : value.filter((x) => x !== c.id))}>
            {c.name}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}
