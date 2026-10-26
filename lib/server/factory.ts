/**
 * lib/server/factory.ts — one wiring point for route handlers: the USER-scoped
 * client for reads (RLS), a service-role usage sink bound to the actor, and
 * the shared in-process cache store. Secrets stay inside server modules.
 */
import { userClientFrom } from "./supabase";
import { serviceClient } from "./supabase";
import { makeContext, type EngineContext } from "./engine";
import { bumpUsage } from "./audit";
import { memoryCacheStore, type CacheStore } from "./cache";

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
  const userClient = userClientFrom(req);
  const {
    data: { user: authUser },
    error,
  } = await userClient.auth.getUser();
  if (error || !authUser) {
    throw Object.assign(new Error("unauthorized"), { status: 401, code: "unauthorized" });
  }
  const user: WiredActor = {
    id: authUser.id,
    email: authUser.email ?? null,
    is_app_admin: (authUser.app_metadata?.aum_admin ?? false) === true,
  };
  const service = serviceClient();
  const ctx: EngineContext = await makeContext(userClient, usageSink(service, authUser.id), cache);
  return { ctx, user };
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
