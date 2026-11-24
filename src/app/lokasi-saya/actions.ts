"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validasiMasukanLokasi, pesanGalatLokasi } from "@/lib/lokasi/validasi";
import type { HasilLokasi, MasukanLokasi } from "@/lib/lokasi/tipe";

/**
 * Aksi lokasi Pos SAPA untuk Petugas Pos SAPA.
 * Wilayah SELALU diambil dari profil pengguna di server — parameter
 * `wilayahId` dari klien diabaikan agar petugas tidak dapat menulis ke
 * wilayah lain (RLS juga memaksa hal yang sama).
 */
async function pastikanPetugas() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, pesan: "Sesi berakhir. Silakan masuk kembali." };

  const { data: profil } = await supabase
    .from("pengguna")
    .select("peran, wilayah_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profil?.peran !== "petugas") {
    return {
      ok: false as const,
      pesan: "Menu ini khusus untuk Petugas Pos SAPA.",
    };
  }
  if (!profil.wilayah_id) {
    return {
      ok: false as const,
      pesan:
        "Akun Anda belum ditugaskan ke kabupaten/kota. Hubungi Admin Pusat.",
    };
  }

  return { ok: true as const, supabase, wilayahId: profil.wilayah_id as string };
}

export async function simpanLokasiSaya(m: MasukanLokasi): Promise<HasilLokasi> {
  const cek = await pastikanPetugas();
  if (!cek.ok) return { sukses: false, pesan: cek.pesan };
  const { supabase, wilayahId } = cek;

  const { galat, nilai } = validasiMasukanLokasi(m);
  if (Object.keys(galat).length > 0) {
    return { sukses: false, pesan: "Periksa kembali isian.", galat };
  }

  const isi = { ...nilai, wilayah_id: wilayahId };

  if (m.id) {
    // Pastikan lokasi yang diubah memang milik wilayah petugas.
    const { data: ada } = await supabase
      .from("pos_sapa")
      .select("id")
      .eq("id", m.id)
      .eq("wilayah_id", wilayahId)
      .maybeSingle();

    if (!ada) {
      return {
        sukses: false,
        pesan: "Lokasi tidak ditemukan di wilayah Anda.",
      };
    }
  }

  const { error } = m.id
    ? await supabase
        .from("pos_sapa")
        .update({ ...nilai, wilayah_id: wilayahId })
        .eq("id", m.id)
        .eq("wilayah_id", wilayahId)
    : await supabase.from("pos_sapa").insert(isi);

  if (error) {
    const g = pesanGalatLokasi(error.code, error.message);
    return { sukses: false, pesan: g.pesan, galat: g.galat };
  }

  revalidatePath("/lokasi-saya");
  revalidatePath("/input");
  revalidatePath("/laporan-saya");
  revalidatePath("/monitoring");
  return { sukses: true };
}

export async function hapusLokasiSaya(id: string): Promise<HasilLokasi> {
  const cek = await pastikanPetugas();
  if (!cek.ok) return { sukses: false, pesan: cek.pesan };
  const { supabase, wilayahId } = cek;

  const { data: lokasi } = await supabase
    .from("pos_sapa")
    .select("id, nama_lokasi")
    .eq("id", id)
    .eq("wilayah_id", wilayahId)
    .maybeSingle();

  if (!lokasi) {
    return { sukses: false, pesan: "Lokasi tidak ditemukan di wilayah Anda." };
  }

  const { count } = await supabase
    .from("laporan")
    .select("id", { count: "exact", head: true })
    .eq("pos_id", id);

  if (count && count > 0) {
    return {
      sukses: false,
      pesan: `Lokasi ini memiliki ${count} laporan dan tidak dapat dihapus. Nonaktifkan saja.`,
    };
  }

  const { error } = await supabase
    .from("pos_sapa")
    .delete()
    .eq("id", id)
    .eq("wilayah_id", wilayahId);

  if (error) return { sukses: false, pesan: error.message };

  revalidatePath("/lokasi-saya");
  revalidatePath("/input");
  revalidatePath("/laporan-saya");
  return { sukses: true };
}
