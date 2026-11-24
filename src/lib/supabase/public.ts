import { createClient } from "@supabase/supabase-js";

/**
 * Client tanpa cookie untuk halaman publik.
 * Hanya membaca view agregat yang memang diizinkan untuk anon,
 * sehingga halaman dapat di-cache dan tidak perlu sesi.
 */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
