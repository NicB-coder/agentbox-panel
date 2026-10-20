import { inboxState } from "@/lib/inbox";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(inboxState());
}
