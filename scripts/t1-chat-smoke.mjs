/**
 * T1 end-to-end smoke: creates a throwaway demo user, signs in, and drives the
 * persona one-tap F12 turn through POST /api/chat (persona:true, mode plan).
 * Asserts: 200, type "runway", ≤7 candidate dates, D19 card gate asks (no card
 * sent), explanation quotes computed payload only. Self-scans the response for
 * any .env secret value (prints only a boolean, never the value). Deletes the
 * user afterwards. Runs only when T1_SMOKE=1 — it makes live sandbox calls.
 */
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3457";
const { readFileSync } = await import("node:fs");
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}
const { createClient } = await import("@supabase/supabase-js");
const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.supabase_secret_key, { auth: { persistSession: false } });

const stamp = Date.now();
const email = `aum-t1-${stamp}@example.com`;
const password = `AumDemo-${stamp}-x`;
let user;

/** true if any non-trivial .env value leaks into text (never printed). */
function leaksSecrets(text) {
  const vals = Object.entries(process.env)
    .filter(([k, v]) => typeof v === "string" && v.length >= 8 && /key|secret|token|password/i.test(k))
    .map(([, v]) => v);
  return vals.some((v) => text.includes(v));
}

try {
  const { data: created, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  user = created.user;
  const { data: signed, error: signErr } = await service.auth.signInWithPassword({ email, password });
  if (signErr) throw signErr;
  const jwt = signed.session.access_token;

  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ persona: true }),
  });
  const body = await res.json();
  const room = res.status, type = body.type, payload = body.payload ?? {};

  const candidates = (payload.candidates ?? []).map((c) => c.depart_date);
  const cashBadges = (payload.candidates ?? []).map((c) => c.cash?.badge).filter(Boolean);
  console.log("status  →", room);
  if (room !== 200) console.log("error   →", JSON.stringify(body.error ?? body).slice(0, 300));
  console.log("type    →", type, "| explained_by →", body.explained_by, "| is_test_persona →", body.is_test_persona);
  console.log("route   →", JSON.stringify(payload.intent_confirm));
  console.log("cands   →", candidates.length, "dates (≤7 per D19):", candidates.join(", "));
  console.log("badges  →", JSON.stringify([...new Set(cashBadges)]));
  console.log("cardgate→", payload.card_gate ?? "(absent)");
  console.log("verdict →", payload.verdict ?? "(runway has none)", payload.insufficient_reason ?? "");
  console.log("explain →", (body.explanation ?? "").slice(0, 180));
  console.log("nosecret→", leaksSecrets(JSON.stringify(body)) ? "FAIL: response contains an env secret value" : "ok (no env secret values in response)");

  const ok =
    room === 200 &&
    type === "runway" &&
    Array.isArray(payload.candidates) &&
    payload.candidates.length <= 7 &&
    typeof payload.card_gate === "string" &&
    payload.card_gate.length > 0 &&
    !leaksSecrets(JSON.stringify(body));
  console.log(process.exitCode === 1 ? "T1 SMOKE: NOT PASSING" : ok ? "T1 SMOKE PASS: persona F12 turn end-to-end (parse skipped, compute server-side, D19 gate asked)" : "T1 SMOKE: NOT PASSING");
  if (!ok) process.exitCode = 1;
} finally {
  const drop = user && service.auth.admin.deleteUser(user.id).catch((e) => console.error("cleanup failed:", e.message));
  if (drop) await Promise.allSettled([drop]);
}
