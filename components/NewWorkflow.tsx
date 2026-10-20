"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { STEP_INFO, TEMPLATES, templateWorkflow, type AgentRef, type TemplateKey } from "@/lib/wf";
import { BackLink, ErrorBox, InfoTip, post } from "./bits";
import ProjectSelect from "./ProjectSelect";
import { Icon, btn } from "./ui";

const EXAMPLE = "When I give it an idea, research it, build it, have it reviewed and checked against the research, then ship it.";

export default function NewWorkflow({ projects, agents }: { projects: string[]; agents: AgentRef[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [project, setProject] = useState(projects[0] ?? "");
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<{ msg: string; retry: () => void } | null>(null);

  async function fromTemplate(key: TemplateKey) {
    setBusy(key);
    setError(null);
    try {
      const w = await post<{ id: number }>("/api/workflows", { template: key, project });
      router.push(`/workflows/${w.id}`);
    } catch (e) {
      setError({ msg: (e as Error).message, retry: () => fromTemplate(key) });
      setBusy("");
    }
  }

  async function describe(e?: React.FormEvent) {
    e?.preventDefault();
    if (text.trim().length < 10) return setError({ msg: "Write a sentence or two about what should happen.", retry: () => describe() });
    setBusy("describe");
    setError(null);
    try {
      const w = await post<{ id: number }>("/api/workflows/draft", { text, project });
      router.push(`/workflows/${w.id}?drafted=1`);
    } catch (err) {
      setError({ msg: (err as Error).message, retry: () => describe() });
      setBusy("");
    }
  }

  return (
    <div className="pt-8 sm:pt-10">
      <BackLink href="/workflows">All workflows</BackLink>
      <h1 className="mt-4 text-[30px] font-bold leading-tight tracking-tight sm:text-[36px]">New workflow</h1>
      <p className="mt-2 text-[17px] text-muted">Two ways to start. You'll see every step before anything runs.</p>

      <div className="mt-6 max-w-[420px]">
        <ProjectSelect value={project} onChange={setProject} projects={projects} tip="The code this workflow works on. All its steps share one copy of it." />
      </div>

      {error && (
        <div className="mt-6">
          <ErrorBox message={error.msg} onRetry={error.retry} where="New workflow" />
        </div>
      )}

      <section className="panel mt-8 p-6 sm:p-8" aria-labelledby="describe-h">
        <h2 id="describe-h" className="flex items-center text-[22px] font-bold">
          Describe it
          <InfoTip text="Claude reads what you wrote and turns it into steps. It only drafts: nothing runs until you check the steps and turn the workflow on." label="Describe it" />
        </h2>
        <form onSubmit={describe} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-[15px] font-semibold">What should happen?</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={`For example: ${EXAMPLE}`} className="rounded-[14px] border border-[#C9CDD4] p-4 text-[16px] leading-relaxed" disabled={busy === "describe"} />
          </label>
          <p className="text-[14px] text-muted">Say what starts it, what should happen in order, and when it should check with you.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={btn.primary} disabled={!!busy}>
              {busy === "describe" ? "Drafting the steps…" : "Make the steps"}
            </button>
            {busy === "describe" && (
              <span className="flex items-center gap-2 text-[14px] text-muted" role="status">
                <span className="pulse h-2.5 w-2.5 rounded-full bg-[#2F4FD8]" aria-hidden="true" /> Claude is reading it. This takes about half a minute.
              </span>
            )}
          </div>
        </form>
      </section>

      <section className="mt-12" aria-labelledby="tpl-h">
        <h2 id="tpl-h" className="text-[22px] font-bold">
          Start from a template
        </h2>
        <ul className="mt-5 grid gap-6 sm:grid-cols-2">
          {TEMPLATES.map((t) => {
            const steps = templateWorkflow(t.key, agents, project).steps;
            return (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => fromTemplate(t.key)}
                  disabled={!!busy}
                  className="flex h-full w-full flex-col gap-3 rounded-[40px] border border-[rgba(21,23,27,0.28)] bg-white p-7 text-left shadow-[0_1px_2px_rgba(21,23,27,0.04),0_10px_30px_rgba(21,23,27,0.05)] transition-shadow hover:shadow-[0_2px_4px_rgba(21,23,27,0.06),0_16px_40px_rgba(21,23,27,0.09)] disabled:opacity-60"
                >
                  <span className="text-[18px] font-semibold">{t.name}</span>
                  <span className="text-[15px] leading-relaxed text-muted">{t.blurb}</span>
                  <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-2" aria-hidden="true">
                    {steps.map((s, i) => {
                      const a = s.type === "agent" && s.agentId != null ? agents.find((x) => x.id === s.agentId) : null;
                      const color = a?.color ?? STEP_INFO[s.type].color;
                      return (
                        <span key={s.id} className="flex items-center gap-1.5">
                          {i > 0 && <span className="text-[#9AA0A8]">→</span>}
                          <span className="flex h-8 w-8 items-center justify-center rounded-[10px]" style={{ background: `${color}1A` }}>
                            <Icon name={a?.icon ?? STEP_INFO[s.type].icon} color={color} size={16} />
                          </span>
                        </span>
                      );
                    })}
                  </span>
                  <span className="text-[15px] font-semibold underline">{busy === t.key ? "Setting it up…" : "Use this template"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
