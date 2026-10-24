import { MAX_FILE, addFile } from "@/lib/projectFiles";

export const dynamic = "force-dynamic";

// Projects → "Add a file": { name, base64 }. Opens a pull request that the Inbox can merge.
export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const project = (await params).name;
  const b = (await req.json().catch(() => ({}))) as { name?: string; base64?: string };
  const data = Buffer.from(String(b.base64 ?? ""), "base64");
  if (data.length > MAX_FILE) return Response.json({ error: "That file is too big. Keep it under 5 MB." }, { status: 400 });
  try {
    return Response.json(await addFile(project, b.name, data), { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
