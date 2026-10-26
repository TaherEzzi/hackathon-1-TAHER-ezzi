/**
 * lib/server/duffel.ts — cash-side provider (Duffel, TEST MODE ONLY — D25/D31).
 *
 * Flow (F8 / §5.3):  offer request → pick cheapest sane offer → RE-VERIFY the
 * price on the chosen offer → (route layer) order with the test payment type.
 * Never `search → pay → book` — offers move; we never pay off a snapshot.
 *
 * Honesty: every money figure is normalised to {amount, currency} and every
 * response carries fetched_at; failures are typed ProviderError (never silent,
 * never turned into a zero price). The key is never printed, never returned.
 */
import { ProviderError } from "../engine/verdict.mjs";
import { cachedProviderCall, buildCacheKey, type CacheStore, type BadgedResult } from "./cache";

const BASE = "https://api.duffel.com";
const DUFFEL_VERSION = "v2";
export const PROVIDER = "duffel";

/** Assert the test-mode prefix at every use — production pricing is never crossed (D29). */
export function duffelKey(): string {
  const key = process.env.duffel_api_key;
  if (!key || !key.startsWith("duffel_test_")) {
    throw new ProviderError(PROVIDER, "duffel_api_key missing or not a duffel_test_ token (test mode only, D29)");
  }
  return key;
}

export interface Money {
  amount: number;
  currency: string;
}

export interface DuffelOffer {
  id: string;
  owner_name: string;
  owner_iata: string | null;
  total: Money;
  expires_at: string | null;
  cabin_class: string | null;
  slices: Array<{ origin: string; destination: string; departure_date: string }>;
  /** offer passenger ids — an order attaches identity to these, not to free-form pax */
  passenger_ids: string[];
}

export interface OfferRequestParams {
  origin: string;
  destination: string;
  /** single ISO date, or a {from,to} window for the ONE ranged cash query (F12 step 2) */
  departure_date: string | { from: string; to: string };
  cabin: "economy" | "premium" | "business" | "first";
  pax: number; // 1..9, engine-enforced upstream
  currency?: string;
}

type DuffelErrorShape = {
  code?: string;
  title?: string;
  detail?: string;
  message?: string;
};

function summariseErrors(errors: unknown): string {
  const list = Array.isArray(errors) ? (errors as DuffelErrorShape[]) : [];
  if (list.length === 0) return "unparsable error response";
  return list.map((e) => [e.code, e.title, e.detail ?? e.message].filter(Boolean).join(": ")).join(" | ").slice(0, 400);
}

/** One typed HTTP round-trip; throws ProviderError('duffel', …) on any failure. */
export async function duffelFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const key = duffelKey();
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        "Duffel-Version": DUFFEL_VERSION,
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip",
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    throw new ProviderError(PROVIDER, err instanceof Error ? (err.cause ? `network: ${String(err.cause)}` : err.message) : String(err));
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    throw new ProviderError(PROVIDER, `HTTP ${res.status}: non-JSON response`);
  }
  if (!res.ok) {
    const payload = body as { errors?: unknown };
    throw new ProviderError(PROVIDER, `HTTP ${res.status}: ${summariseErrors(payload?.errors)}`);
  }
  return (body as { data?: T }).data ?? (body as T);
}

function normaliseOffer(o: any): DuffelOffer {
  const owner = o?.owner ?? {};
  return {
    id: String(o.id),
    owner_name: owner.name ?? owner.airline_name ?? "unknown",
    owner_iata: owner.iata_code ?? null,
    total: normaliseMoney(o.total_amount, o.total_currency),
    expires_at: o.expires_at ?? null,
    cabin_class: o.cabin_class ?? null,
    slices: Array.isArray(o.slices)
      ? o.slices.map((s: any) => ({
          origin: s.origin?.iata_code ?? s.origin ?? "",
          destination: s.destination?.iata_code ?? s.destination ?? "",
          departure_date: s.departure_date ?? "",
        }))
      : [],
    passenger_ids: Array.isArray(o.passengers) ? o.passengers.map((p: any) => p.id).filter(Boolean) : [],
  };
}

/** All money normalises to {amount, currency} (§5.3). */
export function normaliseMoney(amount: unknown, currency: unknown): Money {
  const num = Number(amount);
  if (!Number.isFinite(num) || !currency || typeof currency !== "string") {
    throw new ProviderError(PROVIDER, `offer total unreadable (amount=${String(amount)} currency=${String(currency)})`);
  }
  return { amount: num, currency };
}

export interface OfferRequestResult {
  offer_request_id: string;
  offers: DuffelOffer[];
  live_mode: boolean;
}

