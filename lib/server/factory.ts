/**
 * lib/server/factory.ts — one wiring point for route handlers: the USER-scoped
 * client for reads (RLS), a service-role usage sink bound to the actor, and
 * the shared in-process cache store. Secrets stay inside server modules.
 */
import { requireUser, serviceClient } from "./supabase";
import { makeContext, type EngineContext } from "./engine";
import { bumpUsage } from "./audit";
import { memoryCacheStore, type CacheStore } from "./cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

export interface WiredActor {
  id: string;
  email: string | null;
  is_app_admin: boolean;
}

export interface WiredEngine {
  ctx: EngineContext;
  user: WiredActor;
}

/** Build the engine context for an authenticated call: RLS reads + usage sink. */
export async function engineForUser(req: Request, cache: CacheStore = memoryCacheStore()): Promise<WiredEngine> {
  const { user, client: userClient } = await requireUser(req);
  return { ctx: await engineForActor(user, userClient, cache), user };
}

/** Same wiring for a caller whose identity a route already checked (no second auth round trip). */
export async function engineForActor(user: WiredActor, userClient: SupabaseClient<Database>, cache: CacheStore = memoryCacheStore()): Promise<EngineContext> {
  return makeContext(userClient, usageSink(serviceClient(), user.id), cache);
}

/** Every FRESH provider roundtrip appends to `usage` (service role, Europe/Madrid day). */
export function usageSink(service: ReturnType<typeof serviceClient>, userId: string) {
  return async (provider: string): Promise<void> => {
    const res = await bumpUsage(service, { user_id: userId, provider });
    if (!res.ok) {
      // usage is observability, not the product path — record-and-log, never raise
      console.error(JSON.stringify({ usage_write_failed: provider }));
    }
  };
}
