"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AgentInput, Allowed, Model, NotifyOn, ScheduleKind } from "@/lib/types";
import { ALLOWED_WORDS, DAY_NAMES, DAY_SHORT, NOTIFY_WORDS, SCHEDULE_WORDS, agentSentence } from "@/lib/words";
import { AgentIcon, COLOR_CHOICES, ICON_CHOICES, ICON_NAMES, Icon, btn } from "./ui";
import Segmented from "./Segmented";
import ModePicker from "./ModePicker";
import ProjectSelect from "./ProjectSelect";
import { ErrorBox, InfoTip, Label, Switch } from "./bits";
import { useHelperContext } from "./helper/helperStore";

const PLACEHOLDER = `For example: Every night, open my portfolio site in a real browser at laptop and phone width. Click every link and check every page loads, images show up and nothing overlaps. A good result is a short list of real problems with which page they're on, or "all good". Never change any code, never fill in forms.`;

const field = "rounded-[14px] border border-[#C9CDD4] bg-white px-3 text-[15px]";

export default function AgentEditor({ id, initial, projects }: { id: number | null; initial: AgentInput; projects: string[] }) {
  const router = useRouter();
  const [a, setA] = useState<AgentInput>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof AgentInput>(k: K, v: AgentInput[K]) => setA((x) => ({ ...x, [k]: v }));
  // The Helper can see what's typed so far (e.g. "Help me write what it should do").
  useHelperContext({
    agentId: id ?? undefined,
    editing: `${id ? "this agent's settings" : "a new agent"}, not saved yet. Name: "${a.name}". What it should do so far: "${a.prompt.slice(0, 1200)}". ${agentSentence(a)}`,
  });

  const never = a.notify.length === 0;
  function toggleNotify(n: NotifyOn | "never") {
    if (n === "never") return set("notify", never ? ["finished", "needs_ok", "problems"] : []);
    set("notify", a.notify.includes(n) ? a.notify.filter((x) => x !== n) : [...a.notify, n]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    let r: Response;
    try {
      r = await fetch(id ? `/api/agents/${id}` : "/api/agents", {
        method: id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(a),
      });
    } catch {
      setBusy(false);
      return setError("Couldn't reach agentbox. Check that you're online and try again.");
    }
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(j.error ?? "Couldn't save it.");
    router.push(`/agents/${j.id}`);
    router.refresh();
  }

  async function remove() {
    if (!id || !confirm(`Delete ${initial.name}? Its history goes too. This can't be undone.`)) return;
    const r = await fetch(`/api/agents/${id}`, { method: "DELETE" });
    if (r.ok) {
      router.push("/");
      router.refresh();
    } else setError((await r.json().catch(() => ({}))).error ?? "Couldn't delete it.");
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-[760px] pt-8 sm:pt-10" noValidate>
      <Link href={id ? `/agents/${id}` : "/"} className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-muted hover:text-ink">
        <span aria-hidden="true">←</span> {id ? "Back to the agent" : "All agents"}
      </Link>
      <div className="mt-4 flex items-center gap-4">
        <AgentIcon name={a.icon} color={a.color} size={56} />
        <h1 className="text-[28px] font-bold tracking-tight">{id ? `Edit ${initial.name}` : "Add an agent"}</h1>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {/* Name, color, icon */}
        <section className="panel flex flex-col gap-6 p-6 sm:p-8">
          <label className="flex flex-col gap-2">
            <Label tip="What you'll call it, like Site Checker. Shown on its tile.">Name</Label>
            <input value={a.name} onChange={(e) => set("name", e.target.value)} maxLength={40} placeholder="Site Checker" className={`${field} min-h-11`} />
          </label>
          <fieldset>
            <Label as="legend" tip="Its color on the tile, so you can spot it quickly.">Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_CHOICES.map((c) => (
                <label key={c.hex} className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[#2f4fd8]">
                  <input type="radio" name="color" className="sr-only" checked={a.color === c.hex} onChange={() => set("color", c.hex)} aria-label={c.name} />
                  <span className="h-8 w-8 rounded-full" style={{ background: c.hex, boxShadow: a.color === c.hex ? `0 0 0 3px #fff, 0 0 0 5px ${c.hex}` : "none" }} />
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <Label as="legend" tip="A little picture for its tile.">Icon</Label>
            <div className="flex flex-wrap gap-2">
              {ICON_CHOICES.map((i) => (
                <label
                  key={i}
                  className={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-[14px] border has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[#2f4fd8] ${
                    a.icon === i ? "border-ink bg-soft" : "border-line hover:bg-soft"
                  }`}
                >
                  <input type="radio" name="icon" className="sr-only" checked={a.icon === i} onChange={() => set("icon", i)} aria-label={ICON_NAMES[i]} />
                  <Icon name={i} color={a.icon === i ? a.color : "#555A63"} />
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        {/* Prompt */}
        <section className="panel flex flex-col gap-2 p-6 sm:p-8">
          <span className="flex items-center text-[18px] font-semibold">
            <label htmlFor="prompt">What should this agent do?</label>
            <InfoTip text="Its job description, in your own words. It reads this every time it runs." label="What should this agent do?" />
          </span>
          <textarea
            id="prompt"
            value={a.prompt}
            onChange={(e) => set("prompt", e.target.value)}
            rows={8}
            placeholder={PLACEHOLDER}
            aria-describedby="prompt-tip"
            className="mt-1 rounded-[14px] border border-[#C9CDD4] p-4 text-[15px] leading-relaxed"
          />
          <p id="prompt-tip" className="text-[14px] text-muted">
            Say what to look at, what a good result is, and what it should never do.
          </p>
        </section>

        {/* Settings */}
        <section className="panel flex flex-col gap-8 p-6 sm:p-8">
          <ProjectSelect value={a.project} onChange={(p) => set("project", p)} projects={projects} tip="The code this agent works on. It always works in its own copy, never straight in main." />

          <div className="flex flex-col gap-4">
            <Segmented<ScheduleKind>
              legend="When does it run?"
              tip="Only when I ask means it waits for you. The others start it by themselves on a timetable."
              value={a.scheduleKind}
              onChange={(v) => set("scheduleKind", v)}
              options={(["manual", "hourly", "daily", "days"] as ScheduleKind[]).map((k) => ({ value: k, label: SCHEDULE_WORDS[k] }))}
            />
            {a.scheduleKind === "days" && (
              <fieldset>
                <legend className="mb-2 text-[14px] font-semibold">Which days?</legend>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                    const on = a.scheduleDays.includes(d);
                    return (
                      <label
                        key={d}
                        className={`flex min-h-11 min-w-12 cursor-pointer items-center justify-center rounded-[14px] border px-3 text-[14px] font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[#2f4fd8] ${
                          on ? "border-ink bg-ink text-white" : "border-[#C9CDD4] text-ink"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          aria-label={DAY_NAMES[d]}
                          onChange={() => set("scheduleDays", on ? a.scheduleDays.filter((x) => x !== d) : [...a.scheduleDays, d])}
                        />
                        {DAY_SHORT[d]}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
            {(a.scheduleKind === "daily" || a.scheduleKind === "days") && (
              <label className="flex flex-col gap-2 sm:max-w-[220px]">
                <span className="text-[14px] font-semibold">At what time?</span>
                <input type="time" value={a.scheduleTime} onChange={(e) => set("scheduleTime", e.target.value || "02:00")} className={`${field} min-h-11`} />
              </label>
            )}
          </div>

          <fieldset>
            <Label as="legend" tip="How far it may go. Even Make changes never touches main: you always decide what goes in.">What is it allowed to do?</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["look", "suggest", "make"] as Allowed[]).map((k, i) => (
                <label
                  key={k}
                  className={`flex min-h-11 cursor-pointer flex-col gap-1 rounded-[14px] border p-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[#2f4fd8] ${
                    a.allowed === k ? "border-ink bg-soft" : "border-line hover:bg-soft"
                  }`}
                >
                  <input type="radio" name="allowed" className="sr-only" checked={a.allowed === k} onChange={() => set("allowed", k)} />
                  <span className="text-[13px] font-semibold text-muted">Step {i + 1}</span>
                  <span className="text-[15px] font-semibold">{ALLOWED_WORDS[k].label}</span>
                  <span className="text-[13px] leading-snug text-muted">{ALLOWED_WORDS[k].hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <ModePicker legend="How should it work with me?" value={a.mode} onChange={(m) => set("mode", m)} />

          <div className="flex flex-col gap-6">
            <label className="flex flex-col gap-3">
              <span className="flex items-baseline justify-between text-[15px] font-semibold">
                <Label tip="If a run takes longer than this, it stops so it can't run forever. Waiting for your OK doesn't count.">Longest it can run</Label>
                <span className="text-[15px] font-semibold">{a.maxMinutes} minutes</span>
              </span>
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={a.maxMinutes}
                onChange={(e) => set("maxMinutes", Number(e.target.value))}
                className="h-11 w-full accent-[#15171B]"
              />
            </label>
            <Segmented<Model>
              legend="Which model?"
              tip="Fast is good for most jobs. Smartest thinks harder but takes longer and uses more of your Claude usage."
              value={a.model}
              onChange={(v) => set("model", v)}
              options={[
                { value: "sonnet", label: "Fast (Sonnet)" },
                { value: "opus", label: "Smartest (Opus)" },
              ]}
            />
          </div>

          <fieldset>
            <Label as="legend" tip="When it should send you a Discord message. Pick as many as you like.">Tell me when</Label>
            <div className="flex flex-wrap gap-2">
              {(["finished", "needs_ok", "problems", "never"] as const).map((n) => {
                const on = n === "never" ? never : a.notify.includes(n);
                return (
                  <label
                    key={n}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-[14px] font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[#2f4fd8] ${
                      on ? "border-ink bg-ink text-white" : "border-[#C9CDD4]"
                    }`}
                  >
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleNotify(n)} />
                    {on && <span aria-hidden="true">✓</span>}
                    {NOTIFY_WORDS[n]}
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-[14px] text-muted">Messages go to your Discord.</p>
          </fieldset>

          <Switch label="On" hint="When it's off, it never runs, even on schedule." tip="Turn it off to keep it but stop it from running." checked={a.enabled} onChange={(v) => set("enabled", v)} />
        </section>

        <div className="sticky bottom-[calc(56px+env(safe-area-inset-bottom))] -mx-4 border-t border-line bg-white/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <p className="mb-4 text-[16px] font-medium leading-relaxed" aria-live="polite">
            {agentSentence(a)}
          </p>
          {error && (
            <div className="mb-4">
              <ErrorBox compact message={error} where={id ? "the agent editor" : "Add an agent"} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={btn.primary} disabled={busy}>
              {busy ? "Saving…" : "Save agent"}
            </button>
            <Link href={id ? `/agents/${id}` : "/"} className={btn.secondary}>
              Cancel
            </Link>
            {id && (
              <button type="button" onClick={remove} className="ml-auto min-h-11 px-2 text-[15px] font-semibold text-[#A11B12] underline">
                Delete agent
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
