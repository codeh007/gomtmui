import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const co of cookiesToSet) {
            request.cookies.set(co.name, co.value);
          }
          supabaseResponse = NextResponse.next({
            request,
          });
          for (const co of cookiesToSet) {
            supabaseResponse.cookies.set(co.name, co.value, co.options);
          }
        },
      },
    },
  );

  // IMPORTANT: Keep this getClaims() call to refresh the session if needed.
  await supabase.auth.getClaims();

  return supabaseResponse;
}
