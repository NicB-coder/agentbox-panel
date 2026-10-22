import fs from "node:fs";
import path from "node:path";
import { shotFiles, takeShots } from "@/lib/changes";

export const dynamic = "force-dynamic";

const ok = (s: string | null) => !!s && /^[\w.~-]+$/.test(s);

function args(req: Request) {
  const q = new URL(req.url).searchParams;
  const project = q.get("project");
  const before = q.get("before");
  const after = q.get("after");
  const page = q.get("page") ?? "";
  if (!ok(project) || !ok(before) || !ok(after) || page.includes("..")) return null;
  return { project: project!, before: before!, after: after!, page };
}

// GET ?…&name=after-phone → the picture. GET without name → whether they're ready. POST → take them.
export async function GET(req: Request) {
  const a = args(req);
  if (!a) return Response.json({ error: "Bad request." }, { status: 400 });
  const f = shotFiles(a.project, a.before, a.after, a.page);
  const name = new URL(req.url).searchParams.get("name");
  if (!name) return Response.json({ ready: f.ready });
  if (!f.names.includes(name)) return Response.json({ error: "No such picture." }, { status: 404 });
  const file = path.join(f.dir, `${name}.png`);
  if (!fs.existsSync(file)) return Response.json({ error: "Not taken yet." }, { status: 404 });
  return new Response(new Uint8Array(fs.readFileSync(file)), { headers: { "content-type": "image/png", "cache-control": "max-age=3600" } });
}

export async function POST(req: Request) {
  const a = args(req);
  if (!a) return Response.json({ error: "Bad request." }, { status: 400 });
  const done = await takeShots(a.project, a.before, a.after, a.page, Number(process.env.PORT || 3000));
  return done ? Response.json({ ready: true }) : Response.json({ error: "Couldn't take the pictures this time." }, { status: 500 });
}
