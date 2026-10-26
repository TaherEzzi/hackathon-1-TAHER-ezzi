/**
 * Gate-8 smoke (BRIEF §7.8): GET /api/admin is gated by the app_metadata claim
 * `aum_admin`. Creates a demo admin and a plain demo user (both clearly test
 * users, deleted afterwards), gets their JWTs, and calls the route with both.
 * Expects: admin → 200 aggregates; plain user → 403 not_admin.
 * Runs only when ADMIN_SMOKE=1 — it mutates auth users in a demo-forgiving way.
 */
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3457";
const { readFileSync, existsSync } = await import("node:fs");
if (!existsSync(new URL("../.env", import.meta.url))) { console.error("no .env"); process.exit(1); }
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
}
const { createClient } = await import("@supabase/supabase-js");
const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.supabase_secret_key, { auth: { persistSession: false } });

const stamp = Date.now();
const mk = async (email, isAdmin) => {
  const { data: created, error } = await service.auth.admin.createUser({
    email, password: `AumDemo-${stamp}-x`, email_confirm: true,
    app_metadata: isAdmin ? { aum_admin: true } : {},
  });
  if (error) throw error;
  return created.user;
};

let a, p;
try {
  a = await mk(`aum-admin-${stamp}@example.com`, true);
  p = await mk(`aum-plain-${stamp}@example.com`, false);

  const login = async (email, password) => {
    const { data, error } = await service.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session.access_token;
  };
  const adminJwt = await login(`aum-admin-${stamp}@example.com`, `AumDemo-${stamp}-x`);
  const plainJwt = await login(`aum-plain-${stamp}@example.com`, `AumDemo-${stamp}-x`);

  const call = async (token) => {
    const r = await fetch(`${BASE}/api/admin`, { headers: { Authorization: `Bearer ${token}` } });
    const body = await r.json().catch(() => ({}));
    return { status: r.status, body };
  };

  const adminRes = await call(adminJwt);
  const plainRes = await call(plainJwt);
  console.log("admin  →", adminRes.status, JSON.stringify(adminRes.body.totals ?? adminRes.body.error));
  console.log("plain  →", plainRes.status, JSON.stringify(plainRes.body.error));

  if (adminRes.status !== 200 || !adminRes.body.totals) { console.error("FAIL: admin expected 200+totals"); process.exitCode = 1; }
  if (plainRes.status !== 403 || plainRes.body.error?.code !== "not_admin") { console.error("FAIL: plain expected 403 not_admin"); process.exitCode = 1; }
  console.log(process.exitCode === 1 ? "GATE 8 SMOKE: NOT PASSING" : "GATE 8 SMOKE PASS: is_app_admin gate holds (200 admin / 403 plain)");
} finally {
  const drops = [];
  if (a?.id) drops.push(service.auth.admin.deleteUser(a.id).catch((e) => console.error("cleanup a failed:", e.message)));
  if (p?.id) drops.push(service.auth.admin.deleteUser(p.id).catch((e) => console.error("cleanup p failed:", e.message)));
  await Promise.allSettled(drops);
}
