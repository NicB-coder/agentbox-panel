import WorkflowsClient from "@/components/WorkflowsClient";
import { workflowsListState } from "@/lib/workflowViews";

export const dynamic = "force-dynamic";

export default function Workflows() {
  return <WorkflowsClient initial={workflowsListState()} />;
}
