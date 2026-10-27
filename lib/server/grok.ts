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
import { CARD_PRODUCTS } from "./card-earn";
import type { ModelTurn, ModelTurnInput } from "./chat-turn";
import { llmEndpoint, type LlmEndpoint } from "./llm-endpoint";

let client: OpenAI | null = null;
let endpoint: LlmEndpoint | null = null;
function getClient(): OpenAI {
  const key = process.env.grok_api_key;
  if (!key) throw Object.assign(new Error("server misconfiguration: grok_api_key missing"), { status: 500, code: "llm_config" });
  if (!client) {
    endpoint = llmEndpoint(key, { grok_base_url: process.env.grok_base_url, grok_model: process.env.grok_model });
    client = new OpenAI({ apiKey: key, baseURL: endpoint.baseURL, timeout: 30_000 });
  }
  return client;
}

/** D18: short structured outputs; host and model follow the key, overridable per env. */
function modelOptions(): { model: string; reasoning_effort?: "low" } {
  getClient();
  if (!endpoint) throw Object.assign(new Error("llm endpoint not resolved"), { status: 500, code: "llm_config" });
  return endpoint.reasoningEffort ? { model: endpoint.model, reasoning_effort: endpoint.reasoningEffort } : { model: endpoint.model };
}

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

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function chatJsonMessages(messages: ChatMessage[], maxTokens: number, temperature = 0.1): Promise<Record<string, unknown>> {
  const completion = await getClient().chat.completions.create({
    ...modelOptions(),
    messages,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" as const },
  });
  const raw = completion.choices[0]?.message?.content ?? "";
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (error) {
    console.error("grok returned non-JSON content", { length: raw.length, error });
    return {};
  }
}

async function chatJson(system: string, user: string, maxTokens = 400): Promise<Record<string, unknown>> {
  return chatJsonMessages([
    { role: "system", content: system },
    { role: "user", content: user },
  ], maxTokens);
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

/**
 * The persona demo's explain step: plain Spanish quoting the payload's numbers — never producing any.
 */
export async function explain(payload: Record<string, unknown>): Promise<string> {
  const system =
    "Eres el agente de A Una Milla. Explica en español llano, 2–4 frases sobre el resultado de abajo, en texto plano sin Markdown. " +
    "Cita ÚNICAMENTE los números que aparecen en el JSON; jamás calcules, redondees ni estimes ninguno. " +
    "Si el veredicto es insufficient_data, explica qué falta con honestidad y qué haría falta para calcularlo. " +
    "Nunca digas «garantizado» ni «confirmado».";
  const completion = await getClient().chat.completions.create({
    ...modelOptions(),
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(payload).slice(0, 6_000) },
    ],
    temperature: 0.4,
    max_tokens: 350,
  });
  return completion.choices[0]?.message?.content ?? "";
}

/**
 * The chat's explain step: rewords engine facts (already plain sentences) as
 * the agent talking to the traveller, in the traveller's language.
 */
export async function explainFacts(facts: string[], travellerText: string): Promise<string> {
  const system =
    "You are the A Una Milla travel agent, talking to a traveller about the trip you just priced for them. " +
    "Rewrite the FACTS below as one short, warm message of 2–4 sentences, speaking to them as \"you\". Cover every fact. " +
    "Use only these facts and their numbers exactly as written; add no numbers, dates or claims of your own. " +
    "Write like a person, not a report: no lists, no Markdown, no quotation marks around values. " +
    "Never say guaranteed or confirmed.";
  const completion = await getClient().chat.completions.create({
    ...modelOptions(),
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content:
          `FACTS:\n${facts.join("\n")}\n\n` +
          `LANGUAGE SAMPLE (write in this language; do not answer it): ${travellerText.slice(0, 300)}`,
      },
    ],
    temperature: 0.4,
    max_tokens: 350,
  });
  return completion.choices[0]?.message?.content ?? "";
}

const TURN_SCHEMA = z.object({
  action: z.enum(["answer", "search"]).catch("answer"),
  reply: z.string().max(4000).catch(""),
  slots: z.record(z.unknown()).nullable().optional().catch(null),
});

const HISTORY_LIMIT = 20;

/**
 * The chat agent's turn: read the thread, propose the facts the traveller
 * stated, choose answer vs search, and write the reply. Proposed facts are
 * validated by chat-slots before storage; the model never prices anything.
 */
export async function chatTurn(input: ModelTurnInput): Promise<ModelTurn> {
  const system = [
    "You are the travel agent of A Una Milla, a Spanish points-and-miles planner. Today is " + input.today + ".",
    "Always write the reply in the same language as the traveller's latest message (English when they write English). Be brief and friendly. Plain text only, no Markdown. Never invent prices, miles, taxes or savings — the engine computes those after you.",
    "Return ONLY JSON: {\"action\":\"answer\"|\"search\",\"reply\":string,\"slots\":object}.",
    "slots holds ONLY facts the traveller stated in this conversation, using these keys:",
    "origin and destination (3-letter IATA, e.g. Madrid=MAD, Johannesburg=JNB, London=LHR), depart_date (YYYY-MM-DD) OR window {start,end},",
    "cabin ('economy'|'premium'|'business'|'first'), pax (integer 1-9), cards (array of: " + CARD_PRODUCTS.join(", ") + "),",
    "points_held (ONE number: the total points already on all their cards, e.g. 500 on Amex and 300 on Revolut is 800), monthly_total (euros spent per month), spend (euros per month by: fuel, groceries, dining, shopping, leisure, transport, travel),",
    "mode ('book_now' only if they want to book a fixed date right now, else 'plan'). Leave out anything they did not say. Never guess a city or a date.",
    "Travel dates are always after today: a month or day given without a year (\"next March\", \"the 15th\") means its next occurrence after " + input.today + ".",
    "action is 'search' when the traveller gives or changes trip facts or asks you to plan, search or book. Otherwise 'answer'.",
    "For 'answer', reply to their question directly (cards, points, Avios, how the plan works).",
    "For 'search', if facts are still missing (route, dates, cabin, cards they hold, monthly spend), ask for them in one short message; points held and per-category spend are optional but worth asking once.",
    "If nothing is missing, reply with one line saying you are checking prices now.",
    "Facts already known: " + JSON.stringify(input.slots),
  ].join("\n");
  const history = input.history.slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  let raw: Record<string, unknown>;
  try {
    raw = await chatJsonMessages([{ role: "system", content: system }, ...history, { role: "user", content: input.text }], 600, 0.3);
  } catch (error) {
    console.error("grok chat turn failed", { error });
    throw new ProviderError("grok", error instanceof Error ? error.message : String(error));
  }
  const parsed = TURN_SCHEMA.safeParse(raw);
  if (!parsed.success) {
    console.error("grok chat turn shape invalid", { issues: parsed.error.issues.length });
    return { action: "answer", reply: "", slots: {} };
  }
  return { action: parsed.data.action, reply: parsed.data.reply, slots: parsed.data.slots ?? {} };
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
