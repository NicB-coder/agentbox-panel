import { headerState } from "@/lib/control";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(headerState());
}
