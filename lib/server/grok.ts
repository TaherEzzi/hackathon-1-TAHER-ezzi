/**
 * lib/server/grok.ts — the LLM's ONLY two jobs (F12 binding, F12 division of
 * labour): 1) parse the traveller's intent into structure, 2) explain the
 * engine's computed payload in plain Spanish. The LLM never produces a number.
 */
import OpenAI from "openai";
import { z } from "zod";
import { priceBadge, ProviderError } from "../engine/verdict.mjs";
import type { CacheStore } from "./cache";
import type { FareEstimate } from "./fare-estimate";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  const key = process.env.grok_api_key;
  if (!key) throw Object.assign(new Error("server misconfiguration: grok_api_key missing"), { status: 500, code: "llm_config" });
  if (!client) {
    client = new OpenAI({ apiKey: key, baseURL: "https://api.x.ai/v1", timeout: 30_000 });
  }
  return client;
}

/** D18: short structured outputs; model overridable per env without redeploy. */
const MODEL = process.env.grok_model ?? "grok-3-mini";

export class UnparsedIntent extends Error {
  missing: string[];
  code: "unparsed_intent";
  constructor(missing: string[]) {
    super(`unparsed_intent: missing ${missing.join(", ")}`);
    this.name = "UnparsedIntent";
    this.missing = missing;
    this.code = "unparsed_intent";
  }
}

export interface ParsedIntent {
  origin: string | null;
  destination: string | null;
  /** "en ~3 meses" → None until dates are confirmed; book_now is exact-date */
  window: { start: string; end: string } | null;
  depart_date: string | null;
  flexibility: "none" | "low" | "medium" | "high" | null;
  pax: number | null;
  cabin: "economy" | "premium" | "business" | "first" | null;
  mode: "plan" | "book_now" | null;
}

const INTENT_SCHEMA = z.object({
  origin: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase()).nullable().optional(),
  destination: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase()).nullable().optional(),
  window: z.object({ start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).nullable().optional(),
  depart_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  flexibility: z.enum(["none", "low", "medium", "high"]).nullable().optional(),
  pax: z.number().int().min(0).max(99).nullable().optional(),
  cabin: z.enum(["economy", "premium", "business", "first"]).nullable().optional(),
  mode: z.enum(["plan", "book_now"]).nullable().optional(),
});

async function chatJson(system: string, user: string, maxTokens = 400): Promise<Record<string, unknown>> {
  const completion = await getClient().chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.1,
    max_tokens: maxTokens,
    response_format: { type: "json_object" as const },
  });
  const raw = completion.choices[0]?.message?.content ?? "";
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** The parse step. Missing origin/destination/window ⇒ UnparsedIntent (ask, never guess). */
export async function parseIntent(text: string): Promise<ParsedIntent & { missing: string[] }> {
  const system =
    "Eres el parser de intención de una app de puntos y millas para España. Devuelve SOLO JSON con las claves: " +
    "origin (IATA 3 letras), destination (IATA 3 letras), window {start,end ISO} o null, depart_date ISO o null, " +
    "flexibility 'none'|'low'|'medium'|'high'|null, pax (entero) o null, cabin 'economy'|'premium'|'business'|'first'|null, " +
    "mode 'plan'|'book_now'. NUNCA adivines: lo que el mensaje no diga va en null.";
  const out = await chatJson(system, text);
  const parsed = INTENT_SCHEMA.safeParse(out);
  if (!parsed.success) {
    throw new UnparsedIntent(["origin/destination/dates illegible"]);
  }
  const p = parsed.data;
  const missing: string[] = [];
  if (!p.origin) missing.push("origen");
  if (!p.destination) missing.push("destino");
  if (!p.depart_date && !p.window) missing.push("fechas");
  if (missing.length > 0) throw new UnparsedIntent(missing);
  return {
    origin: p.origin ?? null,
    destination: p.destination ?? null,
    window: p.window ?? null,
    depart_date: p.depart_date ?? null,
    flexibility: p.flexibility ?? null,
    pax: p.pax ?? null,
    cabin: p.cabin ?? null,
    mode: (p.depart_date ? p.mode ?? "book_now" : p.mode ?? "plan"),
    missing,
  };
}

