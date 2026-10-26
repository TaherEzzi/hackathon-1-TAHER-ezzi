/**
 * GET /api/admin — gate on the app_metadata claim (`aum_admin`), which users
 * cannot self-edit (core_schema is_app_admin predicate). Returns the day's
 * aggregate counts + settings + a short audit tail. No writes to app_settings
 * are exposed in v1 (D15/D17 open). Non-admins get 403 with a typed body.
 */
import { requireUser, typedError, serviceClient } from "../../../lib/server/supabase";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  try {
    const { user } = await requireUser(req);
    if (!user.is_app_admin) {
      return typedError(403, "not_admin", "esta vista es solo para administración");
    }
    const service = serviceClient();
    // Europe/Madrid local day (same boundary the usage table defaults to)
    const madridToday = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }),
    ).toISOString().slice(0, 10);

    const [usageToday, itinerariesToday, savedTotal, auditTail, settings] = await Promise.all([
      service.from("usage").select("provider, calls").eq("day", madridToday),
      service.from("itineraries").select("id, verdict, is_test_persona").gte("created_at", `${madridToday}T00:00:00Z`).eq("is_test_persona", false),
      service.from("itineraries").select("id").gte("created_at", `${madridToday}T00:00:00Z`),
      service.from("audit_log").select("action, entity, created_at").order("created_at", { ascending: false }).limit(20),
      service.from("app_settings").select("*").eq("id", 1).maybeSingle(),
    ]);

    const err = [usageToday.error, itinerariesToday.error, savedTotal.error, auditTail.error, settings.error].find(Boolean);
    if (err) return typedError(500, "admin_query", err.message);

    // one aggregate per metric (F10), done in memory over thin day rows
    const providerCalls: Record<string, number> = {};
    for (const r of usageToday.data ?? []) providerCalls[r.provider] = (providerCalls[r.provider] ?? 0) + r.calls;

    const verdicts: Record<string, number> = {};
    for (const r of itinerariesToday.data ?? []) { const k = r.verdict ?? "unknown"; verdicts[k] = (verdicts[k] ?? 0) + 1; }

    return Response.json({
      day: madridToday,
      totals: {
        provider_calls: providerCalls,
        itineraries_runs: (savedTotal.data ?? []).length,
        verdicts: verdicts,
      },
      settings: settings.data
        ? {
            primary_provider: settings.data.primary_provider,
            daily_request_cap: settings.data.daily_request_cap,
            max_horizon_days: settings.data.max_horizon_days,
            cache_max_age_hours: settings.data.cache_max_age_hours,
            stripe_price_id: settings.data.stripe_price_id,
            attribution_required: settings.data.attribution_required,
          }
        : null,
      audit_tail: auditTail.data ?? [],
    });
  } catch (err) {
    if ((err as { status?: number }).status === 401) return typedError(401, "unauthorized", "sign in first");
    return typedError(500, "internal", err instanceof Error ? err.message : String(err));
  }
}
