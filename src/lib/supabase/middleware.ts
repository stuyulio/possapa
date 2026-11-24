import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieUntukDiset = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

/**
 * Menyegarkan sesi Supabase pada setiap request dan menjaga rute internal.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieUntukDiset[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Jangan sisipkan logika di antara createServerClient dan getUser.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAreaInternal =
    path.startsWith("/dashboard") ||
    path.startsWith("/monitoring") ||
    path.startsWith("/peta") ||
    path.startsWith("/verifikasi") ||
    path.startsWith("/input") ||
    path.startsWith("/laporan-saya") ||
    path.startsWith("/lokasi-saya") ||
    path.startsWith("/admin");

  if (!user && isAreaInternal) {
    const url = request.nextUrl.clone();
    url.pathname = "/masuk";
    url.searchParams.set("lanjut", path);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
