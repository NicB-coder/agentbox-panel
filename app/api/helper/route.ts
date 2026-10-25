import { busyChat, cleanContext, outOfUsage, recoverHelper } from "@/lib/helper";
import { createChat, getChat, latestChat, listChats, listMessages } from "@/lib/helperDb";
import { suggestions } from "@/lib/helperSuggest";
import type { HelperContext, HelperState } from "@/lib/helperTypes";

export const dynamic = "force-dynamic";

let recovered = false;

function state(chatId?: number | null): HelperState {
  if (!recovered) {
    recovered = true;
    recoverHelper();
  }
  const chat = chatId ? getChat(chatId) : latestChat();
  return { chat, messages: chat ? listMessages(chat.id) : [], chats: listChats(), outOfUsage: outOfUsage() };
}

// The conversation the bubble shows (the latest one, unless a chat is picked).
// ?ctx= (where Nic is) picks the suggested questions.
export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = Number(q.get("chat"));
  let ctx: HelperContext = { path: "/", errors: [] };
  try {
    ctx = cleanContext(JSON.parse(q.get("ctx") ?? "{}"));
  } catch {
    /* defaults */
  }
  // Just the suggested questions (when a panel opens or closes while the chat is open).
  if (q.get("only") === "suggestions") return Response.json({ suggestions: suggestions(ctx) });
  const picked = Number.isInteger(id) && id > 0 ? id : null;
  if (picked && !getChat(picked)) return Response.json({ error: "That conversation isn't here any more." }, { status: 404 });
  return Response.json({ ...state(picked), suggestions: suggestions(ctx) });
}

// New chat: starts fresh (the old ones are kept, up to 20; a chat that's still answering is never removed).
export function POST() {
  const cur = latestChat();
  // Don't pile up empty chats.
  if (cur && listMessages(cur.id, 1).length === 0) return Response.json(state(cur.id));
  const chat = createChat((id) => !!busyChat(id));
  return Response.json(state(chat.id), { status: 201 });
}
