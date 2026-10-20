import { workflowsListState } from "@/lib/workflowViews";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(workflowsListState());
}
