import { cleanContext, sendMessage } from "@/lib/helper";
import { createChat, getChat } from "@/lib/helperDb";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { chatId?: number; text?: string; context?: unknown };
  const text = String(b.text ?? "").trim();
  if (!text) return Response.json({ error: "Type a question first." }, { status: 400 });
  if (text.length > 4000) return Response.json({ error: "That's a lot! Keep it under 4,000 characters." }, { status: 400 });
  const chat = (b.chatId && getChat(b.chatId)) || createChat();
  try {
    const out = sendMessage(chat.id, text, cleanContext(b.context));
    return Response.json({ chatId: chat.id, ...out }, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409 });
  }
}
