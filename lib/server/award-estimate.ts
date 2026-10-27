/**
 * Distance-band award and cash figures for a route the fixture and the model
 * both left blank. Every band is a one-way estimate so the planner can still
 * score a points discount.
 */

export interface AwardFigure {
  miles: number;
  taxes_eur: number;
}

export interface ResolvedAward extends AwardFigure {
  source: "fixture" | "model" | "chart";
}

export type Cabin = "economy" | "premium" | "business" | "first";

export class CabinError extends Error {
  readonly code = "bad_cabin" as const;
  constructor(cabin: string) {
    super(`cabin must be economy, premium, business, or first (got ${cabin})`);
    this.name = "CabinError";
  }
}

export function parseCabin(cabin: string): Cabin {
  if (cabin === "economy" || cabin === "premium" || cabin === "business" || cabin === "first") return cabin;
  throw new CabinError(cabin);
}

const AIRPORTS: Record<string, [number, number]> = {
  MAD: [40.47, -3.56],
  BCN: [41.3, 2.08],
  LIS: [38.77, -9.13],
  LHR: [51.47, -0.45],
  CDG: [49.01, 2.55],
  AMS: [52.31, 4.76],
  FRA: [50.04, 8.56],
  ZRH: [47.46, 8.55],
  FCO: [41.8, 12.25],
  MXP: [45.63, 8.72],
  DUB: [53.42, -6.27],
  VIE: [48.11, 16.57],
  CPH: [55.62, 12.65],
  ARN: [59.65, 17.92],
  HEL: [60.32, 24.96],
  WAW: [52.17, 20.97],
  ATH: [37.94, 23.94],
  IST: [41.26, 28.74],
  SVO: [55.97, 37.41],
  CAI: [30.12, 31.41],
  CMN: [33.37, -7.59],
  TLV: [32.0, 34.87],
  DXB: [25.25, 55.36],
  DOH: [25.27, 51.61],
  JFK: [40.64, -73.78],
  BOS: [42.36, -71.01],
  ORD: [41.97, -87.91],
  IAD: [38.95, -77.46],
  MIA: [25.8, -80.29],
  LAX: [33.94, -118.41],
  SFO: [37.62, -122.38],
  YYZ: [43.68, -79.63],
  MEX: [19.44, -99.07],
  BOG: [4.7, -74.15],
  LIM: [-12.02, -77.11],
  EZE: [-34.82, -58.54],
  SCL: [-33.39, -70.79],
  GRU: [-23.44, -46.47],
  GIG: [-22.81, -43.25],
  JNB: [-26.13, 28.24],
  CPT: [-33.97, 18.6],
  BKK: [13.69, 100.75],
  SIN: [1.36, 103.99],
  KUL: [2.75, 101.71],
  HKG: [22.31, 113.91],
  HND: [35.55, 139.78],
  ICN: [37.46, 126.44],
  PEK: [40.08, 116.58],
  PVG: [31.14, 121.81],
  DEL: [28.56, 77.1],
  SYD: [-33.95, 151.18],
  MEL: [-37.67, 144.84],
  AKL: [-37.01, 174.79],
};

/** Used when either airport is missing from the table. Long-haul, not a refusal. */
const UNKNOWN_ROUTE_KM = 6_000;

const BANDS: { maxKm: number; economy: number; taxes: number }[] = [
  { maxKm: 1_500, economy: 12_500, taxes: 45 },
  { maxKm: 4_000, economy: 25_000, taxes: 120 },
  { maxKm: 8_000, economy: 50_000, taxes: 200 },
  { maxKm: Infinity, economy: 70_000, taxes: 280 },
];

const CABIN_MILES: Record<Cabin, number> = { economy: 1, premium: 1.5, business: 2, first: 3 };
const CABIN_TAXES: Record<Cabin, number> = { economy: 1, premium: 1.5, business: 2, first: 2.5 };
const CASH_PER_KM: Record<Cabin, number> = { economy: 0.11, premium: 0.18, business: 0.32, first: 0.5 };
const CASH_FLOOR: Record<Cabin, number> = { economy: 70, premium: 140, business: 280, first: 500 };

function routeKm(origin: string, destination: string): number {
  const from = AIRPORTS[origin.toUpperCase()];
  const to = AIRPORTS[destination.toUpperCase()];
  if (!from || !to) return UNKNOWN_ROUTE_KM;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to[0] - from[0]);
  const dLon = toRad(to[1] - from[1]);
  const lat1 = toRad(from[0]);
  const lat2 = toRad(to[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function bandFor(km: number): { economy: number; taxes: number } {
  return BANDS.find((band) => km <= band.maxKm) ?? BANDS[BANDS.length - 1];
}

export function estimateAward(origin: string, destination: string, cabin: Cabin): AwardFigure {
  const band = bandFor(routeKm(origin, destination));
  return {
    miles: Math.round((band.economy * CABIN_MILES[cabin]) / 500) * 500,
    taxes_eur: Math.round(band.taxes * CABIN_TAXES[cabin]),
  };
}

export function estimateCashEur(origin: string, destination: string, cabin: Cabin): number {
  const km = routeKm(origin, destination);
  return Math.max(CASH_FLOOR[cabin], Math.round(km * CASH_PER_KM[cabin]));
}

export function awardForRoute(input: {
  fixture: AwardFigure | null;
  estimated: AwardFigure | null;
  origin: string;
  destination: string;
  cabin: Cabin;
}): ResolvedAward {
  if (input.fixture && input.fixture.miles > 0) {
    return { miles: input.fixture.miles, taxes_eur: input.fixture.taxes_eur, source: "fixture" };
  }
  if (input.estimated && input.estimated.miles > 0) {
    return { miles: input.estimated.miles, taxes_eur: input.estimated.taxes_eur, source: "model" };
  }
  return { ...estimateAward(input.origin, input.destination, input.cabin), source: "chart" };
}
