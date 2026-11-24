import { createClient } from "@supabase/supabase-js";

/**
 * Client dengan hak administratif (service_role).
 *
 * PERINGATAN KEAMANAN:
 * - Hanya boleh diimpor dari kode server (Server Action / Route Handler).
 * - JANGAN pernah diimpor dari komponen "use client" — kunci akan bocor ke browser.
 * - Service role MELEWATI Row Level Security. Setiap pemanggilan wajib
 *   memverifikasi peran pengguna terlebih dahulu.
 *
 * Variabel yang dibutuhkan: SUPABASE_SERVICE_ROLE_KEY (tanpa awalan NEXT_PUBLIC_).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !kunci) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY belum diisi. Tambahkan ke .env.local " +
        "(Project Settings → API → service_role)."
    );
  }

  return createClient(url, kunci, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function serviceRoleTersedia() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
