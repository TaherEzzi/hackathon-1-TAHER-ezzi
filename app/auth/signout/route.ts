import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { typedError } from "@/lib/server/supabase";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("sign out failed", { error: error.message });
      return typedError(500, "signout_failed", error.message);
    }
    return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  } catch (error) {
    console.error("sign out route failed", { error });
    return typedError(500, "internal", error instanceof Error ? error.message : String(error));
  }
}
