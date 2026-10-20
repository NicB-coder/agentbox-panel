import { projectInfos } from "@/lib/projectsAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return Response.json(await projectInfos(new URL(req.url).searchParams.has("fresh")));
}
