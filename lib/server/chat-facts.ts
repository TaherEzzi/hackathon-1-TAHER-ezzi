/**
 * lib/server/chat-facts.ts — turns an engine result into short English
 * sentences a traveller can read. The chat model only rewords these (or
 * translates them), so it never sees field names or verdict codes, and every
 * number it can quote comes from the engine untouched.
 */
import type { RunwayCandidate, RunwayResult } from "./engine";
import type { BookNowVerdict } from "./verdict-engine";

const DATE_PARTS = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function day(iso: string, withWeekday = true): string {
  const parts = DATE_PARTS.formatToParts(new Date(`${iso}T00:00:00Z`));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const date = `${part("day")} ${part("month")} ${part("year")}`;
  return withWeekday ? `${part("weekday")} ${date}` : date;
}

function money(amount: number, currency: string): string {
  if (!/^[A-Z]{3}$/.test(currency)) return `${amount} ${currency}`;
  const cents = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: cents, maximumFractionDigits: 2 }).format(amount);
}

const points = (n: number) => new Intl.NumberFormat("en-GB").format(n);

function isEstimate(cash: { badge: string; projected?: boolean }): boolean {
  return cash.projected === true || cash.badge !== "en vivo";
}

const ESTIMATE = "These prices are estimates, not live fares, so they can still change.";

function runwayVerdict(rec: RunwayCandidate, pointsHeld: number | undefined): string[] {
  const saving = rec.savings_eur !== null ? money(rec.savings_eur, rec.cash.currency) : null;
  if (rec.verdict === "usar_puntos") {
    const needs = rec.miles_needed !== null ? ` The reward ticket needs ${points(rec.miles_needed)} points.` : "";
    return [`My recommendation is to use your points${saving ? `: it saves about ${saving} compared with paying cash.` : "."}${needs}`];
  }
  if (rec.verdict === "insufficient_data") {
    return ["There is not enough data to compare points and cash for that day, so treat the cash price as a guide."];
  }
  if (rec.miles_needed !== null) {
    // Pay cash here means the balance will not reach the reward price by the trip;
    // savings_eur is then what the points held by that date are worth off the fare.
    const balance = pointsHeld !== undefined ? `you have ${points(pointsHeld)} today, which` : "your points";
    const facts = [
      `My recommendation is to pay cash: a reward ticket needs ${points(rec.miles_needed)} points, and ${balance} will not reach that by then.`,
    ];
    if (saving) facts.push(`The points you will have by then are still worth about ${saving} off the cash price.`);
    return facts;
  }
  return ["My recommendation is to pay cash, because points do not give good value on this trip."];
}

function runwayProgress(rec: RunwayCandidate): string[] {
  if (!rec.enough_by || rec.verdict === "usar_puntos") return [];
  if (rec.enough_by.feasible && rec.enough_by.by_date) {
    return [`At your current spending you would have enough points by ${day(rec.enough_by.by_date, false)}.`];
  }
  if (!rec.enough_by.feasible) return ["At your current spending you would not collect enough points before this trip."];
  return [];
}

/** `pointsHeld` is undefined when the traveller never said, so no balance is claimed. */
export function runwayFacts(result: RunwayResult, pointsHeld: number | undefined): string[] {
  const rec = result.recommended;
  if (!rec) return ["I could not price any day in that window yet. Try dates closer in, or check the route."];
  const facts = [`The best day to fly is ${day(rec.depart_date)}, at ${money(rec.cash.amount, rec.cash.currency)} in cash.`];
  facts.push(...runwayVerdict(rec, pointsHeld), ...runwayProgress(rec));
  const alt = result.alternative;
  if (alt) facts.push(`The next best day is ${day(alt.depart_date)}, at ${money(alt.cash.amount, alt.cash.currency)}.`);
  if (isEstimate(rec.cash)) facts.push(ESTIMATE);
  return facts;
}

export function bookNowFacts(result: BookNowVerdict, departDate: string): string[] {
  const when = day(departDate);
  const facts = [result.cash ? `The cash fare on ${when} is ${money(result.cash.amount, result.cash.currency)}.` : `I could not find a cash fare for ${when}.`];
  if (result.award) {
    const taxes = money(result.award.taxes.amount, result.award.taxes.currency);
    facts.push(`With points it costs ${points(result.award.miles)} points plus ${taxes} in taxes.`);
  }
  if (result.verdict === "usar_puntos") {
    const saving = result.savings_eur !== null ? `: it saves about ${money(result.savings_eur, result.cash?.currency ?? "EUR")}.` : ".";
    facts.push(`My recommendation is to use your points${saving}`);
  } else if (result.verdict === "pagar_en_efectivo") {
    facts.push("My recommendation is to pay cash, because points do not give good value here.");
  } else {
    facts.push("There is not enough data to compare points and cash for this route yet.");
  }
  if (result.cash && isEstimate(result.cash)) facts.push(ESTIMATE);
  return facts;
}
