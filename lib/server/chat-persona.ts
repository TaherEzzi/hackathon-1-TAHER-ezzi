/**
 * lib/server/chat-persona.ts — the T1 persona one-tap turn (stateless):
 * intent from the labelled seed, compute, explain in Spanish. Kept apart
 * from the sessioned chat so scripts/t1-chat-smoke.mjs keeps its contract.
 */
import { runwayCompute, type EngineContext } from "./engine";
import { explain } from "./grok";
import { HttpError } from "./http-error";

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export interface PersonaTurnResult {
  type: "runway" | "book_now";
  payload: Record<string, unknown>;
  explanation: string;
  explained_by: "grok" | "local_fallback";
  is_test_persona: true;
}

export async function personaTurn(ctx: EngineContext, card: string | null): Promise<PersonaTurnResult> {
  const p = ctx.persona;
  if (!p) throw new HttpError("no hay persona de prueba configurada", 400, "no_persona");
  const window = { start: isoDay(new Date()), end: isoDay(new Date(Date.now() + (p.route.window_days ?? 90) * 24 * 3_600_000)) };
  const intent = { origin: p.route.origin, destination: p.route.destination, window, pax: p.pax, cabin: p.route.cabin ?? "business", mode: "plan" as const };

  const computedType = "runway" as const;
  let payload = (await runwayCompute(ctx, { ...intent, card })) as unknown as Record<string, unknown>;
  payload = {
    ...payload,
    intent_confirm: { origin: intent.origin, destination: intent.destination, window, pax: intent.pax, cabin: intent.cabin, mode: intent.mode },
    card_gate: card ? null : "¿Qué tarjeta va a financiar el canje (p. ej. AMEX_ES o REVOLUT)? Sin carta no hay valor (D19).",
  };

  let explanation: string;
  let explained_by: "grok" | "local_fallback" = "grok";
  try {
    explanation = await explain(payload);
    if (!explanation?.trim()) throw new Error("empty explanation");
  } catch (error) {
    console.error("persona explain failed, using local summary", { error });
    explained_by = "local_fallback";
    explanation = summaryFromPayload(payload, computedType);
  }
  return { type: computedType, payload, explanation, explained_by, is_test_persona: true };
}

/** Deterministic Spanish fallback quoting ONLY payload numbers (never computed). */
export function summaryFromPayload(payload: Record<string, unknown>, type: "runway" | "book_now"): string {
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