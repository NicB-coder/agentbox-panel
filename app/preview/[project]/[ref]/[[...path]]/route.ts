import { previewDir, previewFile } from "@/lib/preview";

export const dynamic = "force-dynamic";

// /preview/arcade/live/snake.html → the project's file, from a fresh read-only copy of its branch.
export async function GET(req: Request, { params }: { params: Promise<{ project: string; ref: string; path?: string[] }> }) {
  const { project, ref, path = [] } = await params;
  // Without a trailing slash, relative links in the page would point one folder too high.
  const pathname = new URL(req.url).pathname;
  if (path.length === 0 && !pathname.endsWith("/")) return new Response(null, { status: 308, headers: { location: `${pathname}/` } });
  const root = await previewDir(project, ref);
  if (!root) return new Response(page("This project has nothing to preview", "There's no index.html in it (or it needs building first). Previews work for plain websites and games."), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  const f = previewFile(root, path.join("/"));
  if (!f) return new Response(page("Not found", "That page isn't in this project."), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  return new Response(new Uint8Array(f.body), { headers: { "content-type": f.type, "cache-control": "no-store" } });
}

function page(title: string, text: string) {
  return `<!doctype html><meta name=viewport content="width=device-width"><title>${title}</title><body style="font-family:system-ui;padding:40px;color:#15171B"><h1 style="font-size:24px">${title}</h1><p style="color:#555A63">${text}</p><p><a href="/projects">Back to Projects</a></p>`;
}
