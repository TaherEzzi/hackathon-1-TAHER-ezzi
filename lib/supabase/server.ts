import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "../database.types";
import { publicSupabaseEnv } from "./public-env";

/** Cookie-backed Supabase client for App Router (Route Handlers, Server Components, Actions). */
export async function createServerSupabaseClient() {
  const { url, publishableKey } = publicSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          console.error("supabase cookie write skipped", { error });
        }
      },
    },
  });
}
