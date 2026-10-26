/**
 * POST /api/chat — the F12 turn: parse (Grok) → compute (code, engine above) →
 * explain (Grok). The LLM never computes; every number in the structured
 * payload comes from the engine. The persona one-tap path builds its intent
 * from the T1 seed directly (labelled test data, no typing required).
 */
import { z } from "zod";
import { requireUser, typedError } from "../../../lib/server/supabase";
import { engineForUser } from "../../../lib/server/factory";
import { bookNowCompare, runwayCompute } from "../../../lib/server/engine";
import { parseIntent, explain, UnparsedIntent } from "../../../lib/server/grok";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(2000).optional(),
  persona: z.boolean().optional(),
  /** D19 card gate: the chat asks which card funds the trip; the traveller answers */
  card: z.string().trim().regex(/^[A-Z_]{2,12}$/).optional(),
});

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export async function POST(req: Request): Promise<Response> {
  try {
    const { user } = await requireUser(req);
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return typedError(400, "bad_request", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    const { text, persona: usePersona, card } = parsed.data;
    const { ctx } = await engineForUser(req);

    // ── step 1: PARSE (LLM) — or the T1 persona's pre-set intent (no typing) ──
    let intent;
    if (usePersona && !text) {
      const p = ctx.persona;
      if (!p) return typedError(400, "no_persona", "no hay persona de prueba configurada");
      const start = isoDay(new Date());
      const end = isoDay(new Date(Date.now() + (p.route.window_days ?? 90) * 24 * 3_600_000));
      intent = {
        origin: p.route.origin,
        destination: p.route.destination,
        window: { start, end },
        depart_date: null,
        flexibility: "medium",
        pax: p.pax,
        cabin: p.route.cabin ?? "business",
        mode: "plan",
        missing: [],
      };
    } else {
      try {
        intent = await parseIntent(text ?? "");
      } catch (err) {
        if (err instanceof UnparsedIntent) {
          // ask for the fields — never guess (F12 failure path)
          return Response.json({
            type: "unparsed_intent",
            missing: err.missing,
            explanation: "¿Desde dónde, adónde y qué fechas? Con eso te saco el cálculo — no adivino rutas.",
          });
        }
        throw err;
      }
    }

    // ── step 4 card gate: pax confirmed upstream; card asked here (D19) ───────
    const cardToUse = card ?? null;

    // ── steps 2–5: COMPUTE (code only) ────────────────────────────────────────
    let payload: Record<string, unknown>;
    let computedType: "runway" | "book_now";
    if (intent.mode === "book_now" && intent.depart_date) {
      computedType = "book_now";
      payload = (await bookNowCompare(ctx, {
        origin: intent.origin!,
        destination: intent.destination!,
        depart_date: intent.depart_date,
        cabin: intent.cabin ?? "business",
        pax: intent.pax ?? 1,
        card: cardToUse,
      })) as unknown as Record<string, unknown>;
    } else {
      computedType = "runway";
      payload = (await runwayCompute(ctx, {
        origin: intent.origin!,
        destination: intent.destination!,
        window: intent.window ?? { start: isoDay(new Date()), end: isoDay(new Date(Date.now() + 90 * 24 * 3_600_000)) },
        cabin: intent.cabin ?? "business",
        pax: intent.pax ?? 1,
        card: cardToUse,
      })) as unknown as Record<string, unknown>;
    }
    payload = { ...payload, intent_confirm: { origin: intent.origin, destination: intent.destination, window: intent.window ?? intent.depart_date, pax: intent.pax, cabin: intent.cabin, mode: intent.mode }, card_gate: cardToUse ? null : "¿Qué tarjeta va a financiar el canje (p. ej. AMEX_ES o REVOLUT)? Sin carta no hay valor (D19)." };

    // ── step 6: EXPLAIN (LLM quotes computed numbers; local fallback keeps it honest) ──
    let explanation: string;
    let explained_by: "grok" | "local_fallback" = "grok";
    try {
      explanation = await explain(payload);
      if (!explanation?.trim()) throw new Error("empty explanation");
    } catch {
      explained_by = "local_fallback";
      explanation = summaryFromPayload(payload, computedType);
    }
    return Response.json({ type: computedType, payload, explanation, explained_by, is_test_persona: usePersona === true });
  } catch (err) {
    if ((err as { status?: number }).status === 401) return typedError(401, "unauthorized", "sign in first");
    if ((err as { code?: string }).code === "provider_error") {
      const e = err as Error & { provider?: string };
      return typedError(502, "provider_error", e.message.slice(0, 400), { provider: e.provider ?? "duffel" });
    }
    return typedError(500, "internal", err instanceof Error ? err.message : String(err));
  }
}

/** Deterministic Spanish fallback quoting ONLY payload numbers (never computed). */
function summaryFromPayload(payload: Record<string, unknown>, type: "runway" | "book_now"): string {
  if (type === "book_now") {
    const v = payload.verdict ?? "insufficient_data";
    const cash = (payload.cash ?? null) as { amount?: number; currency?: string; badge?: string } | null;
    const award = (payload.award ?? null) as { miles?: number } | null;
    const reason = payload.insufficient_reason ? ` Sin cálculo: ${String(payload.insufficient_reason).slice(0, 240)}` : "";
    if (v === "insufficient_data") {
      return `No puedo darte un veredicto fiable todavía.${reason}`;
    }
    const cashTxt = cash?.amount != null ? ` El billete sale por ${cash.amount} ${cash.currency} (${cash.badge}).` : "";
    const milesTxt = award?.miles != null ? ` El canje son ${award.miles} millas + tasas.` : "";
    return `Veredicto: ${String(v).replace("_", " ")}. ${cashTxt} ${milesTxt} El desglose completo está en la tarjeta.${reason}`;
  }
  const cands = (payload.candidates ?? []) as Array<{ depart_date: string; cash?: { amount: number; currency: string } }>;
  if (cands.length === 0) {
    return `No hay tarifas en la ventana todavía. Prueba a acercar las fechas o revisa la ruta.`;
  }
  const first = cands[0];
  return `He encontrado ${cands.length} fechas candidatas. La más barata sale por ${first.cash?.amount ?? "?"} ${first.cash?.currency ?? ""} el ${first.depart_date} (${String((first.cash as { badge?: string })?.badge ?? "estimación")}). El desglose y la proyección en la tarjeta.`;
}
