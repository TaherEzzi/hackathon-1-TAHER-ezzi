import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "../database.types";
import { sanitizeAuthRedirect } from "../auth/sanitize-redirect.mjs";
import { publicSupabaseEnv } from "./public-env";

/** Landing + planner pages stay public (F0: no account required to browse or
 *  to fill the form). Live calculation and booking remain auth-gated at the
 *  API routes themselves — /api/engine/* and /api/duffel/* call requireUser. */

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  let url: string;
  let publishableKey: string;
  try {
    ({ url, publishableKey } = publicSupabaseEnv());
  } catch (error) {
    console.error("supabase auth middleware misconfigured", { error });
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) {
    console.error("middleware session refresh failed", { message: authError.message });
  }

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/login") || pathname.startsWith("/auth/")) {
    if (user && pathname === "/login") {
      const next = sanitizeAuthRedirect(request.nextUrl.searchParams.get("next"));
      return NextResponse.redirect(new URL(next, request.url));
    }
    return supabaseResponse;
  }

  return supabaseResponse;
}
