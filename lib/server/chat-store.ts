/**
 * lib/server/chat-store.ts — chat_sessions / chat_messages persistence.
 * Writes use the service role (the assistant payload is engine output, never
 * client-minted); every write is scoped by user_id so one traveller can never
 * append to another's thread. Reads for the page ride the caller's RLS client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../database.types";
import { readSlots, type ChatSlots } from "./chat-slots";
import type { ChatHistoryMessage } from "./chat-turn";
import { HttpError } from "./http-error";

type Client = SupabaseClient<Database>;

export class ChatStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ChatStoreError";
  }
}

export interface OpenSession {
  id: string;
  title: string | null;
  slots: ChatSlots;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  payload: Json | null;
  itinerary_id: string | null;
  created_at: string;
}

const THREAD_LIMIT = 200;

function fail(action: string, context: Record<string, unknown>, error: { message: string }): never {
  console.error(`chat store ${action} failed`, { ...context, error: error.message });
  throw new ChatStoreError(`chat store ${action} failed`, { cause: error });
}

/** Load the caller's session, or start a new one when no id is given. */
export async function openSession(service: Client, userId: string, sessionId?: string): Promise<OpenSession> {
  if (sessionId) {
    const { data, error } = await service
      .from("chat_sessions")
      .select("id, title, slots")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) fail("session read", { sessionId }, error);
    if (!data) throw new HttpError("chat session not found", 404, "session_not_found");
    return { id: data.id, title: data.title, slots: readSlots(data.slots) };
  }
  const { data, error } = await service.from("chat_sessions").insert({ user_id: userId }).select("id, title, slots").single();
  if (error) fail("session create", { userId }, error);
  return { id: data.id, title: data.title, slots: readSlots(data.slots) };
}

export async function recentMessages(service: Client, sessionId: string, limit: number): Promise<ChatHistoryMessage[]> {
  const { data, error } = await service
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("history read", { sessionId }, error);
  return (data ?? [])
    .reverse()
    .filter((m): m is ChatHistoryMessage => m.role === "user" || m.role === "assistant");
}

export async function appendMessage(
  service: Client,
  row: { session_id: string; user_id: string; role: "user" | "assistant"; content: string; payload?: Json | null; itinerary_id?: string | null },
): Promise<void> {
  const { error } = await service.from("chat_messages").insert({ ...row, content: row.content.slice(0, 8000) });
  if (error) fail("message write", { sessionId: row.session_id, role: row.role }, error);
}

export async function saveSessionState(service: Client, session: { id: string; userId: string; slots: ChatSlots; title: string | null }): Promise<void> {
  const { error } = await service
    .from("chat_sessions")
    .update({ slots: session.slots as unknown as Json, title: session.title })
    .eq("id", session.id)
    .eq("user_id", session.userId);
  if (error) fail("session update", { sessionId: session.id }, error);
}

export async function listSessions(client: Client, limit: number): Promise<Array<{ id: string; title: string | null; updated_at: string }>> {
  const { data, error } = await client
    .from("chat_sessions")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) fail("session list", {}, error);
  return data ?? [];
}

export async function sessionThread(client: Client, sessionId: string): Promise<{ session: OpenSession; messages: StoredMessage[] }> {
  const { data: session, error } = await client.from("chat_sessions").select("id, title, slots").eq("id", sessionId).maybeSingle();
  if (error) fail("thread session read", { sessionId }, error);
  if (!session) throw new HttpError("chat session not found", 404, "session_not_found");
  const { data: messages, error: msgError } = await client
    .from("chat_messages")
    .select("id, role, content, payload, itinerary_id, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(THREAD_LIMIT);
  if (msgError) fail("thread messages read", { sessionId }, msgError);
  return {
    session: { id: session.id, title: session.title, slots: readSlots(session.slots) },
    messages: (messages ?? []).filter((m): m is StoredMessage => m.role === "user" || m.role === "assistant"),
  };
}
