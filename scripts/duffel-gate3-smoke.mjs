/**
 * Gate-3 smoke (BRIEF §7.3): through lib/server/duffel.ts —
 * offer request MAD→CDG → cheapest sane offer → RE-VERIFY its price.
 * Probe date is always today + 90d (future). Token never printed.
 */
import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
import { requestOffers, repriceOffer, cheapestSaneOffer, createTestOrder } from "../lib/server/duffel.ts";

// .env → process.env (this script runs outside Next)
const envPath = new URL("../.env", import.meta.url);
if (!existsSync(envPath)) {
  console.error("SMOKE FAIL: .env not found");
  process.exit(1);
}
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
}

// future probe date: today + 90 days, ISO
const probe = new Date(Date.now() + 90 * 24 * 3_600_000).toISOString().slice(0, 10);
console.log("probe date:", probe);

const res = await requestOffers({
  origin: "MAD",
  destination: "CDG",
  departure_date: probe,
  cabin: "economy",
  pax: 1,
});
console.log("offer_request:", res.offer_request_id, "| offers:", res.offers.length, "| test-mode:", !res.live_mode);
assert.ok(!res.live_mode, "must be test mode");
assert.ok(res.offers.length > 0, "no offers returned");

const chosen = cheapestSaneOffer(res.offers, "EUR") ?? cheapestSaneOffer(res.offers);
console.log("chosen:", chosen.owner_name, chosen.total);

// F8 discipline: re-verify BEFORE any order
const verify = await repriceOffer(chosen.id);
console.log("re-verified:", verify.total, "| moved:", (verify.total.amount - chosen.total.amount).toFixed(2));
assert.equal(verify.id, chosen.id);

// Test-mode order path exists and is typed (D31) — issue one only when explicitly enabled
if (process.env.DUFFEL_ORDER_DEMO === "1") {
  const order = await createTestOrder({
    offer: chosen,
    passengers: [{
      id: chosen.passenger_ids[0],
      title: "mr",
      given_name: "Demo",
      family_name: "Persona",
      born_on: "1988-05-20",
      gender: "m",
      email: "demo+persona@example.com",
      phone_number: "+34600000000",
    }],
    contact_email: "demo+persona@example.com",
    contact_phone: "+34600000000",
  });
  console.log("order:", order.status, order.booking_reference, order.airline, order.total);
  assert.ok(!order.live_mode, "order must be test mode");
}
console.log("GATE 3 SMOKE PASS: offers + re-verify OK");
