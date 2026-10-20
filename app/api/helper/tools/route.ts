import { TOOLS, runTool } from "@/lib/helperTools";

export const dynamic = "force-dynamic";

// The Helper's read-only lookups, called by scripts/helper-mcp.mjs. Read-only: nothing here changes anything.
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { list?: boolean; name?: string; args?: Record<string, unknown> };
  if (b.list) return Response.json({ tools: TOOLS.map(({ doing: _d, ...t }) => t) });
  if (!TOOLS.some((t) => t.name === b.name)) return Response.json({ text: "There's no tool with that name." });
  try {
    return Response.json({ text: await runTool(b.name!, b.args ?? {}) });
  } catch (e) {
    return Response.json({ text: `Couldn't look that up: ${(e as Error).message}` });
  }
}
