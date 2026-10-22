"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AgentInput, Freedom, JobSettings } from "@/lib/types";
import { agentSentence } from "@/lib/words";
import { DEFAULT_JOB, freedomOf, modeFor } from "@/lib/job";
import { AgentIcon, COLOR_CHOICES, ICON_CHOICES, ICON_NAMES, Icon, btn } from "./ui";
import { CarefulPicker, FreedomPicker, MinutesSlider, ModelPicker, NotifyPicker, WhenPicker } from "./controls";
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
  const job: JobSettings = a.job ?? DEFAULT_JOB;
  const setJob = (p: Partial<JobSettings>) => setA((x) => ({ ...x, job: { ...(x.job ?? DEFAULT_JOB), ...p } }));
  const freedom = freedomOf(a);
  const setFreedom = (f: Freedom, ask: boolean) => setA((x) => ({ ...x, ...modeFor(f, ask), job: { ...(x.job ?? DEFAULT_JOB), askEachStep: f !== "look" && ask } }));
  // The Helper can see what's typed so far (e.g. "Help me write what it should do").
  useHelperContext({
    agentId: id ?? undefined,
    editing: `${id ? "this agent's settings" : "a new agent"}, not saved yet. Name: "${a.name}". What it should do so far: "${a.prompt.slice(0, 1200)}". ${agentSentence(a)}`,
  });

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
        <span aria-hidden="true">←</span> {id ? `Back to ${initial.name}` : "All agents"}
      </Link>
      <div className="mt-4 flex items-center gap-4">
        <AgentIcon name={a.icon} color={a.color} size={56} />
        <h1 className="text-[28px] font-bold tracking-tight">{id ? `${initial.name}: settings` : "Add an agent"}</h1>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {/* Name, color, icon */}
        <section className="panel flex flex-col gap-6 p-6 sm:p-8">
          <label className="flex flex-col gap-2">
            <Label tip="What you'll call it, like Arcade site. Shown on its tile.">Name</Label>
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
            <label htmlFor="prompt">The job</label>
            <InfoTip text="What this agent is for, in your own words. It reads this every time it runs. To ask for something new on the same job, use Add a follow-up instead." label="The job" />
          </span>
          <textarea
            id="prompt"
            value={a.prompt}
            onChange={(e) => set("prompt", e.target.value)}
            rows={8}
            placeholder={PLACEHOLDER}
                        className="mt-1 rounded-[14px] border border-[#C9CDD4] p-4 text-[15px] leading-relaxed"
          />
        </section>

        {/* Settings */}
        <section className="panel flex flex-col gap-8 p-6 sm:p-8">
          <ProjectSelect value={a.project} onChange={(p) => set("project", p)} projects={projects} optional={job.kind === "research"} tip="The code this job works on. It always works in its own copy, never straight in main." />
          <WhenPicker value={{ scheduleKind: a.scheduleKind, scheduleDays: a.scheduleDays, scheduleTime: a.scheduleTime }} onChange={(w) => setA((x) => ({ ...x, ...w }))} nowLabel="When I start it" />
          <FreedomPicker value={freedom} onChange={(f) => setFreedom(f, job.askEachStep)} />
          <CarefulPicker value={job.careful} onChange={(c) => setJob({ careful: c })} />
          <MinutesSlider value={a.maxMinutes} onChange={(v) => set("maxMinutes", v)} />
          <ModelPicker value={a.model} onChange={(v) => set("model", v)} />
          <NotifyPicker value={a.notify} onChange={(v) => set("notify", v)} />
          {freedom !== "look" && <Switch label="Ask me each step" tip="It stops before every command or change and waits for your Allow or Deny." checked={job.askEachStep} onChange={(v) => setFreedom(freedom, v)} />}
          <Switch label="On" tip="Turn it off to keep it but stop it from running, even on its schedule." checked={a.enabled} onChange={(v) => set("enabled", v)} />
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
              {busy ? "Saving…" : "Save"}
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
