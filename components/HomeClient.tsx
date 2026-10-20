"use client";
import type { HomeState } from "@/lib/views";
import { AddAgentTile, AgentTile } from "./AgentTile";
import { usePoll } from "./usePoll";

export default function HomeClient({ initial }: { initial: HomeState }) {
  const { data } = usePoll<HomeState>("/api/state", initial);
  return (
    <>
      <section className="pb-10 pt-10 sm:pt-14">
        <h1 className="text-[30px] font-bold leading-tight tracking-tight sm:text-[36px]">{data.greeting}</h1>
        <p className="mt-2 text-[17px] text-muted" aria-live="polite">
          {data.summary}
        </p>
      </section>
      <section aria-label="Your agents">
        <ul className="grid gap-10" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {data.views.map((v) => (
            <li key={v.agent.id}>
              <AgentTile v={v} />
            </li>
          ))}
          <li>
            <AddAgentTile />
          </li>
        </ul>
      </section>
    </>
  );
}
