/**
 * lib/server/chat-turn.ts — one sessioned chat turn, with every side effect
 * injected (model, engine, explain, save). The model proposes facts and a
 * reply; chat-slots decides whether to answer, ask, or compute; the engine
 * computes; a saved plan returns the URL the chat page opens.
 */
import {
  askFor,
  cardCodeFor,
  decideTurn,
  dropPastDates,
  mergeSlots,
  revolutPlanFor,
  travelWindow,
  type ChatSlots,
  type SlotName,
  type TurnAction,
} from "./chat-slots";
import { bookNowFacts, runwayFacts } from "./chat-facts";
import { bookNowRow, planUrl, runwayRow, type BookNowResult, type ItineraryInsert, type PlanInputs } from "./itinerary-row";
import type { BookNowInput, RunwayInput, RunwayResult } from "./engine";

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ModelTurn {
  action: TurnAction;
  reply: string;
  /** Proposed facts; validated by mergeSlots before anything is stored. */
  slots: unknown;
}

export interface ModelTurnInput {
  history: ChatHistoryMessage[];
  text: string;
  slots: ChatSlots;
  today: string;
}

export interface ChatTurnDeps {
  userId: string;
  today: string;
  model: (input: ModelTurnInput) => Promise<ModelTurn>;
  runway: (input: RunwayInput) => Promise<RunwayResult>;
  bookNow: (input: BookNowInput) => Promise<BookNowResult>;
  /** Rewords the plain-language facts in the traveller's language. */
  explain: (facts: string[], text: string) => Promise<string>;
  /** Persists the itinerary and returns its id. */
  save: (row: ItineraryInsert) => Promise<string>;
}

export interface ChatTurnInput {
  slots: ChatSlots;
  history: ChatHistoryMessage[];
  text: string;
}

export interface ChatTurnOutcome {
  kind: "answer" | "ask" | "runway" | "book_now";
  reply: string;
  slots: ChatSlots;
  missing: SlotName[];
  payload: Record<string, unknown> | null;
  itinerary_id: string | null;
  plan_url: string | null;
  explained_by: "grok" | "local_fallback" | null;
}

export async function runChatTurn(deps: ChatTurnDeps, input: ChatTurnInput): Promise<ChatTurnOutcome> {
  const model = await deps.model({ history: input.history, text: input.text, slots: input.slots, today: deps.today });
  const merged = mergeSlots(input.slots, model.slots);
  const slots = dropPastDates(merged, deps.today);
  const decision = decideTurn(slots, model.action);
  const base = { slots, payload: null, itinerary_id: null, plan_url: null, explained_by: null };

  if (decision.kind === "answer") {
    return { ...base, kind: "answer", missing: [], reply: model.reply.trim() || "Could you say that another way?" };
  }
  if (decision.kind === "ask") {
    return { ...base, kind: "ask", missing: decision.missing, reply: askReply(model.reply, merged, slots, decision.missing) };
  }

  const computed = decision.engine === "book_now" ? await computeBookNow(deps, slots) : await computeRunway(deps, slots);
  const facts = computed.row ? [...computed.facts, "Your full plan is saved, and I am opening it for you now."] : computed.facts;
  const { text: reply, by } = await explainOrSummarise(deps, facts, input.text, decision.engine);
  const id = computed.row ? await deps.save({ ...computed.row, explanation: reply.slice(0, 4000) }) : null;
  return {
    ...base,
    kind: decision.engine,
    missing: [],
    reply,
    payload: computed.payload,
    itinerary_id: id,
    plan_url: id ? planUrl(id) : null,
    explained_by: by,
  };
}

/**
 * The model may believe it has everything and announce a search; when the
 * server still finds a gap, an ask turn must actually ask, not promise prices.
 */
function askReply(modelReply: string, merged: ChatSlots, kept: ChatSlots, missing: readonly SlotName[]): string {
  const dropped = missing.includes("dates") ? droppedDate(merged, kept) : null;
  if (dropped) {
    const rest = missing.filter((m) => m !== "dates");
    const more = rest.length > 0 ? ` ${askFor(rest)}` : "";
    return `${dropped} has already passed. Which date in the future would you like to travel?${more}`;
  }
  const reply = modelReply.trim();
  return reply.includes("?") ? reply : askFor(missing);
}

function droppedDate(merged: ChatSlots, kept: ChatSlots): string | null {
  if (merged.depart_date && !kept.depart_date) return merged.depart_date;
  if (merged.window && !kept.window) return merged.window.start;
  return null;
}

interface Computed {
  payload: Record<string, unknown>;
  row: ItineraryInsert | null;
  /** Plain sentences for the traveller; the explainer only rewords them. */
  facts: string[];
}

/** Callers reach this only after missingSlots() is empty, so every required slot is set. */
function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`chat turn: slot ${name} missing at compute time`);
  return value;
}

async function computeRunway(deps: ChatTurnDeps, slots: ChatSlots): Promise<Computed> {
  const cards = required(slots.cards, "cards");
  const inputs: PlanInputs = {
    origin: required(slots.origin, "origin"),
    destination: required(slots.destination, "destination"),
    window: travelWindow(slots, deps.today),
    cabin: required(slots.cabin, "cabin"),
    pax: slots.pax ?? 1,
    travel_date: slots.depart_date ?? null,
    cards,
    points_held: slots.points_held ?? 0,
    monthly_total: required(slots.monthly_total, "monthly_total"),
    spend: slots.spend ?? {},
    plan: revolutPlanFor(cards),
  };
  const result = await deps.runway({
    origin: inputs.origin,
    destination: inputs.destination,
    window: inputs.window,
    cabin: inputs.cabin,
    pax: inputs.pax,
    card: cardCodeFor(cards),
    plan: inputs.plan,
    cards,
    spend: inputs.spend,
    pointsHeld: inputs.points_held,
    monthlyTotal: inputs.monthly_total,
  });
  return {
    payload: result as unknown as Record<string, unknown>,
    row: runwayRow(deps.userId, inputs, result),
    facts: runwayFacts(result, slots.points_held),
  };
}

async function computeBookNow(deps: ChatTurnDeps, slots: ChatSlots): Promise<Computed> {
  const cards = required(slots.cards, "cards");
  const input: BookNowInput = {
    origin: required(slots.origin, "origin"),
    destination: required(slots.destination, "destination"),
    depart_date: required(slots.depart_date, "depart_date"),
    cabin: required(slots.cabin, "cabin"),
    pax: slots.pax ?? 1,
    card: cardCodeFor(cards),
    plan: revolutPlanFor(cards),
  };
  const result = await deps.bookNow(input);
  return {
    payload: result as unknown as Record<string, unknown>,
    row: bookNowRow(deps.userId, { mode: "book_now", ...input }, result),
    facts: bookNowFacts(result, input.depart_date),
  };
}

async function explainOrSummarise(
  deps: ChatTurnDeps,
  facts: string[],
  text: string,
  engine: "runway" | "book_now",
): Promise<{ text: string; by: "grok" | "local_fallback" }> {
  try {
    const out = await deps.explain(facts, text);
    if (out.trim()) return { text: out.trim(), by: "grok" };
    console.error("chat explain returned empty text", { engine });
  } catch (error) {
    console.error("chat explain failed, using the plain facts", { engine, error });
  }
  return { text: facts.join(" "), by: "local_fallback" };
}
