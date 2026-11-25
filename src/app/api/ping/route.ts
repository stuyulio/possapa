import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

/**
 * Ping harian untuk menjaga project Supabase (paket Free) agar tidak
 * di-pause setelah 7 hari tanpa aktivitas — lihat README "Operasional wajib".
 *
 * Dipanggil oleh cron Vercel (lihat vercel.json). Sengaja tidak memakai
 * halaman publik `/` sebagai sasaran: halaman itu dirender statis dengan
 * revalidate = 300, sehingga sebagian besar permintaan dilayani dari cache
 * dan tidak pernah menyentuh Supabase.
 *
 * Query di bawah sengaja menyentuh kandidat tabel yang paling terjamin ada
 * (`wilayah`, data referensi tetap berisi 18 kab/kota).
 */
export async function GET() {
  try {
    const supabase = createPublicClient();
    const { error } = await supabase.from("wilayah").select("id").limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, pesan: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, waktu: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        pesan: err instanceof Error ? err.message : "Galat tidak diketahui",
      },
      { status: 500 }
    );
  }
}
