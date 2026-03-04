import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = process.env.NEXT_PUBLIC_BASE_URL || requestUrl.origin;
  const redirectTo = requestUrl.searchParams.get("redirect_to")?.toString();
  const destination = redirectTo ? `${origin}${redirectTo}` : `${origin}`;

  if (code) {
    const cookieStore = await cookies();
    const response = NextResponse.redirect(destination);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: true,
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Auth callback error:", error.message);
      const errorUrl = new URL("/sign-in", origin);
      errorUrl.searchParams.set("error", "auth_callback_failed");
      errorUrl.searchParams.set("error_description", error.message);
      return NextResponse.redirect(errorUrl.toString());
    }

    return response;
  }

  return NextResponse.redirect(destination);
}
