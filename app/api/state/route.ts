import { homeState } from "@/lib/views";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(homeState());
}
