-- seed_reference_data — A Una Milla v1
-- Only facts printed in docs/SUMMARY.md / docs/decision.md / components-and-math.md.
-- Nothing invented: every rate carries its source + verified_at. `ratio`/`step`
-- are 1.0/NULL-will-confirm until the build slice verifies them on official pages
-- (components-and-math.md §1.4: a null step renders as "must confirm", never guessed).
-- pair_valuations stays EMPTY: the 98-pair dataset loads from its official URL in
-- the build slice; the schema is ready (D19). Never hand-invent values into it.

insert into public.programs (code, name, kind, currency_name) values
  ('BA',      'British Airways Executive Club',     'airline', 'Avios'),
  ('IB',      'Iberia Plus',                        'airline', 'Avios'),
  ('VY',      'Vueling',                            'airline', 'Avios'),
  ('EI',      'Aer Lingus AerClub',                 'airline', 'Avios'),
  ('AY',      'Finnair Plus',                       'airline', 'Avios'),
  ('QR',      'Qatar Airways Privilege Club',       'airline', 'Avios'),
  ('REVOLUT', 'Revolut (RevPoints)',                'bank',    'RevPoints'),
  ('AMEX_ES', 'Amex Business Platinum (ES)',        'bank',    'Membership Rewards')
on conflict (code) do update
  set name = excluded.name, kind = excluded.kind, currency_name = excluded.currency_name;

-- Avios-move graph exactly as the guide states it. BA is the bridge (D3).
-- Combine My Avios paths are 1:1 by design (verified_at null → "confírmalo en la web");
-- Qatar goes through its own exchange link (separate link-accounts step, F6).
insert into public.transfer_partners (from_program_id, to_program_id, ratio, step, bonus_pct, verified_at)
select f.id, t.id, 1.0, null, null, null
from (values
  ('BA', 'IB'), ('BA', 'VY'), ('BA', 'EI'), ('BA', 'AY'), ('BA', 'QR'),
  ('IB', 'BA'), ('VY', 'BA'), ('EI', 'BA'), ('AY', 'BA')
) as edges (from_code, to_code)
join public.programs f on f.code = edges.from_code
join public.programs t on t.code = edges.to_code
on conflict (from_program_id, to_program_id) do update
  set ratio = excluded.ratio, step = excluded.step, bonus_pct = excluded.bonus_pct, verified_at = excluded.verified_at;

-- Bank → Avios edges are NOT seeded: RevPoints/MR → Avios ratios must be read
-- off the official partner pages first (D12). The adapter layer will seed this
-- table from those pages with their URLs as source, before any UI step offers it.

-- Revolut table (D20 / F4): figures from the guide's September 2026 print,
-- confirmed against revolut.com/es-ES/our-pricing-plans on 2026-10-26.
insert into public.revolut_plans (plan, monthly_fee_eur, debit_points_per_eur, credit_points_per_eur, note, source_url, verified_at) values
  ('premium',  9.99, 0.25, null, 'debit only',
   'https://www.revolut.com/es-ES/our-pricing-plans', now()),
  ('metal',   15.99, 0.50, null, 'debit only',
   'https://www.revolut.com/es-ES/our-pricing-plans', now()),
  ('ultra',   55.00, 1.00, 1.50, 'oferta de lanzamiento',
   'https://www.revolut.com/es-ES/our-pricing-plans', now())
on conflict (plan) do update
  set monthly_fee_eur = excluded.monthly_fee_eur,
      debit_points_per_eur = excluded.debit_points_per_eur,
      credit_points_per_eur = excluded.credit_points_per_eur,
      note = excluded.note,
      source_url = excluded.source_url,
      verified_at = excluded.verified_at;

-- app_settings single row (admin-editable without deploy; decision.md admin list)
insert into public.app_settings
  (id, primary_provider, daily_request_cap, max_horizon_days,
   show_buy_points, show_hotel_accelerators, stripe_price_id,
   affiliate_disclosure, test_persona, attribution_required)
values
  (1,
   'fixture',            -- honest default until the seats.aero key decision closes (D13)
   null,                 -- daily_request_cap: null = enforcement deferred (D22)
   null,                 -- max_horizon_days: null until measured on real routes (P8/D16)
   true, true,
   null,                 -- no stripe price → no subscribe screen, no invented number (F11/D17)
   null,                 -- no affiliate → no disclosure line needed yet (D15 open)
   jsonb_build_object(
     'label', 'Perfil de prueba',
     'route', jsonb_build_object('origin', 'MAD', 'destination', 'JNB',
                                 'cabin', 'business', 'window_days', 90),
     'spend_monthly', 1800,
     'spend_labels', jsonb_build_array('alquiler', 'comida', 'gasolina'),
     'wallet', jsonb_build_object(
       'REVOLUT', jsonb_build_object('plan', 'metal'),
       'IB',      32000)
   ),
   'Valoración de puntos gracias a la base de datos pública «points-transfer-valuations» (WanderWise Guide), licencia CC-BY-4.0 · enlace al dataset en el pie de página'
)
on conflict (id) do update
  set primary_provider = excluded.primary_provider,
      daily_request_cap = excluded.daily_request_cap,
      max_horizon_days = excluded.max_horizon_days,
      show_buy_points = excluded.show_buy_points,
      show_hotel_accelerators = excluded.show_hotel_accelerators,
      stripe_price_id = excluded.stripe_price_id,
      affiliate_disclosure = excluded.affiliate_disclosure,
      test_persona = excluded.test_persona,
      attribution_required = excluded.attribution_required;