export async function requestOffers(params: OfferRequestParams): Promise<OfferRequestResult> {
  const body = {
    data: {
      cabin_class: params.cabin,
      passengers: Array.from({ length: params.pax }, () => ({ type: "adult" })),
      slices: [{ origin: params.origin, destination: params.destination, departure_date: params.departure_date }],
      return_offers: true,
      ...(params.currency ? { currency: params.currency } : {}),
    },
  };
  const data = await duffelFetch<any>("/air/offer_requests?return_offers=true", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return {
    offer_request_id: data.id,
    live_mode: Boolean(data.live_mode),
    offers: (data.offers ?? []).map(normaliseOffer),
  };
}

/**
 * The one live re-verification before any order (F8; §5.3). The invariant is
 * "re-verify the chosen offer on its own endpoint before any order" — in the
 * live Duffel v2 API that endpoint is `GET /air/offers/{id}` and returns the
 * ADJUSTED, latest total (the §5.3 `POST /air/offers/{id}` form 404s in v2;
 * verified 2026-10-26). A GET 404 is a typed ProviderError, never silence.
 */
export async function repriceOffer(offerId: string): Promise<DuffelOffer> {
  const offer = await duffelFetch<any>(`/air/offers/${offerId}`, { method: "GET" });
  if (!offer?.id) throw new ProviderError(PROVIDER, `re-price returned no offer for ${offerId}`);
  const normalised = normaliseOffer(offer);
  if (normalised.id !== offerId) {
    throw new ProviderError(PROVIDER, `re-price id mismatch: asked ${offerId} got ${normalised.id}`);
  }
  return normalised;
}

export type TestOrderPassenger = {
  /** the offer's passenger id to attach the identity to */
  id: string;
  title: string;
  /** Duffel order-passenger field names (NOT first_name/last_name) */
  given_name: string;
  family_name: string;
  born_on?: string;
  gender?: string;
  email?: string;
  phone_number?: string;
};

export interface TestOrderInput {
  /** the VERIFIED offer (offer → re-verify → order; never a search snapshot) */
  offer: DuffelOffer;
  passengers: TestOrderPassenger[];
  contact_email: string;
  contact_phone?: string;
}

export interface TestOrderResult {
  id: string;
  status: string;
  booking_reference: string | null;
  total: Money;
  airline: string;
  live_mode: boolean;
}

/** Test-mode order (F8 happy path 1; D31: sandbox airline, simulated payment, dummy reference). */
export async function createTestOrder(input: TestOrderInput): Promise<TestOrderResult> {
  if (input.offer.passenger_ids.length === 0) {
    throw new ProviderError(PROVIDER, `offer ${input.offer.id} carries no passenger ids — cannot issue an order`);
  }
  const body = {
    data: {
      selected_offers: [input.offer.id],
      passengers: input.passengers.length > 0
        ? input.passengers
        : input.offer.passenger_ids.map((id) => ({ id, title: "mr", given_name: "Travel", family_name: "Unknown" })),
      contact_email: input.contact_email,
      // Instant orders take the plural `payments` array (v2). The `balance`
      // type simulates the sandbox payment — amount/currency echo the verified
      // offer total so Duffel's test ledger matches; nothing real is charged (D31).
      payments: [
        { type: "balance", amount: String(input.offer.total.amount), currency: input.offer.total.currency },
      ],
      ...(input.contact_phone
        ? { contact: { phone_number: input.contact_phone, email: input.contact_email } }
        : {}),
    },
  };
  const order = await duffelFetch<any>("/air/orders", { method: "POST", body: JSON.stringify(body) });
  if (!order?.id) throw new ProviderError(PROVIDER, "order response carried no id");
  if (order.live_mode) throw new ProviderError(PROVIDER, "refusing a live-mode order — test mode only (D29/D31)");
  return {
    id: order.id,
    status: order.status ?? "unknown",
    booking_reference: order.booking_reference ?? null,
    total: normaliseMoney(order.total_amount, order.total_currency),
    airline: order.owner?.name ?? "unknown",
    live_mode: Boolean(order.live_mode),
  };
}

// ── cached entry points (§5.2: every provider call through dedupe + cache) ──

export interface CachedOffersOptions {
  params: OfferRequestParams;
  store: CacheStore;
  maxAgeHours: number;
  ttlHours?: number;
  now?: Date;
}

export type OfferRequestBadged = BadgedResult<OfferRequestResult>;

/**
 * The one ranged cash query for a request (F12 step 2, MUST #14): the cache key
 * keeps the §5.2 shape, with a `from..to` window in the date slot when the
 * request is ranged. In-flight duplicates share one promise.
 */
export function getOffersCached({ params, store, maxAgeHours, ttlHours = 24, now }: CachedOffersOptions): Promise<OfferRequestBadged> {
  const dateKey = typeof params.departure_date === "string"
    ? params.departure_date
    : `${params.departure_date.from}..${params.departure_date.to}`;
  const key = buildCacheKey({
    provider: PROVIDER,
    origin: params.origin,
    destination: params.destination,
    date: dateKey,
    cabin: params.cabin,
    pax: params.pax,
  });
  return cachedProviderCall({
    provider: PROVIDER,
    key,
    store,
    maxAgeHours,
    ttlHours,
    now,
    fetch: () => requestOffers(params),
  });
}

export type RepriceBadged = BadgedResult<DuffelOffer>;

/** Re-verify one chosen offer through the same cache+dedupe discipline (its key slot carries the offer id). */
export function repriceOfferCached({ offerId, store, maxAgeHours, ttlHours = 24, now }: Omit<CachedOffersOptions, "params"> & { offerId: string }): Promise<RepriceBadged> {
  const key = buildCacheKey({
    provider: PROVIDER,
    origin: "OFFER",
    destination: offerId,
    date: "verify",
    cabin: "single",
    pax: 1,
  });
  return cachedProviderCall({
    provider: PROVIDER,
    key,
    store,
    maxAgeHours,
    ttlHours,
    now,
    fetch: () => repriceOffer(offerId),
  });
}

/** Pick the cheapest sane offer: non-empty total in one currency, positive amount. */
export function cheapestSaneOffer(offers: DuffelOffer[], currency?: string): DuffelOffer | null {
  if (offers.length === 0) return null;
  const sane = offers.filter((o) => o.total.amount > 0 && (!currency || o.total.currency === currency));
  sane.sort((a, b) => a.total.amount - b.total.amount);
  return sane[0] ?? null;
}
