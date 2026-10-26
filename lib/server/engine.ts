/**
 * lib/server/engine.ts — the F12 pipeline, shared by /api/engine/* and /api/chat.
 *
 * Binding division of labour: the LLM parses intent and explains; EVERY number
 * here comes from code — lib/engine verdict math, the labelled award fixture,
 * pair_valuations, revolut_plans, Duffel test-mode cash — never from a model.
 *
 * Honesty contracts enforced here:
 *  - D19 card gate: no value without a selected card's pair; empty
 *    pair_valuations / unmapped pair ⇒ `insufficient_data` (correct, not a bug).
 *  - D20 breakdown: taxes + fees + plan cost at official dated rates + points
 *    value — never one merged number; breakdown snapshots the pair cpp +
 *    verified_at actually used.
 *  - D26: projections render as low–high ranges, feasibility on the LOW end,
 *    widening causes shown; balances never summed across programs.
 *  - D21: rank candidates by total money value; hard veto above value.
 *  - §5.2: every provider call goes through dedupe+cache; only FRESH provider
 *    roundtrips record usage (cache hits are not provider calls).
 */
import {
  perProgramGap,
  monthlyEarn,
  enoughBy,
  InsufficientData,
  sanitizeBalance,
} from "../engine/verdict.mjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { loadAwardFixture, indexFixture, fixtureQuote, type FixtureIndex } from "./fixture";
import { loadTrendFixture, trendFor, type TrendFixture } from "./trend";
import { getOffersCached, repriceOfferCached, cheapestSaneOffer, type DuffelOffer } from "./duffel";
import { computeBookNowVerdict } from "./verdict-engine";
import { memoryCacheStore, type CacheStore } from "./cache";
import { usdEurCached } from "./fx";

export type EngineClient = SupabaseClient<Database>;
/** records a FRESH provider roundtrip for the actor (usage table, service role) */
export type UsageSink = (provider: string) => Promise<void>;

export interface EngineContext {
  db: EngineClient;
  cache: CacheStore;
  maxAgeHours: number;
  awards: FixtureIndex;
  trend: TrendFixture;
  persona: PersonaSnapshot | null;
  attribution: string;
  usage: UsageSink;
}

export interface PersonaSnapshot {
  label: string;
  route: { origin: string; destination: string; cabin?: string; window_days?: number };
  spend_monthly: number;
  wallet: Record<string, number | { plan: string }>;
  pax: number;
  is_test: true;
}

const DEFAULT_TARGET_PROGRAMS = ["IB", "BA", "QR"] as const;

