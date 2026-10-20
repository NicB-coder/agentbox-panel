import NewWorkflow from "@/components/NewWorkflow";
import { listProjects } from "@/lib/projects";
import { agentRefs } from "@/lib/workflowViews";

export const dynamic = "force-dynamic";

export default function NewWorkflowPage() {
  return <NewWorkflow projects={listProjects()} agents={agentRefs()} />;
}
