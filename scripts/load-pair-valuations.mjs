/**
 * scripts/load-pair-valuations.mjs — the D19 loader (§5.5), re-runnable.
 *
 * Fetches the official CC-BY-4.0 dataset (points-transfer-valuations,
 * WanderWise Guide) → upserts every (from_code → to_code) pair into
 * pair_valuations → writes ONE diff summary to audit_log (pairs changed,
 * old → new). Refuses to run if any row lacks source_url or verified_at. No
 * default/fallback values ever.
 *
 * UNIT CONTRACT (critical for the engine, D19/D20):
 *   The dataset publishes cppLow/cppHigh in **US CENTS per partner point**.
 *   pair_valuations.cpp_low/cpp_high store the dataset's literal numbers with
 *   currency='USD'. The consuming engine code converts (÷100 → USD per point,
 *   then dated FX → ticket currency) BEFORE any assertSameCurrency call — a raw
 *   table value must never reach computeVerdict unconverted.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL + supabase_secret_key from .env (service role —
 * the table is reference data; the script is a one-off administrative run).
 * Never prints any secret.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

// ── env (manual load; never print values) ───────────────────────────────────
const envPath = new URL("../.env", import.meta.url);
if (!existsSync(envPath)) {
  console.error("LOAD FAIL: .env not found");
  process.exit(1);
}
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.supabase_secret_key;
if (!url || !serviceKey) {
  console.error("LOAD FAIL: missing NEXT_PUBLIC_SUPABASE_URL / supabase_secret_key");
  process.exit(1);
}
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

// Official sources, same repo — raw first, GitHub contents API as fallback
// (raw.githubusercontent.com is unreachable from some networks).
const DATASET_REPO = "makenomistakesllc/points-transfer-valuations";
const DATASET_PATH = "data/transfer-partner-valuations.json";
// The canonical public URL of the dataset (stamped as provenance on every row)
const DATASET_URL = `https://raw.githubusercontent.com/${DATASET_REPO}/main/${DATASET_PATH}`;

async function fetchDatasetOfficial() {
  // 1) raw file
  try {
    const res = await fetch(DATASET_URL, { headers: { "Accept-Encoding": "gzip" }, signal: AbortSignal.timeout(20_000) });
    if (res.ok) return await res.json();
  } catch { /* fall through */ }
  // 2) GitHub contents API (base64) — still the same official repo & file
  const res = await fetch(`https://api.github.com/repos/${DATASET_REPO}/contents/${DATASET_PATH}`, {
    headers: { "User-Agent": "a-una-milla", "Accept": "application/vnd.github+json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from github.com contents API`);
  const body = await res.json();
  const buf = Buffer.from(body.content ?? "", "base64");
  if (buf.length === 0) throw new Error("contents API returned no file bytes");
  return JSON.parse(buf.toString("utf8"));
}

// ── fetch + validate the dataset (refuse without verified_at) ───────────────
let dataset;
try {
  dataset = await fetchDatasetOfficial();
} catch (err) {
  console.error(`LOAD FAIL: could not fetch the official dataset (${err instanceof Error ? err.message : err})`);
  process.exit(1);
}
if (!dataset?.programs || typeof dataset.programs !== "object") {
  console.error("LOAD FAIL: dataset has no programs map — refusing");
  process.exit(1);
}

const rows = [];
for (const [fromCode, program] of Object.entries(dataset.programs)) {
  const verifiedAt = program?.verifiedAt ?? null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(verifiedAt ?? ""))) {
    console.error(`LOAD FAIL: program '${fromCode}' lacks a verifiedAt YYYY-MM-DD — refusing to run (§5.5)`);
    process.exit(1);
  }
  const partners = program?.partners ?? {};
  const partnerNames = Object.keys(partners);
  if (partnerNames.length === 0) {
    console.error(`LOAD FAIL: program '${fromCode}' has no partners — refusing to run (§5.5)`);
    process.exit(1);
  }
  for (const [toCode, p] of Object.entries(partners)) {
    const cppLow = Number(p?.cppLow);
    const cppHigh = Number(p?.cppHigh);
    // refusal path: no row may lack its provenance or be numerically unusable
    if (!Number.isFinite(cppLow) || !Number.isFinite(cppHigh) || cppLow <= 0 || cppHigh < cppLow) {
      console.error(`LOAD FAIL: pair ${fromCode}→${toCode} has unusable cppLow/cppHigh (${p?.cppLow}/${p?.cppHigh}) — refusing to run (no defaults ever)`);
      process.exit(1);
    }
    rows.push({
      from_code: fromCode,
      to_code: toCode,
      cpp_low: cppLow,
      cpp_high: cppHigh,
      currency: "USD",
      // the dataset ships program-level provenance; the loader stamps the same
      // official source on every row (verified_at from the program entry)
      source_url: DATASET_URL,
      verified_at: verifiedAt,
    });
  }
}
console.log(`dataset OK: ${rows.length} pairs across ${Object.keys(dataset.programs).length} programs (lastUpdated ${dataset.lastUpdated})`);

// ── diff against what is stored, then upsert ────────────────────────────────
const { data: before, error: readErr } = await supabase.from("pair_valuations").select("from_code,to_code,cpp_low,cpp_high,currency");
if (readErr) {
  console.error("LOAD FAIL: cannot read pair_valuations:", readErr.message);
  process.exit(1);
}
const existing = new Map((before ?? []).map((r) => [`${r.from_code}|${r.to_code}`, r]));
const changes = [];
let added = 0;
for (const row of rows) {
  const key = `${row.from_code}|${row.to_code}`;
  const old = existing.get(key);
  if (!old) {
    added++;
    continue;
  }
  if (Number(old.cpp_low) !== row.cpp_low || Number(old.cpp_high) !== row.cpp_high || old.currency !== row.currency) {
    changes.push({
      pair: key,
      old: { cpp_low: Number(old.cpp_low), cpp_high: Number(old.cpp_high), currency: old.currency },
      new: { cpp_low: row.cpp_low, cpp_high: row.cpp_high, currency: row.currency },
    });
  }
}

const { error: upsertErr } = await supabase
  .from("pair_valuations")
  .upsert(rows, { onConflict: "from_code,to_code" });
if (upsertErr) {
  console.error("LOAD FAIL: upsert error:", upsertErr.message);
  process.exit(1);
}

// ── one diff summary to audit_log (pairs changed, old → new) ────────────────
const { error: auditErr } = await supabase.from("audit_log").insert({
  actor: null,
  action: "pair_valuations_load",
  entity: "pair_valuations",
  details: {
    dataset_url: DATASET_URL,
    dataset_last_updated: dataset.lastUpdated ?? null,
    source: "WanderWise Guide — points-transfer-valuations (CC-BY-4.0)",
    unit_note: "cpp_low/cpp_high stored in the dataset's published unit: US CENTS per partner point, currency USD (convert ÷100 → USD/point before any per-point comparison).",
    pairs_total: rows.length,
    pairs_new: added,
    pairs_changed: changes.length,
    changes: changes.slice(0, 200),
  },
});
if (auditErr) {
  console.error("LOAD FAIL: audit_log write error:", auditErr.message);
  process.exit(1);
}

console.log(`LOAD OK: ${rows.length} pairs upserted (new: ${added}, changed: ${changes.length}) — diff summary written to audit_log.`);
