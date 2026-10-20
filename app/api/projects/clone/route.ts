import { cloneRepo } from "@/lib/projectsAdmin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { repo } = (await req.json().catch(() => ({}))) as { repo?: string };
  try {
    return Response.json({ name: await cloneRepo(String(repo ?? "")) }, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
