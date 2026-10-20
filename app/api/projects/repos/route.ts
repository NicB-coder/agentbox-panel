import { availableRepos } from "@/lib/projectsAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await availableRepos());
}
