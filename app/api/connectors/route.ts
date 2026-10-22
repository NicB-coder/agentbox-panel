import { connectorStatus } from "@/lib/connectorStatus";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  return Response.json(await connectorStatus(fresh));
}
