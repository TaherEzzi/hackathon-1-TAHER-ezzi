/**
 * /api/wallet — the user's loyalty balances. CRUD rides the CALLER's own
 * client (RLS: select/insert/update/delete own rows only). The balance sanity
 * ceiling runs through lib/engine sanitizeBalance — the DB CHECK is its
 * enforcement backstop; is_test_persona stays server-owned (never user-set).
 */
import { z } from "zod";
import { requireUser, typedError } from "../../../lib/server/supabase";
import { sanitizeBalance } from "../../../lib/engine/verdict.mjs";

export const runtime = "nodejs";

const upsertBody = z.object({
  program_code: z.string().trim().regex(/^[A-Z_]{2,12}$/),
  balance: z.number().int().min(0),
  account_age_days: z.number().int().min(0).optional(),
});

async function resolveProgram(db: Awaited<ReturnType<typeof requireUser>>["client"], code: string) {
  const { data, error } = await db.from("programs").select("id").eq("code", code).maybeSingle();
  if (error || !data) return null;
  return data.id;
}

export async function GET(req: Request): Promise<Response> {
  try {
    const { client } = await requireUser(req);
    const { data, error } = await client
      .from("wallet_balances")
      .select("id, balance, account_age_days, updated_at, programs(code, name, currency_name)")
      .order("updated_at", { ascending: false });
    if (error) return typedError(500, "wallet_read", error.message);
    return Response.json({ wallet: data ?? [] });
  } catch (err) {
    if ((err as { status?: number }).status === 401) return typedError(401, "unauthorized", "sign in first");
    return typedError(500, "internal", err instanceof Error ? err.message : String(err));
  }
}

export async function PUT(req: Request): Promise<Response> {
  try {
    const { client, user } = await requireUser(req);
    const parsed = upsertBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return typedError(400, "bad_request", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    const body = parsed.data;
    const checked = sanitizeBalance(body.balance); // engine guard before the write
    const programId = await resolveProgram(client, body.program_code);
    if (!programId) return typedError(400, "unknown_program", `programa ${body.program_code} no existe en el pack`);
    const { error } = await client.from("wallet_balances").upsert(
      {
        user_id: user.id,
        program_id: programId,
        balance: checked,
        account_age_days: body.account_age_days ?? null,
      },
      { onConflict: "user_id,program_id" },
    );
    if (error) return typedError(400, "wallet_write", error.message);
    return Response.json({ ok: true });
  } catch (err) {
    if ((err as { code?: string } | null)?.code && (err as Error).message) return typedError(400, "balance_invalid", (err as Error).message);
    if ((err as { status?: number }).status === 401) return typedError(401, "unauthorized", "sign in first");
    return typedError(500, "internal", err instanceof Error ? err.message : String(err));
  }
}

export async function DELETE(req: Request): Promise<Response> {
  try {
    const { client, user } = await requireUser(req);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return typedError(400, "bad_request", "id requerido");
    const { error } = await client.from("wallet_balances").delete().eq("id", id).eq("user_id", user.id);
    if (error) return typedError(400, "wallet_delete", error.message);
    return Response.json({ ok: true });
  } catch (err) {
    if ((err as { status?: number }).status === 401) return typedError(401, "unauthorized", "sign in first");
    return typedError(500, "internal", err instanceof Error ? err.message : String(err));
  }
}
