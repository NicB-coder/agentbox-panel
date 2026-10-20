import InboxClient from "@/components/InboxClient";
import { listWorkflows } from "@/lib/db";
import { inboxState } from "@/lib/inbox";

export const dynamic = "force-dynamic";

export default function Inbox() {
  const workflows = listWorkflows().map((w) => ({ id: w.id, name: w.name }));
  return <InboxClient initial={inboxState()} workflows={workflows} />;
}
