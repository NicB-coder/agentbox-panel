"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { btn } from "./ui";
import type { WorkMode } from "@/lib/types";
import ModePicker from "./ModePicker";

type Pick = { id: number; name: string; mode: WorkMode };

// "New task": choose an agent, describe the task, start it.
export default function NewTaskButton({ agents }: { agents: Pick[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [agentId, setAgentId] = useState<number>(agents[0]?.id ?? 0);
  const [task, setTask] = useState("");
  const [mode, setMode] = useState<WorkMode>(agents[0]?.mode ?? "auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const a = agents.find((x) => x.id === agentId);
    if (a) setMode(a.mode);
  }, [agentId, agents]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!task.trim()) return setError("Write what you want it to do first.");
    setBusy(true);
    setError("");
    const r = await fetch(`/api/agents/${agentId}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task, mode }),
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setError(j.error ?? "Something went wrong.");
    ref.current?.close();
    setTask("");
    router.push(`/agents/${agentId}`);
    router.refresh();
  }

  return (
    <>
      <button type="button" className={btn.pill} onClick={() => ref.current?.showModal()}>
        New task
      </button>
      <dialog
        ref={ref}
        aria-labelledby="new-task-title"
        className="m-auto w-[min(560px,calc(100vw-32px))] rounded-[24px] p-0 backdrop:bg-black/30"
      >
        <form onSubmit={start} className="flex flex-col gap-5 p-6 sm:p-8">
          <h2 id="new-task-title" className="text-[22px] font-bold">
            New task
          </h2>
          <label className="flex flex-col gap-2">
            <span className="text-[15px] font-semibold">Which agent?</span>
            <select
              value={agentId}
              onChange={(e) => setAgentId(Number(e.target.value))}
              className="min-h-11 rounded-[14px] border border-[#C9CDD4] bg-white px-3 text-[15px]"
            >
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
          {error && (
            <p role="alert" className="text-[14px] font-medium text-[#A11B12]">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" className={btn.secondary} onClick={() => ref.current?.close()}>
              Cancel
            </button>
            <button type="submit" className={btn.primary} disabled={busy}>
              {busy ? "Starting…" : "Start"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
