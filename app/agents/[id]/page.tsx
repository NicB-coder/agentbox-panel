import { notFound } from "next/navigation";
import AgentPageClient from "@/components/AgentPageClient";
import { agentPageState } from "@/lib/views";

export const dynamic = "force-dynamic";

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const state = Number.isInteger(id) ? agentPageState(id) : null;
  if (!state) notFound();
  return <AgentPageClient initial={state} id={id} />;
}
