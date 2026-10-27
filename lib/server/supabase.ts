/**
 * lib/server/supabase.ts — client factories.
 * - serviceClient(): supabase_secret_key — ONLY inside server routes, engine
 *   writes (RLS-bypassing) and admin aggregation. Never import anywhere client-side.
 * - userClientFrom(req): publishable key + the caller's own bearer token — reads ride RLS.
 * Secrets never appear in responses or logs.
 */
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { createServerSupabaseClient } from "../supabase/server";
import { isUnauthorized, unauthorized } from "./http-error";

function missing(name: string): never {
  throw new Error(`server misconfiguration: ${name} missing from environment`);
}

export function env(): { url: string; publishable: string; service: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const service = process.env.supabase_secret_key;
  if (!url) missing("NEXT_PUBLIC_SUPABASE_URL");
  if (!publishable) missing("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!service) missing("supabase_secret_key");
  return { url, publishable, service };
}

export function serviceClient(): SupabaseClient<Database> {
  const { url, service } = env();
  return createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function userClientFrom(req: Request): SupabaseClient<Database> {
  const { url, publishable } = env();
  const bearer = req.headers.get("authorization") ?? "";
  return createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: bearer ? { Authorization: bearer } : {} },
  });
}

export interface Actor {
  id: string;
  email: string | null;
  is_app_admin: boolean;
}

function isAppAdmin(metadata: User["app_metadata"]): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  return (metadata as Record<string, unknown>).aum_admin === true;
}

function actorFromUser(user: User): Actor {
  return {
    id: user.id,
    email: user.email ?? null,
    is_app_admin: isAppAdmin(user.app_metadata),
  };
}

/** Validate identity via Bearer token (API clients) or Supabase Auth cookies (browser). */
export async function requireUser(req: Request): Promise<{ user: Actor; client: SupabaseClient<Database> }> {
  const bearer = req.headers.get("authorization")?.trim() ?? "";
  if (/^Bearer\s+\S+/i.test(bearer)) {
    const client = userClientFrom(req);
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user) unauthorized();
    return { user: actorFromUser(user), client };
  }

  const client = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) unauthorized();
  return { user: actorFromUser(user), client };
}

/** Session lookup without throwing — for optional UI endpoints. */
export async function optionalUser(req: Request): Promise<{ user: Actor; client: SupabaseClient<Database> } | null> {
  try {
    return await requireUser(req);
  } catch (error) {
    if (isUnauthorized(error)) return null;
    throw error;
  }
}

/** RFC-7807-ish typed error response — never silent, never a raw stack, never a secret. */
export function typedError(status: number, code: string, message: string, extra?: Record<string, unknown>): Response {
  return Response.json({ error: { code, message, ...extra } }, { status });
}
