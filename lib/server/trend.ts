/**
 * lib/server/trend.ts — trendFor(t), D27: the price-trend input of the D21
 * valueScore. A labelled seasonal-curve FIXTURE — never 'en vivo', no live
 * historic-fare provider exists in the stack (decision.md D27). Every value it
 * feeds is consequently badged `estimación` with its source shown.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InsufficientData } from "../engine/verdict.mjs";

export interface TrendFixture {
  label: string;
  source: string;
  verified_at: string;
  note: string;
  monthly_factor: Record<string, number>;
}

/** Resolved from process.cwd() — `new URL(…, import.meta.url)` breaks under Next's bundled server. */
export function loadTrendFixture(path?: string | URL): TrendFixture {
  const file = path ?? join(process.cwd(), "data", "trend-fixture.json");
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new InsufficientData(`trend fixture: unreadable — ${err instanceof Error ? err.message : String(err)}`);
  }
  const f = raw as TrendFixture;
  if (f?.label !== "estimación" || !f?.source || !/^\d{4}-\d{2}-\d{2}$/.test(f?.verified_at ?? "")) {
    throw new InsufficientData("trend fixture: label/source/verified_at malformed");
  }
  const mf = f.monthly_factor ?? {};
  for (const m of ["1","2","3","4","5","6","7","8","9","10","11","12"]) {
    const v = Number(mf[m]);
    if (!Number.isFinite(v) || v <= 0) throw new InsufficientData(`trend fixture: monthly_factor[${m}] missing or not positive`);
  }
  return f;
}

/** Trend multiplier for a date, with its honest source label attached. */
export function trendFor(fixture: TrendFixture, date: string | Date): { factor: number; source: string; label: "estimación"; verified_at: string } {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00Z`) : date;
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2020) {
    throw new InsufficientData(`trend date invalid: ${String(date)}`);
  }
  const key = String(d.getUTCMonth() + 1);
  const factor = Number(fixture.monthly_factor[key]);
  if (!(factor > 0)) throw new InsufficientData(`trend fixture: no factor for month ${key}`);
  return { factor, source: fixture.source, label: "estimación", verified_at: fixture.verified_at };
}
