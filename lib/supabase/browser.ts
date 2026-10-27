import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../database.types";
import { publicSupabaseEnv } from "./public-env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createBrowserSupabaseClient() {
  if (browserClient) return browserClient;
  const { url, publishableKey } = publicSupabaseEnv();
  browserClient = createBrowserClient<Database>(url, publishableKey);
  return browserClient;
}