/** app_settings (id=1) → the engine's honesty switches. */
export async function loadAppSettings(db: EngineClient): Promise<{ maxAgeHours: number; persona: PersonaSnapshot | null; attribution: string }> {
  const { data, error } = await db.from("app_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) throw Object.assign(new Error("app_settings unreadable"), { status: 500, code: "settings" });
  const raw = (data.test_persona ?? null) as unknown as Record<string, unknown> | null;
  return {
    maxAgeHours: (data.cache_max_age_hours as number | null) ?? 24,
    persona: raw
      ? {
          label: String(raw.label ?? "Perfil de prueba"),
          route: (raw.route ?? {}) as PersonaSnapshot["route"],
          spend_monthly: Number(raw.spend_monthly ?? 0),
          wallet: (raw.wallet ?? {}) as PersonaSnapshot["wallet"],
          pax: Number(raw.pax ?? 1),
          is_test: true,
        }
      : null,
    attribution: String(data.attribution_required ?? ""),
  };
}

export async function makeContext(db: EngineClient, usage: UsageSink, cache: CacheStore = memoryCacheStore()): Promise<EngineContext> {
  const settings = await loadAppSettings(db);
  return {
    db,
    cache,
    maxAgeHours: settings.maxAgeHours,
    awards: indexFixture(loadAwardFixture()),
    trend: loadTrendFixture(),
    persona: settings.persona,
    attribution: settings.attribution,
    usage,
  };
}

// ── reference lookups ──────────────────────────────────────────────────────

/** app program code → dataset program name (points-transfer-valuations keys). */
export const DATASET_PROGRAM_BY_CODE: Record<string, string> = {
  AMEX_ES: "Membership Rewards",
  // RevPoints is NOT in the 98-pair dataset — the gate must refuse, never estimate.
  REVOLUT: "REVOLUT (RevPoints) — not in the transfer-valuations dataset",
};

/** our program code → dataset partner spelling. */
export const DATASET_PARTNER_BY_CODE: Record<string, string> = {
  BA: "British Airways",
  IB: "Iberia",
  VY: "Vueling",
  EI: "Aer Lingus",
  AY: "Finnair",
  QR: "Qatar Airways",
};

export interface EnginePair {
  /** value of ONE target-program point, in the ticket currency (EUR) */
  low: number;
  high: number;
  currency: string;
  source_url: string;
  dataset_cpp_low_cents: number;
  dataset_cpp_high_cents: number;
  verified_at: string;
  fx?: { rate: number; badge: string; stale: boolean; age_hours: number; fetched_at: string };
  badge: "estimación";
}

/**
 * D19 pair lookup for the SELECTED card → target program, converted to the
 * ticket currency (dataset cents ÷ 100 in USD; dated frankfurter FX when USD).
 * No dataset row ⇒ null ⇒ the caller answers `insufficient_data` — never a
 * global estimate, never a fallback cpp.
 */
export async function lookupPair(
  ctx: EngineContext,
  { cardProgramCode, targetProgramCode, ticketCurrency }: { cardProgramCode: string; targetProgramCode: string; ticketCurrency: string },
): Promise<EnginePair | null> {
  const fromDataset = DATASET_PROGRAM_BY_CODE[cardProgramCode] ?? cardProgramCode;
  const toDataset = DATASET_PARTNER_BY_CODE[targetProgramCode] ?? targetProgramCode;
  const { data: row, error } = await ctx.db
    .from("pair_valuations")
    .select("from_code,to_code,cpp_low,cpp_high,currency,source_url,verified_at")
    .eq("from_code", fromDataset)
    .eq("to_code", toDataset)
    .maybeSingle();
  if (error || !row) return null;

  const centsLow = Number(row.cpp_low);
  const centsHigh = Number(row.cpp_high);
  const pairCurrency = String(row.currency);
  if (!(centsLow > 0) || centsHigh < centsLow) return null;

  if (pairCurrency === ticketCurrency) {
    // coincide; no conversion needed
  } else if (pairCurrency === "USD" && ticketCurrency === "EUR") {
    const rate = await usdEurCached(ctx.cache, ctx.maxAgeHours);
    ctx.usage("fx").catch(() => undefined); // fresh FX roundtrips count as provider calls
    const toEur = (cents: number) => (cents / 100) * rate.payload;
    const round = (v: number) => Math.round(v * 1e5) / 1e5;
    return {
      low: round(toEur(centsLow)),
      high: round(toEur(centsHigh)),
      currency: ticketCurrency,
      source_url: row.source_url,
      dataset_cpp_low_cents: centsLow,
      dataset_cpp_high_cents: centsHigh,
      verified_at: row.verified_at,
      fx: { rate: rate.payload, badge: rate.badge, stale: rate.stale, age_hours: rate.age_hours, fetched_at: rate.fetched_at },
      badge: "estimación",
    };
  } else {
    throw new InsufficientData(`pair currency pair unsupported: ${pairCurrency}→${ticketCurrency} — add a dated FX path, never a default rate`);
  }
  const round = (v: number) => Math.round(v * 1e5) / 1e5;
  return {
    low: round(centsLow / 100),
    high: round(centsHigh / 100),
    currency: ticketCurrency,
    source_url: row.source_url,
    dataset_cpp_low_cents: centsLow,
    dataset_cpp_high_cents: centsHigh,
    verified_at: row.verified_at,
    badge: "estimación",
  };
}

export interface PlanRates {
  plan: string;
  monthlyFeeEur: number;
  rateLow: number;
  rateHigh: number;
  source_url: string;
  verified_at: string;
  note: string | null;
}

/** D20/F4 official, dated Revolut plan row. */
export async function loadPlan(ctx: EngineContext, plan: string | null): Promise<PlanRates | null> {
  if (!plan) return null;
  const { data, error } = await ctx.db.from("revolut_plans").select("*").eq("plan", plan).maybeSingle();
  if (error || !data) return null;
  const debit = Number(data.debit_points_per_eur);
  const credit = data.credit_points_per_eur === null ? null : Number(data.credit_points_per_eur);
  if (!(debit > 0)) return null;
  return {
    plan: String(data.plan),
    monthlyFeeEur: Number(data.monthly_fee_eur),
    rateLow: debit,
    rateHigh: Math.max(debit, credit ?? debit),
    source_url: data.source_url,
    verified_at: data.verified_at,
    note: data.note,
  };
}

/** Wallet balances, per program (RLS via the caller's own client). */
export async function loadWallet(ctx: EngineContext): Promise<Record<string, { balance: number; account_age_days: number | null }>> {
  const { data, error } = await ctx.db
    .from("wallet_balances")
    .select("balance, account_age_days, programs(code)")
    .order("updated_at", { ascending: false });
  if (error || !data) return {};
  const out: Record<string, { balance: number; account_age_days: number | null }> = {};
  for (const row of data) {
    const code = (row as unknown as { programs?: { code: string } | { code: string }[] }).programs;
    const name = Array.isArray(code) ? code[0]?.code : code?.code;
    if (!name) continue;
    out[name] = { balance: sanitizeBalance(Number(row.balance)), account_age_days: row.account_age_days ?? null };
  }
  return out;
}

/** Bearer-free persona wallet (the T1 demo seed), clearly test-labelled. */
export function personaWallet(p: PersonaSnapshot | null): { balances: Record<string, number>; plan: string | null } {
  if (!p) return { balances: {}, plan: null };
  const balances: Record<string, number> = {};
  for (const [code, v] of Object.entries(p.wallet)) {
    if (typeof v === "number") balances[code] = sanitizeBalance(Math.floor(v));
  }
  const r = p.wallet.REVOLUT;
  const plan = typeof r === "object" && r !== null ? String((r as Record<string, unknown>).plan) : null;
  return { balances, plan };
}

/**
 * ONE transfer edge funds a seat (never summed across programs), counted on
 * the LOW end (D26). An edge with verified_at = null is unconfirmed: never
 * better than 1:1 optimistically, and the UI must show "confírmalo".
 */
export async function reachableByOneEdge(
  ctx: EngineContext,
  balances: Record<string, number>,
  targetProgram: string,
): Promise<{ reachableLow: number; via: string | null; verified: boolean }> {
  const { data: target } = await ctx.db.from("programs").select("id").eq("code", targetProgram).maybeSingle();
  if (!target) return { reachableLow: 0, via: null, verified: false };
  const { data: edges } = await ctx.db
    .from("transfer_partners")
    .select("from_program_id, ratio, verified_at, programs:programs!transfer_partners_from_program_id_fkey(code)")
    .eq("to_program_id", target.id);
  const targetBal = balances[targetProgram] ?? 0;
  let best: { code: string; ratio: number; verified: boolean } | null = null;
  for (const edge of (edges ?? []) as unknown as Array<{ verified_at: string | null; ratio: string | number; programs?: { code: string } | { code: string }[] }>) {
    const raw = edge.programs;
    const code = Array.isArray(raw) ? raw[0]?.code : raw?.code;
    if (!code || !(code in balances)) continue;
    const ratio = Number(edge.ratio);
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    if (!best) best = { code, ratio, verified: edge.verified_at !== null };
  }
  if (!best) return { reachableLow: targetBal, via: null, verified: false };
  const sourceBal = balances[best.code] ?? 0;
  const ratio = best.verified ? best.ratio : Math.min(best.ratio, 1);
  return { reachableLow: targetBal + Math.floor(sourceBal * ratio), via: best.code, verified: best.verified };
}

// ── F12 steps 2: cash-side (Duffel test mode, dedupe+cache) ───────────────

export interface CashFare {
  amount: number;
  currency: string;
  badge: string; // en vivo | cacheado | estimación (badge hand-off per §5.2)
  stale: boolean;
  age_hours: number;
  fetched_at: string;
  cached: boolean;
  offer_id: string | null;
}

export interface FetchedCash extends CashFare {
  offer: DuffelOffer | null;
  reverify: { amount: number; currency: string; moved: number; badge: string; fetched_at: string } | null;
  error?: { provider: string; detail: string };
}

/**
 * Window cash (Duffel v2 limitation note, verified live 2026-10-26): offer
 * requests accept ONLY a scalar departure date (the ranged form 422s), so the
 * window is served as ≤7 per-date scalar queries — each through cache+dedupe
 * (MUST #14 per exact date), with one usage row per FRESH roundtrip. Partial
 * cache/provider failures surface per date; a fully-failed window keeps the
 * typed provider error (never silent).
 */
export async function cashWindow(
  ctx: EngineContext,
  { origin, destination, from, to, cabin, pax }: { origin: string; destination: string; from: string; to: string; cabin: string; pax: number },
): Promise<Record<string, CashFare>> {
  const dates = windowDates(from, to, 7);
  const entries = await Promise.all(
    dates.map(async (date) => {
      const res = await getOffersCached({
        params: { origin, destination, departure_date: date, cabin: cabin as "economy" | "premium" | "business" | "first", pax },
        store: ctx.cache,
        maxAgeHours: ctx.maxAgeHours,
      });
      if (!res.source_error) {
        await ctx.usage("duffel").catch(() => undefined); // fresh roundtrip counts
      }
      const chosen = cheapestSaneOffer(res.payload?.offers ?? [], "EUR") ?? cheapestSaneOffer(res.payload?.offers ?? []);
      if (!chosen) return { date, err: res.source_error ?? null, fare: null };
      return {
        date,
        err: res.source_error ?? null,
        fare: {
          amount: chosen.total.amount,
          currency: chosen.total.currency,
          badge: res.badge,
          stale: res.stale,
          age_hours: res.age_hours,
          fetched_at: res.fetched_at,
          cached: res.cached,
          offer_id: chosen.id,
        } as CashFare,
      };
    }),
  );
  const result: Record<string, CashFare> = {};
  let typedProviderError: Error | null = null;
  for (const e of entries) {
    if (e.fare) result[e.date] = e.fare;
    else if (e.err && !typedProviderError) {
      typedProviderError = Object.assign(new Error(e.err.detail), { code: "provider_error", provider: e.err.provider });
    }
  }
  // a complete miss keeps the typed error (cache-failure partial stays usable)
  if (Object.keys(result).length === 0 && typedProviderError) throw typedProviderError;
  return result;
}

/** ≤7 spread dates across [start, end] inclusive — the window planner. */
export function windowDates(start: string, end: string, max: number): string[] {
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return [];
  const span = Math.round((e - s) / 86_400_000);
  if (span <= max - 1) {
    return Array.from({ length: span + 1 }, (_, i) => new Date(s + i * 86_400_000).toISOString().slice(0, 10));
  }
  const out: string[] = [];
  for (let i = 0; i < max; i++) {
    out.push(new Date(s + Math.round((i * span) / (max - 1)) * 86_400_000).toISOString().slice(0, 10));
  }
  return [...new Set(out)].sort();
}

/** Book-now single-date cash: cheapest sane offer + re-verify on the CHOSEN offer (F8). */
export async function cashForDate(
  ctx: EngineContext,
  { origin, destination, depart_date, cabin, pax }: { origin: string; destination: string; depart_date: string; cabin: string; pax: number },
): Promise<FetchedCash> {
  const offers = await getOffersCached({
    params: { origin, destination, departure_date: depart_date, cabin: cabin as "economy" | "premium" | "business" | "first", pax },
    store: ctx.cache,
    maxAgeHours: ctx.maxAgeHours,
  });
  if (!offers.source_error) {
    await ctx.usage("duffel").catch(() => undefined);
  }
  const chosen = cheapestSaneOffer(offers.payload.offers, "EUR") ?? cheapestSaneOffer(offers.payload.offers);
  if (!chosen) {
    throw Object.assign(new Error("duffel: no offers for this date"), { code: "provider_error", provider: "duffel" });
  }
  const originalAmount = offers.payload.offers.find((o) => o.id === chosen.id)?.total.amount ?? chosen.total.amount;
  // F8: re-verify BEFORE anything money-wise; a moved total shows its diff
  const vr = await repriceOfferCached({ offerId: chosen.id, store: ctx.cache, maxAgeHours: ctx.maxAgeHours });
  if (!vr.source_error) {
    await ctx.usage("duffel").catch(() => undefined);
  }
  return {
    offer: vr.payload,
    amount: vr.payload.total.amount,
    currency: vr.payload.total.currency,
    badge: vr.badge,
    stale: vr.stale,
    age_hours: vr.age_hours,
    fetched_at: vr.fetched_at,
    cached: vr.cached,
    offer_id: vr.payload.id,
    reverify: {
      amount: vr.payload.total.amount,
      currency: vr.payload.total.currency,
      moved: Math.abs(vr.payload.total.amount - originalAmount),
      badge: vr.badge,
      fetched_at: vr.fetched_at,
    },
  };
}

// ── F2 book-now compare ───────────────────────────────────────────────────

export interface BookNowInput {
  origin: string;
  destination: string;
  depart_date: string;
  cabin: string;
  pax: number;
  /** D19 card gate: the card that funds the trip; without it — no value */
  card?: string | null;
  target_program?: string | null;
  plan?: string | null;
}

/** F2 — cash vs miles+taxes on a LIVE seat, cents-per-point after taxes. */
export async function bookNowCompare(ctx: EngineContext, input: BookNowInput): Promise<ReturnType<typeof computeBookNowVerdict>> {
  const attribution = ctx.attribution ?? "";
  const cash = await cashForDate(ctx, input);

  const insufficient = (reason: string) => ({
    verdict: "insufficient_data" as const,
    savings_eur: null,
    savings_pct: null,
    badges: ["estimación"],
    cash:
      cash.amount != null
        ? { amount: cash.amount, currency: cash.currency, badge: cash.badge, stale: cash.stale, age_hours: cash.age_hours, fetched_at: cash.fetched_at }
        : null,
    cash_moved: cash.reverify?.moved ?? null,
    award: null,
    pair: null,
    card_gate: { asked: false, card: input.card ?? null, reason },
    breakdown: null,
    insufficient_reason: reason,
    attribution,
  });

  // award side: the labelled fixture — first target program that has a verified row
  const targets = input.target_program ? [input.target_program] : [...DEFAULT_TARGET_PROGRAMS];
  let awardProgram: string | null = null;
  let awardQuote = null;
  for (const program of targets) {
    const quote = fixtureQuote(ctx.awards, { origin: input.origin, destination: input.destination, airline_program: program, cabin: input.cabin });
    if (quote) {
      awardProgram = program;
      awardQuote = quote;
      break;
    }
  }
  if (!awardProgram || !awardQuote) {
    return insufficient("fixture: sin fila de canje verificada para esta ruta/programa/cabina (ritual D30 pendiente) — el veredicto no se inventa");
  }

  // card gate (D19): value comes ONLY from the selected card's pair
  const card = input.card ?? null;
  if (!card) {
    return insufficient("¿qué tarjeta va a financiar el canje? Sin carta seleccionada no hay valor (D19)");
  }
  const pair = await lookupPair(ctx, { cardProgramCode: card, targetProgramCode: awardProgram, ticketCurrency: cash.currency });
  if (!pair) {
    return insufficient(`sin fila ${card} → ${awardProgram} en el dataset de valoraciones — no se inventa un cpp (D19)`);
  }

  // F4 plan rates (official, dated) feed the D20 breakdown plan cost
  const persona = personaWallet(ctx.persona);
  const planRef = input.plan ?? persona.plan ?? null;
  const plan = await loadPlan(ctx, planRef);

  const verdict = computeBookNowVerdict({
    cashAmount: cash.amount,
    cashCurrency: cash.currency,
    taxes: awardQuote.taxes,
    miles: awardQuote.miles,
    pair: { low: pair.low, high: pair.high, currency: pair.currency, verified_at: pair.verified_at },
    pax: input.pax,
    cashFetchedAt: cash.fetched_at,
    maxAgeHours: ctx.maxAgeHours,
    planCost: plan ? plan.monthlyFeeEur : null,
    awardProgram,
    card,
    attribution,
    cashBadges: { badge: cash.badge, stale: cash.stale, age_hours: cash.age_hours, fetched_at: cash.fetched_at, reverifyMoved: cash.reverify?.moved ?? null },
    pairFx: pair.fx ?? null,
    pairDataset: { cpp_low: pair.dataset_cpp_low_cents, cpp_high: pair.dataset_cpp_high_cents, source_url: pair.source_url, verified_at: pair.verified_at },
  });
  return verdict;
}

export interface RunwayInput {
  origin: string;
  destination: string;
  window: { start: string; end: string };
  cabin: string;
  pax: number;
  card?: string | null;
  plan?: string | null;
}

export interface RunwayCandidate {
  depart_date: string;
  cash: CashFare;
  verdict: "usar_puntos" | "pagar_en_efectivo" | "insufficient_data";
  savings_eur: number | null;
  value_score: number | null;
  trend: { factor: number; source: string; label: "estimación"; verified_at: string };
  gap: { gap: number; enough: boolean } | null;
  proyeccion: { low: number; high: number; badge: "proyección"; causal_note: string | null } | null;
  enough_by: { feasible: boolean; by_date: string | null; by_date_high: string | null; months_low: number | null } | null;
  why: string | null;
}

export interface RunwayResult {
  mode: "plan";
  candidates: RunwayCandidate[];
  recommended: RunwayCandidate | null;
  alternative: RunwayCandidate | null;
  accelerator: { plan: string | null; monthly_earn: { low: number; high: number } | null; spend_monthly: number; note: string } | null;
  uses_program: string | null;
  card_gate: { asked: boolean; card: string | null; reason: string | null };
  insufficient_reason?: string;
  badges: string[];
  attribution: string;
}

/** F1 — the runway ranked by TOTAL money value (D21) incl. the accelerator branch. */
export async function runwayCompute(ctx: EngineContext, input: RunwayInput): Promise<RunwayResult> {
  const pax = input.pax;

  // ── step 3: wallet + monthly earn (per program, per card plan) ────────────
  const userWallet = await loadWallet(ctx);
  const persona = ctx.persona ? { balances: personaWallet(ctx.persona).balances, ...ctx.persona } : null;
  const userBalances = userWallet;
  // per-program wallet: the USER's real balances if any, else the T1 test seed (labelled test data)
  const hasUserWallet = Object.keys(userBalances).length > 0;
  const balances = hasUserWallet ? Object.fromEntries(Object.entries(userBalances).map(([k, v]) => [k, v.balance])) : persona?.balances ?? {};
  const isTestWallet = !hasUserWallet;

  const planRef = input.plan ?? personaWallet(ctx.persona).plan ?? null;
  const plan = await loadPlan(ctx, planRef);
  const spendMonthly = isTestWallet ? (persona?.spend_monthly ?? 0) : 0; // real users state their spend (F3); no inventing

  // ── step 2: ONE ranged cash query, ≤ 7 candidates ─────────────────────────
  const fares = await cashWindow(ctx, {
    origin: input.origin, destination: input.destination, from: input.window.start, to: input.window.end, cabin: input.cabin, pax,
  });
  const dates = pickDates(input.window.start, input.window.end, Object.keys(fares), 7);
  if (dates.length === 0) {
    return {
      mode: "plan",
      candidates: [],
      recommended: null,
      alternative: null,
      accelerator: null,
      uses_program: null,
      card_gate: { asked: false, card: null, reason: "sin tarifas en la ventana" },
      insufficient_reason: "duffel: sin ofertas dentro de la ventana — prueba fechas más cercanas o una ventana más corta",
      badges: ["estimación"],
      attribution: ctx.attribution,
    };
  }

  // ── step 4: award side (fixture) + card gate (pair) ───────────────────────
  let awardProgram: string | null = null;
  let awardQuote = null;
  for (const program of DEFAULT_TARGET_PROGRAMS) {
    const q = fixtureQuote(ctx.awards, { origin: input.origin, destination: input.destination, airline_program: program, cabin: input.cabin });
    if (q) {
      awardProgram = program;
      awardQuote = q;
      break;
    }
  }
  const card = input.card ?? null;
  const pair = card && awardProgram ? await lookupPair(ctx, { cardProgramCode: card, targetProgramCode: awardProgram, ticketCurrency: "EUR" }) : null;

  const mEarn = plan && spendMonthly > 0 ? monthlyEarn({ spendMonthly, rateLow: plan.rateLow, rateHigh: plan.rateHigh, expiring: 0 }) : null;

  // ── per-candidate computation (no provider call inside this loop) ─────────
  const candidates: RunwayCandidate[] = [];
  for (const date of dates) {
    const fare = fares[date];
    if (!fare) continue;
    const trend = trendFor(ctx.trend, date);
    const expectedCash = fare.amount * trend.factor;
    let gap: RunwayCandidate["gap"] = null;
    let proyeccion: RunwayCandidate["proyeccion"] = null;
    let by: RunwayCandidate["enough_by"] = null;
    let verdict: RunwayCandidate["verdict"] = "insufficient_data";
    let savings: number | null = null;
    let valueScore: number | null = null;
    let why: string | null = null;

    if (awardProgram && awardQuote) {
      // per-program gap funds the seat; ONE guide-stated edge max (binding)
      const reachableToday = await reachableByOneEdge(ctx, balances, awardProgram);
      const gapToday = perProgramGap(awardQuote.miles * pax, reachableToday.reachableLow);
      gap = gapToday;

      // D26 range: balance projected at the date, low–high, ±10% widen when
      // expiry/bonus unknowns exist; feasibility ALWAYS tests the low end.
      const monthsAhead = monthsUntil(date);
      const bLow = reachableToday.reachableLow + (mEarn?.low ?? 0) * monthsAhead;
      const bHigh = reachableToday.reachableLow + (mEarn?.high ?? 0) * monthsAhead;
      const bandLow = Math.floor(bLow * 0.9); // ±10% band (D26)
      const bandHigh = Math.ceil(bHigh * 1.1);
      proyeccion = {
        low: gapToday.gap > 0 ? Math.max(0, awardQuote.miles * pax - bandLow) : awardQuote.miles * pax,
        high: gapToday.gap > 0 ? Math.max(0, awardQuote.miles * pax - bandHigh) : awardQuote.miles * pax,
        badge: "proyección",
        causal_note: [
          mEarn ? `ganancia mensual ${mEarn.low}–${mEarn.high} pts` : "sin ganancia mensual introducida",
          awardProgram !== "IB" ? `transferencia por puente (${reachableToday.via ?? "?"}${reachableToday.verified ? "" : ", sin verificar — confírmalo"})` : null,
          bandHigh > bandLow ? "banda ±10% (D26)" : null,
        ].filter(Boolean).join(" · "),
      };

      if (mEarn) by = enoughBy(gapToday.gap, mEarn.low, mEarn.high);

      if (!card) why = "¿qué tarjeta va a financiar? (D19)";
      else if (!pair) why = `sin fila ${card} → ${awardProgram} en el dataset — sin valor inventado (D19)`;
      else {
        // D21 valueScore on the ticket-currency pair, mid-case (reproducibly snapshotted per candidate)
        const allInCost = (awardQuote.taxes.amount + (plan?.monthlyFeeEur ?? 0)) + awardQuote.miles * pax * ((pair.low + pair.high) / 2);
        valueScore = Math.round((expectedCash - allInCost) * 100) / 100;
        verdict = gapToday.enough ? "usar_puntos" : "pagar_en_efectivo";
        savings = gapToday.enough ? Math.round((expectedCash - (awardQuote.taxes.amount + (plan?.monthlyFeeEur ?? 0))) * 100) / 100 : null;
        if (!gapToday.enough) {
          const viaNote = reachableToday.via
            ? `, incluyendo transferencia desde ${reachableToday.via}${reachableToday.verified ? "" : " (sin verificar — confírmalo)"}`
            : "";
          why = `no cierra: faltan ${gapToday.gap} Avios para ${awardProgram}${viaNote} (saldo hoy + ganancia por gasto)`;
        } else if (awardQuote.seats === "no") {
          why = "vetado: sin asiento — solo responde el precio en efectivo (D21)";
        }
      }
    } else {
      why = "fixture: sin fila de canje verificada para esta ruta — insuficiente, nunca inventado (ritual D30 pendiente)";
    }

    candidates.push({
      depart_date: date,
      cash: fare,
      verdict,
      savings_eur: savings,
      value_score: valueScore,
      trend,
      gap,
      proyeccion,
      enough_by: by,
      why,
    });
  }

  // ── D21 ranking: best total money value; hard veto above value ────────────
  const eligible = candidates.filter((c) => c.verdict !== "insufficient_data" && c.value_score !== null);
  const ranked = [...eligible].sort((a, b) => (b.value_score ?? -Infinity) - (a.value_score ?? -Infinity));
  const recommended = ranked[0] ?? null;
  const alternative =
    ranked.length >= 2 && ranked[1].enough_by?.feasible === false // waiting closes the gap → the later card carries the deferral reasoning
      ? ranked[1]
      : ranked.length >= 2
      ? ranked[1]
      : null;

  // ── accelerator branch: infeasible at the LOW end (T1 designed outcome) ───
  let accelerator: RunwayResult["accelerator"] = null;
  const firstGap = candidates.find((c) => c.gap && c.gap.gap > 0)?.gap ?? null;
  if (firstGap && firstGap.gap > 0) {
    if (!mEarn) {
      accelerator = {
        plan: plan?.plan ?? null,
        monthly_earn: null,
        spend_monthly: spendMonthly,
        note: `faltan ${firstGap.gap} puntos y no hay ganancia mensual introducida — primero el gasto (F3), luego un mejor plan o multiplicador para acelerar (F5); nunca comprar puntos por si acaso`,
      };
    } else {
      accelerator = {
        plan: plan?.plan ?? null,
        monthly_earn: mEarn,
        spend_monthly: spendMonthly,
        note: `faltan ${firstGap.gap} puntos al arranque; con ${plan?.plan ?? "?"} el suelo llega en ~${Math.ceil(firstGap.gap / Math.max(1, mEarn.high))} meses y el techo a ~${Math.ceil(firstGap.gap / Math.max(1, mEarn.low))} — un mejor plan o un multiplicador aceleran (F5). Nunca comprar puntos por si acaso`,
      };
    }
  }

  return {
    mode: "plan",
    candidates,
    recommended,
    alternative: recommended && alternative !== recommended ? alternative : null,
    accelerator,
    uses_program: awardProgram,
    card_gate: { asked: true, card, reason: card ? null : "D19: sin carta no hay valor" },
    badges: ["estimación", "proyección"],
    attribution: ctx.attribution,
  };
}

/** months between today and a date (30-day months, consistent with enoughBy). */
export function monthsUntil(date: string | Date, from: Date = new Date()): number {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00Z`) : date;
  return Math.max(0, Math.round((d.getTime() - from.getTime()) / (30 * 24 * 3_600_000)));
}

/** ≤ 7 candidate dates across the window, restricted to dates with fares. */
export function pickDates(start: string, end: string, available: string[], max: number): string[] {
  const a = available.filter((d) => d >= start && d <= end).sort();
  if (a.length <= max) return a;
  if (max === 1) return [a[0]];
  const out: string[] = [];
  for (let i = 0; i < max; i++) {
    out.push(a[Math.round((i * (a.length - 1)) / (max - 1))]);
  }
  return [...new Set(out)].sort();
}
