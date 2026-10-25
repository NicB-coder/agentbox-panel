import { db } from "./db";
import type { HelperChat, HelperMessage, HelperMeta } from "./helperTypes";

// Saved Helper conversations. Kept in SQLite so they survive reloads and work on the laptop and phone.

const KEEP = 20;

type ChatRow = { id: number; title: string; created_at: number; updated_at: number };
type MsgRow = { id: number; chat_id: number; role: string; text: string; status: string; meta: string; created_at: number };

const toChat = (r: ChatRow): HelperChat => ({ id: r.id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at });
const toMsg = (r: MsgRow): HelperMessage => ({
  id: r.id, chatId: r.chat_id, role: r.role as HelperMessage["role"], text: r.text, status: r.status as HelperMessage["status"],
  meta: JSON.parse(r.meta || "{}") as HelperMeta, createdAt: r.created_at,
});

export function listChats(): HelperChat[] {
  return (db().prepare("SELECT * FROM helper_chats ORDER BY updated_at DESC, id DESC LIMIT ?").all(KEEP) as ChatRow[]).map(toChat);
}

export function getChat(id: number): HelperChat | null {
  const r = db().prepare("SELECT * FROM helper_chats WHERE id = ?").get(id) as ChatRow | undefined;
  return r ? toChat(r) : null;
}

// The conversation the bubble opens on: the one used most recently, on any device.
export function latestChat(): HelperChat | null {
  const r = db().prepare("SELECT * FROM helper_chats ORDER BY updated_at DESC, id DESC LIMIT 1").get() as ChatRow | undefined;
  return r ? toChat(r) : null;
}

export function createChat(busy?: (chatId: number) => boolean): HelperChat {
  const now = Date.now();
  const id = db().prepare("INSERT INTO helper_chats (title, created_at, updated_at) VALUES ('', ?, ?)").run(now, now).lastInsertRowid as number;
  prune(busy);
  return getChat(id)!;
}

// Keep the last 20 conversations. A chat that's still answering is never removed, however old it is:
// its reply keeps going and is saved, and it's cleaned up on a later pass once it's idle.
export function prune(busy: (chatId: number) => boolean = () => false) {
  const old = db().prepare("SELECT id FROM helper_chats ORDER BY updated_at DESC, id DESC LIMIT -1 OFFSET ?").all(KEEP) as { id: number }[];
  const streaming = db().prepare("SELECT 1 FROM helper_messages WHERE chat_id = ? AND status = 'streaming' LIMIT 1");
  for (const { id } of old) {
    if (busy(id) || streaming.get(id)) continue;
    db().prepare("DELETE FROM helper_messages WHERE chat_id = ?").run(id);
    db().prepare("DELETE FROM helper_chats WHERE id = ?").run(id);
  }
}

export function touchChat(id: number, title?: string) {
  if (title) db().prepare("UPDATE helper_chats SET updated_at = ?, title = CASE WHEN title = '' THEN ? ELSE title END WHERE id = ?").run(Date.now(), title, id);
  else db().prepare("UPDATE helper_chats SET updated_at = ? WHERE id = ?").run(Date.now(), id);
}

export function listMessages(chatId: number, limit = 200): HelperMessage[] {
  const rows = db().prepare("SELECT * FROM helper_messages WHERE chat_id = ? ORDER BY id DESC LIMIT ?").all(chatId, limit) as MsgRow[];
  return rows.reverse().map(toMsg);
}

export function getMessage(id: number): HelperMessage | null {
  const r = db().prepare("SELECT * FROM helper_messages WHERE id = ?").get(id) as MsgRow | undefined;
  return r ? toMsg(r) : null;
}

export function addMessage(m: { chatId: number; role: HelperMessage["role"]; text: string; status?: HelperMessage["status"]; meta?: HelperMeta }): HelperMessage {
  const id = db()
    .prepare("INSERT INTO helper_messages (chat_id, role, text, status, meta, created_at) VALUES (?,?,?,?,?,?)")
    .run(m.chatId, m.role, m.text, m.status ?? "done", JSON.stringify(m.meta ?? {}), Date.now()).lastInsertRowid as number;
  touchChat(m.chatId);
  return getMessage(id)!;
}

export function updateMessage(id: number, patch: Partial<Pick<HelperMessage, "text" | "status" | "meta">>) {
  const cur = getMessage(id);
  if (!cur) return;
  const next = { ...cur, ...patch };
  db().prepare("UPDATE helper_messages SET text = ?, status = ?, meta = ? WHERE id = ?").run(next.text, next.status, JSON.stringify(next.meta), id);
}

export function streamingMessages(): HelperMessage[] {
  return (db().prepare("SELECT * FROM helper_messages WHERE status = 'streaming'").all() as MsgRow[]).map(toMsg);
}

// Nic's message with this browser send id, if it already arrived.
export function findByClientId(clientId: string): HelperMessage | null {
  const r = db().prepare("SELECT * FROM helper_messages WHERE role = 'user' AND json_extract(meta, '$.clientId') = ? ORDER BY id DESC LIMIT 1").get(clientId) as MsgRow | undefined;
  return r ? toMsg(r) : null;
}
