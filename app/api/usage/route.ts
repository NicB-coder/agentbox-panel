import { refreshUsage, usageView } from "@/lib/usage";

export const dynamic = "force-dynamic";

// Check again now (it's free: Claude Code's /usage command doesn't use the model).
export async function POST() {
  await refreshUsage(true);
  return Response.json(usageView());
}
