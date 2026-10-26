/**
 * GET /api/persona — the T1 test persona from app_settings (one tap, no typing).
 * Clearly test-labelled; never presented as the traveller's own data (F12).
 */
import { userClientFrom, typedError } from "../../../lib/server/supabase";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  try {
    const db = userClientFrom(req);
    const { data, error } = await db
      .from("app_settings")
      .select("test_persona, attribution_required, primary_provider")
      .eq("id", 1)
      .maybeSingle();
    if (error) return typedError(500, "settings_error", error.message);
    return Response.json({
      persona: data?.test_persona ?? null,
      attribution: data?.attribution_required ?? "",
      primary_provider: data?.primary_provider ?? null,
    });
  } catch (err) {
    return typedError(500, "internal", err instanceof Error ? err.message : String(err));
  }
}
