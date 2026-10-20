"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { btn, field } from "./ui";
import type { WorkMode } from "@/lib/types";
import ModePicker from "./ModePicker";
import { ErrorBox } from "./bits";

type Pick = { id: number; name: string; mode: WorkMode };

// Opens the New task window from anywhere (the phone menu, an idea in the Inbox…).
export function openNewTask(detail: { task?: string; ideaId?: number; agentId?: number } = {}) {
  window.dispatchEvent(new CustomEvent("agentbox:new-task", { detail }));
}

// "New task": choose an agent, describe the task, start it.
export default function NewTaskButton({ agents, buttonClassName = "inline-flex" }: { agents: Pick[]; buttonClassName?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [agentId, setAgentId] = useState<number>(agents[0]?.id ?? 0);
  const [task, setTask] = useState("");
  const [ideaId, setIdeaId] = useState<number | null>(null);
  const [mode, setMode] = useState<WorkMode>(agents[0]?.mode ?? "auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const a = agents.find((x) => x.id === agentId);
    if (a) setMode(a.mode);
  }, [agentId, agents]);

  useEffect(() => {
    const open = (e: Event) => {
      const d = (e as CustomEvent<{ task?: string; ideaId?: number; agentId?: number }>).detail ?? {};
      if (d.task !== undefined) setTask(d.task);
      if (d.agentId && agents.some((a) => a.id === d.agentId)) setAgentId(d.agentId);
      setIdeaId(d.ideaId ?? null);
      setError("");
      ref.current?.showModal();
    };
    window.addEventListener("agentbox:new-task", open);
    return () => window.removeEventListener("agentbox:new-task", open);
  }, [agents]);

  async function start(e?: React.FormEvent) {
    e?.preventDefault();
    if (!task.trim()) return setError("Write what you want it to do first.");
    setBusy(true);
    setError("");
    let r: Response;
    try {
      r = await fetch(`/api/agents/${agentId}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task, mode }),
      });
    } catch {
      setBusy(false);
      return setError("Couldn't reach agentbox. Check that you're online and try again.");
    }
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setError(j.error ?? "Something went wrong.");
    if (ideaId) await fetch(`/api/ideas/${ideaId}`, { method: "DELETE" }).catch(() => {});
    ref.current?.close();
    setTask("");
    setIdeaId(null);
    router.push(`/agents/${agentId}`);
    router.refresh();
  }

  return (
    <>
      <span className={buttonClassName}>
        <button type="button" className={btn.pill} onClick={() => openNewTask()}>
          New task
        </button>
      </span>
      <dialog
        ref={ref}
        aria-labelledby="new-task-title"
        className="m-auto w-[min(560px,calc(100vw-32px))] rounded-[24px] p-0 backdrop:bg-black/30"
      >
        <form onSubmit={start} className="flex flex-col gap-5 p-6 sm:p-8">
          <h2 id="new-task-title" className="text-[22px] font-bold">
            New task
          </h2>
          {agents.length === 0 ? (
            <p className="text-[15px] text-muted">You don't have an agent that can take tasks yet. Add one on the Agents page first.</p>
          ) : (
            <>
              <label className="flex flex-col gap-2">
                <span className="text-[15px] font-semibold">Which agent?</span>
                <select value={agentId} onChange={(e) => setAgentId(Number(e.target.value))} className={`${field} min-h-11`}>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[15px] font-semibold">What should it do?</span>
                <textarea
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  rows={4}
                  placeholder="For example: The contact form doesn't send on phones. Find out why and fix it."
                  className="rounded-[14px] border border-[#C9CDD4] p-3 text-[15px] leading-relaxed"
                />
              </label>
              <ModePicker value={mode} onChange={setMode} legend="How should it work with you?" />
            </>
          )}
          {error && <ErrorBox compact message={error} onRetry={() => start()} where="New task window" />}
          <div className="flex justify-end gap-3">
            <button type="button" className={btn.secondary} onClick={() => ref.current?.close()}>
              Cancel
            </button>
            <button type="submit" className={btn.primary} disabled={busy || agents.length === 0}>
              {busy ? "Starting…" : "Start"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
