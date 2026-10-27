import { optionalUser, typedError } from "@/lib/server/supabase";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  try {
    const auth = await optionalUser(req);
    if (!auth) {
      return Response.json({ user: null });
    }
    return Response.json({
      user: {
        id: auth.user.id,
        email: auth.user.email,
        is_app_admin: auth.user.is_app_admin,
      },
    });
  } catch (error) {
    return typedError(500, "internal", error instanceof Error ? error.message : String(error));
  }
}
