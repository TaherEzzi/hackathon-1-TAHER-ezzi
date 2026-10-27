import { NextResponse } from "next/server";
import { sanitizeAuthRedirect } from "@/lib/auth/sanitize-redirect.mjs";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeAuthRedirect(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=callback", origin));
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
    console.error("auth callback exchange failed", { error: error.message });
  } catch (error) {
    console.error("auth callback route failed", { error });
  }

  return NextResponse.redirect(new URL("/login?error=callback", origin));
}
