/**
 * lib/server/chat-slots.ts — the facts a chat session has gathered so far.
 * Pure functions only: the model proposes values, these decide what is
 * stored. A value that fails validation is dropped, never guessed, and a
 * missing value in a later turn never erases an earlier answer.
 */
import { z } from "zod";
import { CARD_PRODUCTS, SPEND_CATEGORIES, type CardProduct, type SpendCategory } from "./card-earn";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const CABINS = ["economy", "premium", "business", "first"] as const;
export type Cabin = (typeof CABINS)[number];

export interface ChatSlots {
  origin?: string;
  destination?: string;
  depart_date?: string;
  window?: { start: string; end: string };
  cabin?: Cabin;
  pax?: number;
  cards?: CardProduct[];
  points_held?: number;
  monthly_total?: number;
  spend?: Partial<Record<SpendCategory, number>>;
  mode?: "plan" | "book_now";
}

export type SlotName = "origin" | "destination" | "dates" | "cabin" | "cards" | "monthly_total";

export type TurnAction = "answer" | "search";

export type TurnDecision =
  | { kind: "answer" }
  | { kind: "ask"; missing: SlotName[] }
  | { kind: "compute"; engine: "runway" | "book_now" };

const iata = z.string().trim().regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase());
const isoDay = z.string().regex(ISO_DAY);
const windowSchema = z.object({ start: isoDay, end: isoDay }).refine((w) => w.start <= w.end);
const amount = z.number().finite().min(0).max(10_000_000);
/** The engine takes one balance; a per-card breakdown from the model is totalled. */
const pointsHeld = z.union([amount, z.record(amount).transform((byCard) => Object.values(byCard).reduce((sum, n) => sum + n, 0))]);

const FIELD: { [K in Exclude<keyof ChatSlots, "cards" | "spend">]-?: z.ZodType<NonNullable<ChatSlots[K]>, z.ZodTypeDef, unknown> } = {
  origin: iata,
  destination: iata,
  depart_date: isoDay,
  window: windowSchema,
  cabin: z.enum(CABINS),
  pax: z.number().int().min(1).max(9),
  points_held: pointsHeld,
  monthly_total: amount,
  mode: z.enum(["plan", "book_now"]),
};

const CARD_SET = new Set<string>(CARD_PRODUCTS);
const CATEGORY_SET = new Set<string>(SPEND_CATEGORIES);

function readCards(raw: unknown): CardProduct[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const cards = [...new Set(raw.filter((c): c is CardProduct => typeof c === "string" && CARD_SET.has(c)))];
  return cards.length > 0 ? cards : undefined;
}

function readSpend(raw: unknown): Partial<Record<SpendCategory, number>> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Partial<Record<SpendCategory, number>> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!CATEGORY_SET.has(key)) continue;
    const parsed = amount.safeParse(value);
    if (parsed.success) out[key as SpendCategory] = parsed.data;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Validate each proposed field on its own; return only the ones that pass. */
function validFields(raw: unknown): ChatSlots {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const out: ChatSlots = {};
  for (const key of Object.keys(FIELD) as Array<keyof typeof FIELD>) {
    const value = source[key];
    if (value === null || value === undefined) continue;
    const parsed = FIELD[key].safeParse(value);
    if (parsed.success) (out as Record<string, unknown>)[key] = parsed.data;
  }
  const cards = readCards(source.cards);
  if (cards) out.cards = cards;
  const spend = readSpend(source.spend);
  if (spend) out.spend = spend;
  return out;
}

/** Slots as stored in chat_sessions.slots (jsonb). */
export function readSlots(raw: unknown): ChatSlots {
  return validFields(raw);
}

/** Apply the model's proposed facts on top of what the session already knows. */
export function mergeSlots(prev: ChatSlots, update: unknown): ChatSlots {
  const next = validFields(update);
  const merged: ChatSlots = { ...prev };
  if (next.depart_date) delete merged.window;
  if (next.window) delete merged.depart_date;
  for (const [key, value] of Object.entries(next)) {
    if (key === "spend") continue;
    (merged as Record<string, unknown>)[key] = value;
  }
  if (next.spend) merged.spend = { ...prev.spend, ...next.spend };
  return merged;
}

export function missingSlots(slots: ChatSlots): SlotName[] {
  const missing: SlotName[] = [];
  if (!slots.origin) missing.push("origin");
  if (!slots.destination) missing.push("destination");
  if (!slots.depart_date && !slots.window) missing.push("dates");
  if (!slots.cabin) missing.push("cabin");
  if (!slots.cards || slots.cards.length === 0) missing.push("cards");
  if (slots.monthly_total === undefined) missing.push("monthly_total");
  return missing;
}

export function decideTurn(slots: ChatSlots, action: TurnAction): TurnDecision {
  if (action === "answer") return { kind: "answer" };
  const missing = missingSlots(slots);
  if (missing.length > 0) return { kind: "ask", missing };
  return { kind: "compute", engine: slots.mode === "book_now" && slots.depart_date ? "book_now" : "runway" };
}

/** A trip date already behind us cannot be priced or saved; forget it so the agent asks again. */
export function dropPastDates(slots: ChatSlots, today: string): ChatSlots {
  const out: ChatSlots = { ...slots };
  if (out.depart_date && out.depart_date < today) delete out.depart_date;
  if (out.window && out.window.end < today) delete out.window;
  return out;
}

/** Same rule as the planner page: any Amex card funds via Membership Rewards first. */
export function cardCodeFor(cards: readonly CardProduct[]): "AMEX_ES" | "REVOLUT" | null {
  if (cards.some((c) => c.startsWith("amex_"))) return "AMEX_ES";
  if (cards.some((c) => c.startsWith("revolut_"))) return "REVOLUT";
  return null;
}

export function revolutPlanFor(cards: readonly CardProduct[]): "premium" | "metal" | "ultra" | null {
  if (cards.includes("revolut_ultra")) return "ultra";
  if (cards.includes("revolut_metal")) return "metal";
  if (cards.includes("revolut_premium")) return "premium";
  return null;
}

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The runway window: the stated window, or three days either side of a date (as the planner does). */
export function travelWindow(slots: Pick<ChatSlots, "depart_date" | "window">, today: string): { start: string; end: string } {
  if (slots.window) return slots.window;
  const date = slots.depart_date ?? today;
  const start = shiftDay(date, -3);
  return { start: start < today ? today : start, end: shiftDay(date, 3) };
}

const QUESTION: Record<SlotName, string> = {
  origin: "where you are flying from",
  destination: "where you are flying to",
  dates: "when you want to travel (a date or a range)",
  cabin: "which cabin (economy, premium, business or first)",
  cards: "which cards you hold (for example Amex Gold or Revolut Metal)",
  monthly_total: "roughly how much you spend each month",
};

/** Plain question for the missing facts, used when the model returns no reply. */
export function askFor(missing: readonly SlotName[]): string {
  const parts = missing.map((m) => QUESTION[m]);
  if (parts.length === 0) return "";
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `To build your plan I still need to know ${list}.`;
}
