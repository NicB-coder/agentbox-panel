import { notFound, redirect } from "next/navigation";
import AgentEditor from "@/components/AgentEditor";
import { getAgent } from "@/lib/db";
import { listProjects } from "@/lib/projects";
import { agentAsInput } from "@/lib/words";

export const dynamic = "force-dynamic";

export default async function EditAgent({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const agent = Number.isInteger(id) ? getAgent(id) : null;
  if (!agent) notFound();
  if (agent.kind !== "claude") redirect(`/agents/${id}`);
  return <AgentEditor id={id} initial={agentAsInput(agent)} projects={listProjects()} />;
}
