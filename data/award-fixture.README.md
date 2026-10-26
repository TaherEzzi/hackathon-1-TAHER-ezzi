# award-fixture.json — how to fill it before demo day (D30 ritual)

`routes` is **empty on purpose**: no verified MAD→JNB Business award numbers
exist in this repo or session (seats.aero and iberia.com are not reachable from
the build machine; nothing in the docs states a route-specific award price).
§5.4 rule: **0 is not a real value — a route whose miles/taxes are not verified
must be absent**, so the engine answers `insufficient_data` instead of computing
on zeros. That is the correct behaviour, not a bug.

## The two-minute ritual (D29/D30)

1. Run the MAD→JNB Business check on the **free seats.aero website tier**
   (no account; ≤60-day window) or the airline award calendars
   (Iberia Plus / BA Executive Club / Qatar Privilege Club).
2. Note for ONE seat, one-way: airline program (IB/BA/QR), **miles**, **taxes
   in EUR**, and seat state if visible.
3. Append the row — exactly this shape:

```json
{
  "origin": "MAD",
  "destination": "JNB",
  "airline_program": "IB",
  "cabin": "business",
  "miles_one_way": 77000,
  "taxes": { "amount": 187.35, "currency": "EUR" },
  "seats": "unknown"
}
```

4. Update the top-level `verified_at` to the ritual date.
5. Never type a value you did not see on the source. Missing taxes ⇒ no row.

## Validated by `lib/server/fixture.ts`

- `label` must be exactly `"estimación"` (fixture is always `estimación`, §3.2).
- `verified_at` an ISO date (`YYYY-MM-DD`); `source` a non-empty string.
- Route codes 3 uppercase letters; `cabin` one of economy/premium/business/first;
  `airline_program` a program code (IB, BA, QR — see `programs` seed).
- `miles_one_way` an integer ≥ 1; `taxes.amount` a finite number ≥ 0 with
  `taxes.currency` ISO 3-letter. `seats` one of unknown/1/2/4.
- Anything malformed throws `InsufficientData('fixture: …')` — the app surfaces
  `insufficient_data`, never a silent fallback, never a number from nowhere.
- One entry per (origin, destination, airline_program, cabin); duplicates refused.
