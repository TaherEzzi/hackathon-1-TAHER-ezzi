/**
 * Per-card, per-category earn rates and the assignment of each purchase
 * to the selected card that earns the most points.
 *
 * Amex ratios are the Spain Membership Rewards terms: Centurion 1.5/€,
 * Platinum and Business Platinum 1/€, Gold-class 1/2€ base, 1/€ on travel
 * merchants, 1/5€ in Spanish supermarkets. Revolut plans are flat.
 * Only cards the traveller selected are allowed to win a category.
 */
import { InsufficientData } from "../engine/verdict.mjs";

export const SPEND_CATEGORIES = ["fuel", "groceries", "dining", "shopping", "leisure", "transport", "travel"] as const;
export type SpendCategory = (typeof SPEND_CATEGORIES)[number];

export const CARD_PRODUCTS = [
  "amex_gold",
  "amex_green",
  "amex_business_gold",
  "amex_platinum",
  "amex_business_platinum",
  "amex_centurion",
  "revolut_premium",
  "revolut_metal",
  "revolut_ultra",
] as const;
export type CardProduct = (typeof CARD_PRODUCTS)[number];

const GOLD_CLASS = new Set<CardProduct>(["amex_gold", "amex_green", "amex_business_gold"]);

function ratesFor(product: CardProduct): Record<SpendCategory, number> {
  if (product === "amex_centurion") return flat(1.5);
  if (product === "amex_platinum" || product === "amex_business_platinum") return flat(1);
  if (GOLD_CLASS.has(product)) {
    return {
      fuel: 0.5,
      groceries: 0.2,
      dining: 0.5,
      shopping: 0.5,
      leisure: 0.5,
      transport: 0.5,
      travel: 1,
    };
  }
  if (product === "revolut_premium") return flat(0.25);
  if (product === "revolut_metal") return flat(0.5);
  return flat(1);
}

function flat(rate: number): Record<SpendCategory, number> {
  return {
    fuel: rate,
    groceries: rate,
    dining: rate,
    shopping: rate,
    leisure: rate,
    transport: rate,
    travel: rate,
  };
}

export const CARD_RATE_TABLE: Record<CardProduct, Record<SpendCategory, number>> = {
  amex_gold: ratesFor("amex_gold"),
  amex_green: ratesFor("amex_green"),
  amex_business_gold: ratesFor("amex_business_gold"),
  amex_platinum: ratesFor("amex_platinum"),
  amex_business_platinum: ratesFor("amex_business_platinum"),
  amex_centurion: ratesFor("amex_centurion"),
  revolut_premium: ratesFor("revolut_premium"),
  revolut_metal: ratesFor("revolut_metal"),
  revolut_ultra: ratesFor("revolut_ultra"),
};

export function pointsPerEuro(product: CardProduct, category: SpendCategory): number {
  return CARD_RATE_TABLE[product][category];
}

export interface CategoryAssignment {
  category: SpendCategory;
  euros: number;
  card: CardProduct;
  pointsPerEuro: number;
  points: number;
}

export interface SpendBonus {
  card: CardProduct;
  spendEuros: number;
  thresholdEuros: number;
  points: number;
  /** How many months the extra points are paid. Amex España welcome offers stop after 10. */
  months: number;
}

export interface SpendBonusRule {
  card: CardProduct;
  thresholdEuros: number;
  points: number;
  months: number;
}

/** Welcome spend offers published by American Express España. Each bonus is paid only on the spend that lands on that card. */
export const SPEND_BONUS_RULES: readonly SpendBonusRule[] = [
  { card: "amex_gold", thresholdEuros: 1_000, points: 2_000, months: 10 },
  { card: "amex_platinum", thresholdEuros: 1_500, points: 5_000, months: 10 },
  { card: "amex_business_platinum", thresholdEuros: 4_000, points: 5_000, months: 10 },
];

export interface CardRouting {
  routes: CategoryAssignment[];
  monthlyPoints: number;
  /** 2 when any selected card is Amex: Amex Travel Spain only, not the travel row. */
  amexTravelPerEuro: number | null;
  bonuses: SpendBonus[];
}

function bestCard(cards: readonly CardProduct[], category: SpendCategory): { card: CardProduct; rate: number } {
  const first = cards[0];
  if (first === undefined) throw new InsufficientData("routing: no card selected");
  let card = first;
  let rate = pointsPerEuro(card, category);
  for (const next of cards.slice(1)) {
    const nextRate = pointsPerEuro(next, category);
    if (nextRate > rate) {
      card = next;
      rate = nextRate;
    }
  }
  return { card, rate };
}

