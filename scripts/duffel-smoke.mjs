/**
 * Duffel test-mode smoke test.
 * Reads duffel_api_key from ../.env — the token is never printed.
 * Makes one offer request (MAD -> CDG, ~3 months out, one adult, economy)
 * and prints a sanitized summary of the first offers.
 */
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const token = env
  .split("\n")
  .find((l) => l.startsWith("duffel_api_key="))
  ?.slice("duffel_api_key=".length)
  .trim();

if (!token?.startsWith("duffel_test_")) {
  console.error("SMOKE FAIL: no duffel_api_key starting with duffel_test_ in .env");
  process.exit(1);
}

const body = {
  data: {
    cabin_class: "economy",
    passengers: [{ type: "adult" }],
    slices: [{ origin: "MAD", destination: "CDG", departure_date: "2027-01-26" }],
    return_offers: true,
  },
};

const res = await fetch("https://api.duffel.com/air/offer_requests?return_offers=true", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Duffel-Version": "v2",
    "Content-Type": "application/json",
    "Accept-Encoding": "gzip",
  },
  body: JSON.stringify(body),
});

const payload = await res.json();

if (!res.ok) {
  console.error("SMOKE FAIL: HTTP", res.status, JSON.stringify(payload.errors ?? payload, null, 2).slice(0, 800));
  process.exit(1);
}

const offers = payload.data?.offers ?? [];
console.log("SMOKE PASS: offer request", payload.data?.id, "| live:", payload.data?.live_mode);
console.log("offers returned:", offers.length);
for (const o of offers.slice(0, 3)) {
  console.log(
    `- ${o.owner?.name ?? o.owner?.airline_name ?? "?"} | total ${o.total_amount} ${o.total_currency}` +
      ` | expires ${o.expires_at ?? "?"}`
  );
}
