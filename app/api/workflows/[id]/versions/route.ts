import { listVersions } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return Response.json(listVersions(Number((await params).id)));
}
