import fs from "node:fs";
import path from "node:path";
import { projectPath } from "@/lib/projects";

export const dynamic = "force-dynamic";

const SKIP = new Set(["node_modules", ".git", ".next", ".next-dev", "dist", "build", "out", ".agentbox", "vendor", ".venv"]);

// Brief files Nic can attach from a project: Markdown and text files, newest first.
function list(root: string): { file: string; mtime: number; size: number }[] {
  const out: { file: string; mtime: number; size: number }[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 3 || out.length > 300) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (/\.(md|markdown|txt)$/i.test(e.name)) {
        const st = fs.statSync(p);
        if (st.size < 400_000) out.push({ file: path.relative(root, p), mtime: st.mtimeMs, size: st.size });
      }
    }
  };
  walk(root, 0);
  return out.sort((a, b) => b.mtime - a.mtime).slice(0, 100);
}

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const root = projectPath((await params).name);
  if (!root) return Response.json({ error: "Can't find that project on this Mac." }, { status: 404 });
  const file = new URL(req.url).searchParams.get("file");
  if (!file) return Response.json({ files: list(root) });
  const full = path.resolve(root, file);
  if (!full.startsWith(root + path.sep) || !/\.(md|markdown|txt)$/i.test(full) || !fs.existsSync(full)) return Response.json({ error: "Can't open that file." }, { status: 404 });
  return Response.json({ name: path.basename(full), text: fs.readFileSync(full, "utf8").slice(0, 400_000) });
}
