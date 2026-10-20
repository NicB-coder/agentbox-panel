import { notFound } from "next/navigation";
import { Suspense } from "react";
import WorkflowEditor from "@/components/workflow/WorkflowEditor";
import { workflowPageState } from "@/lib/workflowViews";

export const dynamic = "force-dynamic";

export default async function WorkflowPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ run?: string }> }) {
  const id = Number((await params).id);
  const run = (await searchParams).run;
  const state = Number.isInteger(id) ? workflowPageState(id, run === undefined ? null : Number(run)) : null;
  if (!state) notFound();
  return (
    <Suspense>
      <WorkflowEditor initial={state} id={id} />
    </Suspense>
  );
}
