/**
 * Sessioned chat smoke: throwaway user → three chat turns in one session
 * (partial facts, a general question, the rest of the facts) → the saved trip
 * is readable at its plan URL → the thread and the trip survive a reload.
 * Live calls (Grok, Duffel test mode); deletes the user afterwards.
 * Usage: SMOKE_BASE=http://localhost:3000 node scripts/chat-session-smoke.mjs
 */
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const { readFileSync } = await import("node:fs");
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}
const { createClient } = await import("@supabase/supabase-js");
const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.supabase_secret_key, { auth: { persistSession: false } });

const stamp = Date.now();
const email = `aum-chat-${stamp}@example.com`;
const password = `AumDemo-${stamp}-x`;
let user;
const failures = [];
const check = (ok, label) => { console.log(ok ? "  ok  " : "  FAIL", label); if (!ok) failures.push(label); };

const travel = new Date(Date.now() + 120 * 24 * 3_600_000).toISOString().slice(0, 10);

try {
  const { data: created, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  user = created.user;
  const { data: signed, error: signErr } = await service.auth.signInWithPassword({ email, password });
  if (signErr) throw signErr;
  const headers = { Authorization: `Bearer ${signed.session.access_token}`, "Content-Type": "application/json" };
  const say = async (body) => {
    const res = await fetch(`${BASE}/api/chat`, { method: "POST", headers, body: JSON.stringify(body) });
    const json = await res.json();
    console.log(`\n> ${body.text}\n< [${res.status} ${json.type ?? json.error?.code}] ${String(json.reply ?? json.error?.message ?? "").slice(0, 240)}`);
    return { status: res.status, json };
  };

  const t1 = await say({ text: `I want to fly from Madrid to Johannesburg in business on ${travel}` });
  check(t1.status === 200 && t1.json.type === "ask", "turn 1 asks for the missing facts");
  check(t1.json.slots?.origin === "MAD" && t1.json.slots?.destination === "JNB", "turn 1 stored the route");
  const sessionId = t1.json.session_id;

  const t2 = await say({ session_id: sessionId, text: "Quick question first: what are Avios?" });
  check(t2.status === 200 && t2.json.type === "answer", "turn 2 answers a general question");
  check(t2.json.slots?.origin === "MAD" && t2.json.slots?.depart_date === travel, "turn 2 kept the earlier facts");

  const t3 = await say({ session_id: sessionId, text: "I hold Amex Gold and Revolut Metal with 20000 points, and I spend about 2500 euros a month. Go ahead and plan it." });
  check(t3.status === 200 && t3.json.type === "runway", "turn 3 ran the runway");
  check(typeof t3.json.plan_url === "string" && t3.json.plan_url.includes("view=plan&id="), "turn 3 returned a plan URL");
  check(!/[áéíóúñ¿¡]|\b(el|los|tus|para|pagando)\b/i.test(String(t3.json.reply ?? "")), "turn 3 explains in the traveller's language (English)");

  if (t3.json.itinerary_id) {
    const res = await fetch(`${BASE}/api/itineraries?id=${t3.json.itinerary_id}`, { headers });
    const json = await res.json();
    check(res.status === 200 && json.itinerary?.mode === "plan", "saved trip is readable by id");
    check(!!json.itinerary?.breakdown?.runway && !!json.itinerary?.breakdown?.inputs, "saved trip keeps the runway and inputs for the plan page");
    const list = await (await fetch(`${BASE}/api/itineraries`, { headers })).json();
    check((list.itineraries ?? []).some((t) => t.id === t3.json.itinerary_id), "saved trip is in My trips");
  }

  const thread = await (await fetch(`${BASE}/api/chat?session_id=${sessionId}`, { headers })).json();
  check((thread.messages ?? []).length === 6, "thread holds all six messages after reload");
  const sessions = await (await fetch(`${BASE}/api/chat`, { headers })).json();
  check((sessions.sessions ?? []).some((s) => s.id === sessionId), "session is listed in recent chats");

  const page = await fetch(`${BASE}${t3.json.plan_url ?? "/trip-dossier.html"}`);
  check(page.status === 200, "plan page URL serves the planner");

  console.log(failures.length ? `\nCHAT SMOKE: ${failures.length} FAILED` : "\nCHAT SMOKE PASS");
  if (failures.length) process.exitCode = 1;
} finally {
  if (user) await service.auth.admin.deleteUser(user.id).catch((e) => console.error("cleanup failed:", e.message));
}
