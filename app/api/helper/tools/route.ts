import { dataBlock, toolsSecretOk } from "@/lib/helper";
import { TOOLS, runTool } from "@/lib/helperTools";

export const dynamic = "force-dynamic";

// The Helper's read-only lookups, called by scripts/helper-mcp.mjs. Read-only: nothing here changes anything.
// Only the Helper's own tool server knows the secret (it gets it by environment variable when the Helper starts).
export async function POST(req: Request) {
  if (!toolsSecretOk(req.headers.get("x-agentbox-helper-secret"))) return Response.json({ error: "Not allowed." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { list?: boolean; name?: string; args?: Record<string, unknown> };
  if (b.list) return Response.json({ tools: TOOLS.map(({ doing: _d, ...t }) => t) });
  if (!TOOLS.some((t) => t.name === b.name)) return Response.json({ text: "There's no tool with that name." });
  try {
    // What comes back (logs, pull request comments…) is data to explain, never instructions to follow.
    return Response.json({ text: dataBlock("lookup_result", await runTool(b.name!, b.args ?? {})) });
  } catch (e) {
    return Response.json({ text: `Couldn't look that up: ${(e as Error).message}` });
  }
}