/** The explain step: plain Spanish quoting the payload's numbers — never producing any. */
export async function explain(payload: Record<string, unknown>): Promise<string> {
  const system =
    "Eres el agente de A Una Milla. Explica en español llano, 2–4 frases, el resultado de abajo. " +
    "Cita ÚNICAMENTE los números que aparecen en el JSON; jamás calcules, redondees ni estimes ninguno. " +
    "Si el veredicto es insufficient_data, explica qué falta con honestidad y qué haría falta para calcularlo. " +
    "Nunca digas «garantizado» ni «confirmado».";
  const completion = await getClient().chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(payload).slice(0, 6_000) },
    ],
    temperature: 0.4,
    max_tokens: 350,
  });
  return completion.choices[0]?.message?.content ?? "";
}

const ESTIMATE_SCHEMA = z.object({
  cash: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    amount_eur: z.number().positive().finite(),
  })).max(7),
  award: z.object({
    miles: z.number().int().positive(),
    taxes_eur: z.number().nonnegative().finite(),
  }).nullable().optional(),
});

function readEstimate(raw: unknown, dates: string[]): FareEstimate {
  const parsed = ESTIMATE_SCHEMA.safeParse(raw);
  if (!parsed.success) throw new ProviderError("grok", "estimate was not a price list");
  for (const date of dates) {
    if (!parsed.data.cash.some((row) => row.date === date)) {
      throw new ProviderError("grok", `estimate missing a price for ${date}`);
    }
  }
  return { cash: parsed.data.cash, award: parsed.data.award ?? null };
}

/**
 * One price estimate for the dates Duffel did not quote. A fresh cached row
 * is returned without a second model call.
 */
export async function estimateTripPrices(input: {
  origin: string;
  destination: string;
  cabin: string;
  pax: number;
  dates: string[];
  needAward: boolean;
  store: CacheStore;
  maxAgeHours: number;
}): Promise<{ estimate: FareEstimate; fresh: boolean }> {
  const key = `grok:${input.origin}:${input.destination}:${input.cabin}:${input.pax}:${input.dates.join(",")}:award=${input.needAward ? 1 : 0}`;
  try {
    const row = await input.store.get(key);
    if (row) {
      const badge = priceBadge({ kind: "cached", fetchedAt: row.fetched_at, now: new Date(), maxAgeHours: input.maxAgeHours });
      if (!badge.stale) return { estimate: readEstimate(row.payload, input.dates), fresh: false };
    }
  } catch (error) {
    console.error("grok estimate cache read failed", { key, error });
  }

  const system =
    "You estimate airfare for a Spain travel planner. Return ONLY JSON: " +
    "{ \"cash\": [{\"date\":\"YYYY-MM-DD\",\"amount_eur\":number}], \"award\": {\"miles\":integer,\"taxes_eur\":number} or null }. " +
    "cash must include every requested date, one positive EUR amount for a return trip in the given cabin. " +
    (input.needAward
      ? "award is the typical one-way award miles and cash taxes for that route and cabin."
      : "award must be null.") +
    " These are estimates, not a live fare.";
  const user = JSON.stringify({
    origin: input.origin,
    destination: input.destination,
    cabin: input.cabin,
    pax: input.pax,
    dates: input.dates,
  });
  let raw: Record<string, unknown>;
  try {
    raw = await chatJson(system, user, 500);
  } catch (error) {
    console.error("grok estimate request failed", { origin: input.origin, destination: input.destination, dates: input.dates, error });
    throw new ProviderError("grok", error instanceof Error ? error.message : String(error));
  }
  const estimate = readEstimate(raw, input.dates);
  try {
    await input.store.set({ cache_key: key, payload: estimate, ttl_hours: input.maxAgeHours });
  } catch (error) {
    console.error("grok estimate cache write failed", { key, error });
  }
  return { estimate, fresh: true };
}
