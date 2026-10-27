export interface PublicSupabaseEnv {
  url: string;
  publishableKey: string;
}

export function publicSupabaseEnv(): PublicSupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url) throw new Error("server misconfiguration: NEXT_PUBLIC_SUPABASE_URL missing from environment");
  if (!publishableKey) {
    throw new Error("server misconfiguration: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY missing from environment");
  }
  return { url, publishableKey };
}
