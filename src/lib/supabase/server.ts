import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieUntukDiset = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

/**
 * Client untuk Server Components, Route Handlers, dan Server Actions.
 * Sesi dibaca dari cookie; query tunduk pada RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieUntukDiset[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component tidak dapat menulis cookie.
            // Diabaikan; middleware yang menyegarkan sesi.
          }
        },
      },
    }
  );
}
