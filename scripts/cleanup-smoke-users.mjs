/**
 * One-off safety net: delete any leftover aum-{admin,plain}-<stamp>@example.com
 * smoke users that a failed Gate-8 run may have left behind.
 */
const { readFileSync } = await import("node:fs");
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}
const { createClient } = await import("@supabase/supabase-js");
const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.supabase_secret_key, { auth: { persistSession: false } });

let page = 1;
const deleted = [];
for (;;) {
  const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
  if (error) { console.error(error.message); process.exit(1); }
  if (data.users.length === 0) break;
  for (const u of data.users) {
    const isSmoke = /^aum-(admin|plain)-\d+@example\.com$/.test(u.email ?? "");
    if (isSmoke) {
      const { error: e2 } = await service.auth.admin.deleteUser(u.id);
      if (e2) console.error("delete failed:", u.email, e2.message);
      else deleted.push(u.email);
    }
  }
  page++;
}
console.log(deleted.length ? `deleted ${deleted.length}: ${deleted.join(", ")}` : "no leftover smoke users");
