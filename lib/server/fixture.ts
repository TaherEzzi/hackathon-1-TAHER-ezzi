/**
 * lib/server/fixture.ts — labelled award fixture loader + validation (D29/D30).
 *
 * The award side of the stack is the fixture (no paid keys, §2): badged
 * `estimación` ALWAYS, age = its verified_at. Loader validates the schema and
 * throws InsufficientData('fixture: …') on anything malformed — never a silent
 * fallback, never an invented value. A route absent from the fixture is the
 * D19 card-gate analogue on the award side: the engine simply has no data.
 */
import { readFileSync } from "node:fs";
import { priceBadge, InsufficientData } from "../engine/verdict.mjs";

const PROGRAM_CODES = new Set(["BA", "IB", "VY", "EI", "AY", "QR", "REVOLUT", "AMEX_ES"]);
const CABINS = new Set(["economy", "premium", "business", "first"]);
const SEATS_STATES = new Set(["unknown", "1", "2", "4"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONEY = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

export interface FixtureRoute {
  origin: string;
  destination: string;
  airline_program: string;
  cabin: string;
  miles_one_way: number;
  taxes: { amount: number; currency: string };
  seats: string;
}

export interface AwardFixture {
  label: string;
  verified_at: string;
  source: string;
  routes: FixtureRoute[];
}

/** Validate the whole file; throw InsufficientData('fixture: …') on anything malformed. */
export function validateAwardFixture(raw: unknown): AwardFixture {
  const f = raw as AwardFixture;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new InsufficientData("fixture: file must be a JSON object");
  }
  if (f.label !== "estimación") {
    throw new InsufficientData(`fixture: label must be 'estimación' (got ${JSON.stringify(f.label)})`);
  }
  if (!ISO_DATE.test(f.verified_at ?? "") || Number.isNaN(new Date(`${f.verified_at}T00:00:00Z`).getTime())) {
    throw new InsufficientData(`fixture: verified_at must be an ISO date YYYY-MM-DD (got ${String(f.verified_at)})`);
  }
  if (typeof f.source !== "string" || f.source.trim() === "") {
    throw new InsufficientData("fixture: source must be a non-empty string");
  }
  if (!Array.isArray(f.routes)) {
    throw new InsufficientData("fixture: routes must be an array (empty is valid — absent routes ⇒ insufficient_data)");
  }
  const seen = new Set<string>();
  f.routes.forEach((r, i) => {
    const at = (id: string, value: unknown, why: string): never => {
      throw new InsufficientData(`fixture: route #${i} ${id}: ${why} (got ${JSON.stringify(value)})`);
    };
    if (!/^[A-Z]{3}$/.test(r.origin ?? "")) at("origin", r.origin, "must be 3 uppercase letters");
    if (!/^[A-Z]{3}$/.test(r.destination ?? "")) at("destination", r.destination, "must be 3 uppercase letters");
    if (!PROGRAM_CODES.has(r.airline_program ?? "")) {
      at("airline_program", r.airline_program, `must be one of ${[...PROGRAM_CODES].join("/")}`);
    }
    if (!CABINS.has(r.cabin ?? "")) at("cabin", r.cabin, `must be one of ${[...CABINS].join("/")}`);
    // §5.4: 0 is not a real value. An unverified number means the row is absent —
    // anything that does appear must be a real positive integer miles count.
    if (!Number.isInteger(r.miles_one_way) || (r.miles_one_way as number) < 1) {
      at("miles_one_way", r.miles_one_way, "must be an integer ≥ 1 (0 is not a real value)");
    }
    if (!ISO_MONEY(r.taxes?.amount)) at("taxes.amount", r.taxes?.amount, "must be a finite number ≥ 0");
    if (!/^[A-Z]{3}$/.test(r.taxes?.currency ?? "")) at("taxes.currency", r.taxes?.currency, "must be a 3-letter ISO currency");
    if (!SEATS_STATES.has(String(r.seats ?? ""))) at("seats", r.seats, `must be one of ${[...SEATS_STATES].join("/")}`);
    const key = `${r.origin}:${r.destination}:${r.airline_program}:${r.cabin}`;
    if (seen.has(key)) at("(duplicate)", key, `route already present (one entry per origin:destination:program:cabin)`);
    seen.add(key);
  });
  return f;
}

/**
 * Load + validate data/award-fixture.json. Optional path override for tests.
 */
export function loadAwardFixture(path = new URL("../../data/award-fixture.json", import.meta.url)): AwardFixture {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path as any, "utf8"));
  } catch (err) {
    throw new InsufficientData(`fixture: unreadable file — ${err instanceof Error ? err.message : String(err)}`);
  }
  return validateAwardFixture(parsed);
}

export interface FixtureIndex {
  /** map key origin:destination:program:cabin → route */
  byRoute: Map<string, FixtureRoute>;
  verified_at: string;
  source: string;
}

export function indexFixture(fixture: AwardFixture): FixtureIndex {
  const byRoute = new Map<string, FixtureRoute>();
  for (const r of fixture.routes) {
    byRoute.set(`${r.origin}:${r.destination}:${r.airline_program}:${r.cabin}`, r);
  }
  return { byRoute, verified_at: fixture.verified_at, source: fixture.source };
}

export interface AwardQuote {
  miles: number;
  taxes: { amount: number; currency: string };
  seats: string;
  /** fixture badge is always 'estimación' (never fresh), with verified_at as its age */
  badge: { badge: "estimación"; stale: boolean; age_hours: number; verified_at: string };
}

/**
 * The one award lookup the engine gets per (route, program, cabin). Returns
 * null when the route entry is absent — the caller turns that into the typed
 * InsufficientData / 'insufficient_data' verdict (correct behaviour, D19-analogue).
 */
export function fixtureQuote(
  index: FixtureIndex,
  { origin, destination, airline_program, cabin, now }: {
    origin: string; destination: string; airline_program: string; cabin: string; now?: Date;
  },
): AwardQuote | null {
  const route = index.byRoute.get(`${origin}:${destination}:${airline_program}:${cabin}`);
  if (!route) return null;
  const b = priceBadge({ kind: "fixture", fetchedAt: `${index.verified_at}T00:00:00Z`, now, maxAgeHours: 24 });
  return {
    miles: route.miles_one_way,
    taxes: route.taxes,
    seats: route.seats,
    badge: { badge: "estimación", stale: b.stale, age_hours: b.age_hours, verified_at: index.verified_at },
  };
}
