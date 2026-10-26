/**
 * lib/engine/verdict.mjs — A Una Milla verdict math, pure and typed.
 *
 * The chat AI NEVER computes any of this; it explains engine output only
 * (docs/OVERVIEW.md §8). Every function here encodes one guard that came out
 * of the devil's-advocate pass: ÷0 miles, taxes ≥ cash, currency mismatches,
 * pax multiplication, cross-program summing, expiry double-count and the
 * rounding direction rule. All values are plain JavaScript numbers in the
 * ticket's currency; the caller must convert or refuse (see assertSameCurrency).
 *
 * Honesty rule of this file (D12/D26): round savings DOWN, round gaps UP,
 * never return a negative saving, never invent a cpp.
 */

export class InsufficientData extends Error {
  /** @param {string} detail */
  constructor(detail) {
    super(`insufficient_data: ${detail}`);
    /** @type {'insufficient_data'} */
    this.code = 'insufficient_data';
    this.detail = detail;
  }
}

export class ProviderError extends Error {
  /** @param {string} provider @param {string} detail */
  constructor(provider, detail) {
    super(`${provider}: ${detail}`);
    /** @type {'provider_error'} */
    this.code = 'provider_error';
    this.provider = provider;
  }
}

// ── badge ages (settled 2026-10-26: 24 h, admin-editable via app_settings) ──

/**
 * Badge + freshness for a price figure. One unified rule (settled 2026-10-26,
 * 24 h):
 *  - within maxAgeHours → "en vivo" for kind=live, "cacheado" for kind=cached
 *  - older than that   → "estimación" + stale: true, for BOTH kinds (a stored
 *                        price is a cache; an old one never claims freshness)
 *  - fixture           → "estimación" always (labelled fixture per D29/D30)
 * @param {object} p
 * @param {'live'|'cached'|'fixture'} p.kind
 * @param {Date|string|null} p.fetchedAt when the value was fetched/verified
 * @param {Date} [p.now]
 * @param {number} [p.maxAgeHours=24] from app_settings.cache_max_age_hours
 * @returns {{ badge: 'en vivo'|'cacheado'|'estimación', stale: boolean, age_hours: number }}
 */
export function priceBadge({ kind, fetchedAt, now = new Date(), maxAgeHours = 24 }) {
  const t = fetchedAt === null || fetchedAt === undefined ? null : new Date(fetchedAt);
  if (t === null || Number.isNaN(t.getTime())) {
    // A price whose age is unknowable cannot claim freshness — honest default.
    return { badge: 'estimación', stale: true, age_hours: -1 };
  }
  const ageHours = (now.getTime() - t.getTime()) / 3_600_000;
  if (ageHours < 0) throw new InsufficientData('fetchedAt is in the future (clock skew?)');
  if (kind === 'fixture') return { badge: 'estimación', stale: false, age_hours: Math.floor(ageHours) };
  if (ageHours <= maxAgeHours) {
    return kind === 'live'
      ? { badge: 'en vivo', stale: false, age_hours: 0 }
      : { badge: 'cacheado', stale: false, age_hours: Math.floor(ageHours) };
  }
  // Stale: live or cached, an old price is an estimate.
  return { badge: 'estimación', stale: true, age_hours: Math.floor(ageHours) };
}

// ── money / rounding ────────────────────────────────────────────────────────

/** Round DOWN to cents. Savings may never round up (never overpromise). @param {number} eur */
export const floorCents = (eur) => Math.floor(eur * 100) / 100;

/** Round UP to whole points. Gaps may never round down (and never −0). @param {number} points */
export const ceilPoints = (points) => Math.ceil(points - 1e-9) || 0;

/**
 * All figures compared in one verdict must share a currency, or the verdict
 * is unbuildable (D20: mismatched taxes/cash currency → InsufficientData;
 * the third case — valuation currency — follows the same rule).
 * @param {Array<{amount: number, currency: string|null, label: string}>} figures
 * @returns {string} the single shared currency
 */
export function assertSameCurrency(figures) {
  const known = figures.filter((f) => f.currency !== null && f.valid !== false);
  if (known.length === 0) throw new InsufficientData('no currencies present');
  const [first, ...rest] = known;
  const mismatch = rest.find((f) => f.currency !== first.currency);
  if (mismatch) {
    throw new InsufficientData(
      `currency mismatch: ${first.label}=${first.currency} vs ${mismatch.label}=${mismatch.currency}`,
    );
  }
  // @ts-ignore — known is non-empty
  return first.currency;
}

// ── comparison core (CPP §1.1–1.2) ─────────────────────────────────────────