function amountsForBudget(
  spend: Partial<Record<SpendCategory, number>>,
  monthlyTotal: number | undefined,
): Partial<Record<SpendCategory, number>> {
  const amounts: Partial<Record<SpendCategory, number>> = {};
  for (const category of SPEND_CATEGORIES) {
    const euros = spend[category] ?? 0;
    if (euros > 0) amounts[category] = euros;
  }
  if (monthlyTotal === undefined) return amounts;
  const assigned = SPEND_CATEGORIES.reduce((sum, category) => sum + (amounts[category] ?? 0), 0);
  const remainder = Math.max(0, monthlyTotal - assigned);
  const empty = SPEND_CATEGORIES.filter((category) => amounts[category] === undefined);
  if (!(remainder > 0) || empty.length === 0) return amounts;
  const whole = Math.round(remainder);
  const base = Math.floor(whole / empty.length);
  let extra = whole - base * empty.length;
  for (const category of empty) {
    const euros = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    if (euros > 0) amounts[category] = euros;
  }
  return amounts;
}

function bonusesFor(spendByCard: ReadonlyMap<CardProduct, number>): SpendBonus[] {
  const bonuses: SpendBonus[] = [];
  for (const rule of SPEND_BONUS_RULES) {
    const spendEuros = spendByCard.get(rule.card) ?? 0;
    if (spendEuros >= rule.thresholdEuros) {
      bonuses.push({
        card: rule.card,
        spendEuros,
        thresholdEuros: rule.thresholdEuros,
        points: rule.points,
        months: rule.months,
      });
    }
  }
  return bonuses;
}

export function bonusPointsByMonth(bonuses: readonly SpendBonus[], months: number): number {
  if (!Number.isInteger(months) || months < 0) {
    throw new InsufficientData("routing: bonus months must be a whole number ≥ 0");
  }
  return bonuses.reduce((sum, bonus) => {
    if (!Number.isFinite(bonus.points) || bonus.points < 0 || !Number.isInteger(bonus.months) || bonus.months < 0) {
      throw new InsufficientData("routing: a spend bonus must have finite points and a whole month count ≥ 0");
    }
    return sum + bonus.points * Math.min(months, bonus.months);
  }, 0);
}

export function routeSpend(
  selected: readonly CardProduct[],
  spend: Partial<Record<SpendCategory, number>>,
  monthlyTotal?: number,
): CardRouting {
  const unique = selected.filter((card, index) => selected.indexOf(card) === index);
  if (unique.length === 0) throw new InsufficientData("routing: no card selected");
  if (monthlyTotal !== undefined && (!Number.isFinite(monthlyTotal) || monthlyTotal < 0)) {
    throw new InsufficientData("routing: monthly total must be a finite amount ≥ 0");
  }
  for (const category of SPEND_CATEGORIES) {
    const euros = spend[category];
    if (euros === undefined) continue;
    if (!Number.isFinite(euros) || euros < 0) {
      throw new InsufficientData("routing: category spend must be a finite amount ≥ 0");
    }
  }
  const amounts = amountsForBudget(spend, monthlyTotal);
  const routes: CategoryAssignment[] = [];
  let monthlyPoints = 0;
  const spendByCard = new Map<CardProduct, number>();
  for (const category of SPEND_CATEGORIES) {
    const euros = amounts[category] ?? 0;
    if (!(euros > 0)) continue;
    const best = bestCard(unique, category);
    const points = Math.round(euros * best.rate);
    monthlyPoints += points;
    spendByCard.set(best.card, (spendByCard.get(best.card) ?? 0) + euros);
    routes.push({ category, euros, card: best.card, pointsPerEuro: best.rate, points });
  }
  const amexTravelPerEuro = unique.some((card) => card.startsWith("amex_")) ? 2 : null;
  return { routes, monthlyPoints, amexTravelPerEuro, bonuses: bonusesFor(spendByCard) };
}

export function discountEuros(input: {
  cashEur: number;
  taxesEur: number;
  milesNeeded: number;
  pointsHeld: number;
  monthlyPoints: number;
  months: number;
  extraPoints?: number;
}): number | null {
  if (input.extraPoints !== undefined && (!Number.isFinite(input.extraPoints) || input.extraPoints < 0)) {
    throw new InsufficientData("routing: extra points must be a finite amount ≥ 0");
  }
  const pointsAtDate = input.pointsHeld + input.monthlyPoints * input.months + (input.extraPoints ?? 0);
  if (!(input.milesNeeded > 0) || pointsAtDate < input.milesNeeded) return null;
  const saved = Math.round((input.cashEur - input.taxesEur) * 100) / 100;
  return saved > 0 ? saved : null;
}
