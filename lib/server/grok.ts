/**
 * lib/server/grok.ts — the LLM's ONLY two jobs (F12 binding, F12 division of
 * labour): 1) parse the traveller's intent into structure, 2) explain the
 * engine's computed payload in plain Spanish. The LLM never produces a number.
 */
import OpenAI from "openai";
import { z } from "zod";

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