/**
 * Cents-per-point after taxes. Returns null when redeeming cash-side anyway
 * (taxes ≥ cash ⇒ pagar en efectivo, savings NULL — never a negative saving).
 * @param {object} p
 * @param {number} p.cash  live cash fare (> 0), one seat
 * @param {number} p.taxes award taxes+fees (≥ 0), one seat
 * @param {number} p.miles award miles (one seat, > 0)
 * @returns {{ cpp: number|null, after_tax_cash: number, invalid?: string }}
 */
export function cppAfterTaxes({ cash, taxes, miles }) {
  if (!(cash > 0)) throw new InsufficientData(`cash fare must be > 0 (got ${cash})`);
  if (!(miles > 0)) throw new InsufficientData(`miles must be > 0 (got ${miles})`);
  if (taxes < 0) throw new InsufficientData(`taxes cannot be negative (got ${taxes})`);
  const afterTaxCash = floorCents(cash - taxes);
  if (afterTaxCash <= 0) {
    return { cpp: null, after_tax_cash: 0, invalid: 'taxes_gte_cash' };
  }
  return { cpp: afterTaxCash / miles, after_tax_cash: afterTaxCash };
}

/**
 * Full pax-scaled verdict. Guards:
 *  - currencies must agree across cash, taxes and the pair valuation
 *  - miles = 0 → InsufficientData (÷0 crash prevented, #1)
 *  - taxes ≥ cash → pagar_en_efectivo with savings NULL (#2)
 *  - savings round DOWN, savings_pct ≤ 100 by construction (#3)
 *  - pax > 1 keeps seat_basis: 1 in the breakdown (one-seat fixture, §8 step 5)
 * @param {object} p
 * @param {{amount:number, currency:string}} p.cash
 * @param {{amount:number, currency:string}} p.taxes
 * @param {number} p.milesPair value of the point being redeemed, {low:number, high:number, currency:string}
 * @param {number} [p.pax]
 * @param {Date|string} [p.cashFetchedAt] when the live cash fare was fetched (badge age)
 * @param {Date} [p.now]
 * @param {number} [p.maxAgeHours=24] cache staleness threshold (app_settings)
 * @returns {object} columns matching public.itineraries + breakdown payload
 */
export function computeVerdict({ cash, taxes, miles, pair, pax = 1, cashFetchedAt, now, maxAgeHours = 24 }) {
  if (!Number.isInteger(pax) || pax < 1 || pax > 9) {
    throw new InsufficientData(`pax must be 1..9 (got ${pax})`);
  }
  const currency = assertSameCurrency([
    { amount: cash.amount, currency: cash.currency, label: 'cash' },
    { amount: taxes.amount, currency: taxes.currency, label: 'taxes' },
    { amount: pair.high, currency: pair.currency, label: 'pair_valuation' },
  ]);

  const cpp = cppAfterTaxes({
    cash: cash.amount,
    taxes: taxes.amount,
    miles,
  });
  if (cpp.invalid === 'taxes_gte_cash') {
    return {
      verdict: 'pagar_en_efectivo',
      savings_eur: null,
      savings_pct: null,
      breakdown: {
        currency,
        cash: cash.amount,
        taxes: taxes.amount,
        miles,
        cpp: null,
        reason: 'los impuestos igualan o superan el precio en efectivo: usar puntos no ahorra nada',
      },
      badges: [priceBadge({ kind: 'live', fetchedAt: cashFetchedAt, now, maxAgeHours }).badge],
    };
  }

  // Verdict: the redemption beats the pair's own valuation? (D19: the pair of
  // the SELECTED CARD supplies the value; it applies to the redeemed currency.)
  const usePoints = cpp.cpp > pair.high;
  const perSeatSavings = floorCents(cpp.after_tax_cash - miles * pair.low);

  // Pax multiply: per-seat inputs scale linearly; the verdict basis stays 1 seat.
  const paxSavings = pax === 1 ? perSeatSavings : floorCents(perSeatSavings * pax);
  const savingsPct = paxSavings === null ? null : floorCents((paxSavings / (cash.amount * pax)) * 100);

  // The breakdown must snapshot the pair value used + its vintage so every
  // verdict is reproducible even after the dataset reloads (see migration §9).
  const badges = [priceBadge({ kind: 'live', fetchedAt: cashFetchedAt, now, maxAgeHours }).badge, 'estimación'];
  return {
    verdict: usePoints && perSeatSavings > 0 ? 'usar_puntos' : 'pagar_en_efectivo',
    savings_eur: perSeatSavings > 0 ? paxSavings : null,
    savings_pct: usePoints && perSeatSavings > 0 ? savingsPct : null,
    breakdown: {
      currency,
      cash: floorCents(cash.amount * pax),
      taxes: floorCents(taxes.amount * pax),
      miles: miles * pax,
      cpp: cpp.cpp,
      pair_used: { low: pair.low, high: pair.high, verified_at: pair.verified_at ?? null },
      seat_basis: 1,
      seat_capacity_note: pax > 1 ? 'disponibilidad para 1 asiento no garantiza 2' : null,
    },
    badges,
  };
}

