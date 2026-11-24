"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ambilAnomaliLaporan } from "@/lib/data/verifikasi";

export type HasilVerifikasi =
  | { sukses: true; pesan: string }
  | { sukses: false; pesan: string };

/** Kewenangan diperiksa di sini DAN ditegakkan RLS di database. */
async function pastikanAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, pesan: "Sesi berakhir. Silakan masuk kembali." };
  }

  const { data: profil } = await supabase
    .from("pengguna")
    .select("peran")
    .eq("id", user.id)
    .maybeSingle();

  if (profil?.peran !== "admin_kabkota" && profil?.peran !== "admin_pusat") {
    return {
      ok: false as const,
      pesan: "Hanya Admin Kab/Kota dan Admin Pusat yang dapat memverifikasi.",
    };
  }

  return { ok: true as const, supabase, userId: user.id };
}

const PESAN_GAGAL_UBAH =
  "Laporan tidak dapat diubah. Kemungkinan statusnya sudah berubah atau " +
  "lokasinya di luar wilayah Anda.";

function pesanGalat(kode: string | undefined, pesan: string): string {
  if (kode === "42501") {
    return "Lokasi laporan ini di luar wilayah Anda.";
  }
  if (kode === "23514") {
    return `Data tidak memenuhi aturan database: ${pesan}`;
  }
  return pesan;
}

function rapikan(catatan: string | undefined): string | null {
  const t = catatan?.trim();
  return t ? t : null;
}

/**
 * Terkirim -> Terverifikasi.
 *
 * `verified_by` wajib diisi: constraint `laporan_terverifikasi_punya_verifikator`
 * menolak status terverifikasi tanpa verifikator. `verified_at` diisi trigger
 * `set_submitted_at` di database.
 *
 * Catatan wajib bila laporan beranomali — ciri khas PRD §6.4: anomali boleh
 * diterima apa adanya, tetapi alasannya harus tercatat, bukan dihilangkan.
 * Kewajiban ini diputuskan dari data di database, bukan dari kiriman klien.
 */
export async function verifikasiLaporan(
  id: string,
  catatan?: string
): Promise<HasilVerifikasi> {
  if (!id) return { sukses: false, pesan: "ID laporan tidak valid." };

  const cek = await pastikanAdmin();
  if (!cek.ok) return { sukses: false, pesan: cek.pesan };

  const anomali = await ambilAnomaliLaporan(id);
  const isiCatatan = rapikan(catatan);

  if (anomali.length > 0 && !isiCatatan) {
    const tinggi = anomali.filter((a) => a.tingkat === "tinggi").length;
    return {
      sukses: false,
      pesan:
        `Laporan ini punya ${anomali.length} anomali` +
        (tinggi > 0 ? ` (${tinggi} tingkat tinggi)` : "") +
        ". Isi catatan verifikasi untuk menjelaskan mengapa datanya diterima.",
    };
  }

  const { data, error } = await cek.supabase
    .from("laporan")
    .update({
      status: "terverifikasi",
      verified_by: cek.userId,
      catatan_verifikasi: isiCatatan,
    })
    .eq("id", id)
    .eq("status", "terkirim")
    .select("id");

  if (error) {
    return { sukses: false, pesan: pesanGalat(error.code, error.message) };
  }
  // RLS menolak UPDATE dengan nol baris terpengaruh, bukan dengan galat.
  if (!data || data.length === 0) {
    return { sukses: false, pesan: PESAN_GAGAL_UBAH };
  }

  revalidatePath("/verifikasi");
  revalidatePath("/monitoring");
  revalidatePath("/laporan-saya");
  return {
    sukses: true,
    pesan: anomali.length > 0
      ? "Laporan diverifikasi dengan catatan anomali."
      : "Laporan diverifikasi.",
  };
}

/**
 * Terverifikasi -> Terkirim (buka kunci).
 *
 * `verified_by` dan `verified_at` sengaja TIDAK dihapus: keduanya mencatat
 * bahwa laporan ini pernah diverifikasi. Statusnya kini terkirim, dan itulah
 * yang dihitung seluruh halaman lain. Jejak auditnya lengkap.
 *
 * Catatan wajib: membuka kunci tanpa alasan membuat petugas tidak tahu apa
 * yang harus diperbaiki.
 */
export async function bukaKunciLaporan(
  id: string,
  catatan?: string
): Promise<HasilVerifikasi> {
  if (!id) return { sukses: false, pesan: "ID laporan tidak valid." };

  const cek = await pastikanAdmin();
  if (!cek.ok) return { sukses: false, pesan: cek.pesan };

  const isiCatatan = rapikan(catatan);
  if (!isiCatatan) {
    return {
      sukses: false,
      pesan: "Tuliskan alasan membuka kunci agar petugas tahu apa yang harus diperbaiki.",
    };
  }

  const { data, error } = await cek.supabase
    .from("laporan")
    .update({
      status: "terkirim",
      catatan_buka_kunci: isiCatatan,
    })
    .eq("id", id)
    .eq("status", "terverifikasi")
    .select("id");

  if (error) {
    return { sukses: false, pesan: pesanGalat(error.code, error.message) };
  }
  if (!data || data.length === 0) {
    return { sukses: false, pesan: PESAN_GAGAL_UBAH };
  }

  revalidatePath("/verifikasi");
  revalidatePath("/laporan-saya");
  return {
    sukses: true,
    pesan: "Kunci dibuka. Petugas dapat memperbaiki laporannya.",
  };
}
