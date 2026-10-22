import { machineInfo } from "@/lib/machine";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await machineInfo());
}