// ── gaps, projections, feasibility (D26 / §8 step 3) ───────────────────────

/**
 * Gap counted per program ONLY — tokens in the target program or reachable
 * through ONE guide-stated transfer edge fund the seat; balances are never
 * summed across programs (the caller passes reachableTotal, we never add).
 * @param {number} needed  points the seat costs
 * @param {number} reachable points owned in the target program (up to the transfer edge)
 * @returns {{ gap: number, enough: boolean }}
 */
export function perProgramGap(needed, reachable) {
  if (!(needed > 0)) throw new InsufficientData(`needed must be > 0 (got ${needed})`);
  if (reachable < 0) throw new InsufficientData(`owned cannot be negative (got ${reachable})`);
  const gap = ceilPoints(needed - reachable);
  return { gap, enough: gap === 0 };
}

/**
 * Monthly earn minus anything expiring before the target date, clamped ≥ 0
 * (a negative runway is nonsense; expiry never double-counts balance).
 * @param {number} spendMonthly monthly spend in EUR
 * @param {number} rateLow     points per €, lower bound (cap unconfirmed, D32)
 * @param {number} rateHigh    points per €, upper bound
 * @param {number} expiring    points that expire before the target date
 * @returns {{ low: number, high: number }}
 */
export function monthlyEarn({ spendMonthly, rateLow, rateHigh, expiring = 0 }) {
  if (spendMonthly < 0) throw new InsufficientData('spend cannot be negative');
  if (!(rateLow > 0)) throw new InsufficientData(`rateLow must be > 0 (got ${rateLow})`);
  if (rateHigh < rateLow) throw new InsufficientData('rateHigh < rateLow');
  const base = { low: spendMonthly * rateLow, high: spendMonthly * rateHigh };
  // Expiry subtracts ONCE, from the base, then clamps (never re-subtracted
  // from future months — that would double-count the same points).
  return {
    low: Math.max(0, base.low - expiring),
    high: Math.max(0, base.high - expiring),
  };
}

/**
 * "Cuando tendré suficientes": months at the LOW end must be feasible for the
 * low end to carry the verdict (D26). monthlyEarn ≤ 0 → never feasible → the
 * designed accelerator-card path (T1 persona case), NOT a dead end.
 * @param {number} gap
 * @param {number} monthlyEarnLow
 * @param {number} monthlyEarnHigh
 * @param {Date} [today]
 * @returns {{ feasible: boolean, by_date: string|null, by_date_high: string|null, months_low: number|null }}
 */
export function enoughBy(gap, monthlyEarnLow, monthlyEarnHigh, today = new Date()) {
  if (gap < 0) throw new InsufficientData('gap cannot be negative');
  if (monthlyEarnHigh < 0 || monthlyEarnLow < 0 || monthlyEarnLow > monthlyEarnHigh) {
    throw new InsufficientData('incoherent monthly earn range');
  }
  if (monthlyEarnHigh <= 0) {
    return { feasible: false, by_date: null, by_date_high: null, months_low: null };
  }
  const monthsLow = monthlyEarnLow <= 0 ? null : gap / monthlyEarnLow;
  const monthsHigh = gap / monthlyEarnHigh;
  const iso = (months) =>
    (months === null ? null : new Date(today.getTime() + Math.ceil(months) * 30).toISOString().slice(0, 10));
  return {
    feasible: monthsLow !== null && Number.isFinite(monthsLow),
    by_date: iso(monthsLow),
    by_date_high: iso(monthsHigh),
    months_low: monthsLow === null ? null : Math.ceil(monthsLow),
  };
}

/**
 * Typed balances are capped so no absurd render reaches the card (report #A1).
 * @param {number} balance
 */
export function sanitizeBalance(balance) {
  if (!Number.isInteger(balance) || balance < 0) throw new InsufficientData(`balance must be a non-negative integer (got ${balance})`);
  if (balance > 10_000_000) throw new InsufficientData(`balance over sanity ceiling 10,000,000 (got ${balance})`);
  return balance;
}
