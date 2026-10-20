"use client";
import Link from "next/link";
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
          {data.needs > 0 ? (
            <>
              {data.summary.split(" · ")[0]} ·{" "}
              <Link href="/inbox" className="font-semibold text-[#8A4600] underline underline-offset-2">
                {data.summary.split(" · ")[1]}
              </Link>
            </>
          ) : (
            data.summary
          )}
        </p>
        {data.usageNote && <p className="mt-3 inline-block rounded-[14px] bg-[#FDE8E6] px-4 py-2 text-[15px] font-medium text-[#A11B12]">{data.usageNote}</p>}
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
