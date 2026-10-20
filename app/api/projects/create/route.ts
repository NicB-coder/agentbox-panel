import { createRepo } from "@/lib/projectsAdmin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { name, description } = (await req.json().catch(() => ({}))) as { name?: string; description?: string };
  try {
    return Response.json({ name: await createRepo(String(name ?? ""), String(description ?? "")) }, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
