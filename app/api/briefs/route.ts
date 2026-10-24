import fs from "node:fs";
import path from "node:path";
import { isBriefFile, storeBrief } from "@/lib/briefs";
import { projectPath } from "@/lib/projects";

export const dynamic = "force-dynamic";

// Attach a brief: an uploaded file ({ name, text }) or one picked from a project ({ project, file }).
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { name?: string; text?: string; project?: string; file?: string };
  try {
    if (b.project && b.file) {
      const root = projectPath(b.project);
      const full = root ? path.resolve(root, b.file) : "";
      if (!root || !full.startsWith(root + path.sep) || !isBriefFile(full) || !fs.existsSync(full)) return Response.json({ error: "Can't open that file." }, { status: 404 });
      return Response.json(storeBrief(path.basename(full), fs.readFileSync(full, "utf8")), { status: 201 });
    }
    return Response.json(storeBrief(b.name, b.text), { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
