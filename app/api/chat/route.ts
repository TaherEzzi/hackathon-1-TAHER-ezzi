/**
 * /api/chat — the sessioned chat agent.
 * POST { session_id?, text } runs one turn: load the session's memory, let
 * Grok answer or gather facts, compute with the engine once the facts are
 * complete, save the trip, and return plan_url for the plan page.
 * POST { persona: true } keeps the stateless T1 one-tap turn.
 * GET lists the caller's sessions, or one thread with ?session_id=.
 * DELETE ?session_id= removes a thread (RLS: own rows).
 */
import { z } from "zod";
import { requireUser, serviceClient, typedError } from "../../../lib/server/supabase";
import { engineForActor } from "../../../lib/server/factory";
import { bookNowCompare, runwayCompute, type EngineContext } from "../../../lib/server/engine";
import { chatTurn, explainFacts } from "../../../lib/server/grok";
import { runChatTurn } from "../../../lib/server/chat-turn";
import { appendMessage, listSessions, openSession, recentMessages, saveSessionState, sessionThread } from "../../../lib/server/chat-store";
import { insertItinerary } from "../../../lib/server/itinerary-store";
import { personaTurn } from "../../../lib/server/chat-persona";
import { HttpError } from "../../../lib/server/http-error";
import type { Json } from "../../../lib/database.types";

export const runtime = "nodejs";

const HISTORY_FOR_MODEL = 20;
const SESSION_LIST_LIMIT = 20;

const bodySchema = z.object({
  session_id: z.string().uuid().optional(),
  text: z.string().trim().min(1).max(2000).optional(),
  persona: z.boolean().optional(),
  /** D19 card gate for the persona one-tap turn */
  card: z.string().trim().regex(/^[A-Z_]{2,12}$/).optional(),
});

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

interface RouteError {
  status: number;
  code: string;
  message: string;
  extra?: Record<string, unknown>;
}

function classify(err: unknown): RouteError {
  if (err instanceof HttpError) return { status: err.status, code: err.code, message: err.message };
  if ((err as { status?: number }).status === 401) return { status: 401, code: "unauthorized", message: "sign in first" };
  if ((err as { code?: string }).code === "provider_error") {
    const e = err as Error & { provider?: string };
    return { status: 502, code: "provider_error", message: e.message.slice(0, 400), extra: { provider: e.provider ?? "duffel" } };
  }
  console.error("chat route failed", { error: err });
  return { status: 500, code: "internal", message: err instanceof Error ? err.message : String(err) };
}

function errorResponse(err: unknown): Response {
  const e = classify(err);
  return typedError(e.status, e.code, e.message, e.extra);
}

export async function POST(req: Request): Promise<Response> {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return typedError(400, "bad_request", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    const { user, client } = await requireUser(req);
    const { session_id, text, persona, card } = parsed.data;

    if (persona && !text) return Response.json(await personaTurn(await engineForActor(user, client), card ?? null));
    if (!text) return typedError(400, "bad_request", "text: required");

    // Answer-only turns never touch the engine, so its context is built on first use.
    let ctxPromise: Promise<EngineContext> | null = null;
    const engine = () => (ctxPromise ??= engineForActor(user, client));

    const service = serviceClient();
    const session = await openSession(service, user.id, session_id);
    const history = await recentMessages(service, session.id, HISTORY_FOR_MODEL);
    await appendMessage(service, { session_id: session.id, user_id: user.id, role: "user", content: text });

    let outcome;
    try {
      outcome = await runChatTurn(
        {
          userId: user.id,
          today: isoDay(new Date()),
          model: chatTurn,
          runway: async (input) => runwayCompute(await engine(), input),
          bookNow: async (input) => bookNowCompare(await engine(), input),
          explain: explainFacts,
          save: (row) => insertItinerary(service, row, "chat"),
        },
        { slots: session.slots, history, text },
      );
    } catch (err) {
      const failure = classify(err);
      const note = "I could not finish that just now. Your details are kept — send the message again to retry.";
      try {
        await appendMessage(service, { session_id: session.id, user_id: user.id, role: "assistant", content: note });
      } catch (noteError) {
        console.error("chat failure note not stored", { sessionId: session.id, error: noteError });
      }
      return Response.json(
        { error: { code: failure.code, message: failure.message, ...failure.extra }, session_id: session.id, reply: note },
        { status: failure.status },
      );
    }

    await Promise.all([
      appendMessage(service, {
        session_id: session.id,
        user_id: user.id,
        role: "assistant",
        content: outcome.reply,
        payload: outcome.payload as Json | null,
        itinerary_id: outcome.itinerary_id,
      }),
      saveSessionState(service, { id: session.id, userId: user.id, slots: outcome.slots, title: session.title ?? text.slice(0, 80) }),
    ]);

    return Response.json({
      session_id: session.id,
      type: outcome.kind,
      reply: outcome.reply,
      missing: outcome.missing,
      slots: outcome.slots,
      payload: outcome.payload,
      itinerary_id: outcome.itinerary_id,
      plan_url: outcome.plan_url,
      explained_by: outcome.explained_by,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET(req: Request): Promise<Response> {
  try {
    const { client } = await requireUser(req);
    const sessionId = new URL(req.url).searchParams.get("session_id");
    if (!sessionId) return Response.json({ sessions: await listSessions(client, SESSION_LIST_LIMIT) });
    if (!z.string().uuid().safeParse(sessionId).success) return typedError(400, "bad_request", "session_id must be a uuid");
    return Response.json(await sessionThread(client, sessionId));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request): Promise<Response> {
  try {
    const { client, user } = await requireUser(req);
    const sessionId = new URL(req.url).searchParams.get("session_id");
    if (!sessionId || !z.string().uuid().safeParse(sessionId).success) return typedError(400, "bad_request", "session_id must be a uuid");
    const { error } = await client.from("chat_sessions").delete().eq("id", sessionId).eq("user_id", user.id);
    if (error) {
      console.error("chat session delete failed", { sessionId, error: error.message });
      return typedError(400, "chat_delete", error.message);
    }
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
