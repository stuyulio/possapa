"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validasi, type JenisForm } from "@/lib/validasi/laporan";

export type HasilSimpan =
  | { sukses: true; laporanId: string }
  | { sukses: false; galat: Record<string, string> }
  | { sukses: false; pesan: string };

const TABEL_DETAIL: Record<JenisForm, string> = {
  aktivitas_anak: "laporan_anak",
  aktivitas_perempuan: "laporan_perempuan",
  rekap_pengaduan: "laporan_rekap_pengaduan",
  tindak_lanjut_kasus: "laporan_kasus",
  publikasi: "laporan_publikasi",
};

export async function simpanLaporan(masukan: {
  jenis: JenisForm;
  posId: string;
  periodeId: string;
  data: unknown;
  status: "draf" | "terkirim";
  laporanId?: string;
}): Promise<HasilSimpan> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { sukses: false, pesan: "Sesi berakhir. Silakan masuk kembali." };

  // Petugas terikat ke wilayah, bukan ke satu Pos SAPA.
  const { data: profil } = await supabase
    .from("pengguna")
    .select("wilayah_id, peran")
    .eq("id", user.id)
    .maybeSingle();

  if (!profil?.wilayah_id) {
    return {
      sukses: false,
      pesan:
        "Akun Anda belum terhubung ke kabupaten/kota. Hubungi Admin Pusat untuk penugasan.",
    };
  }

  if (!masukan.posId) {
    return {
      sukses: false,
      pesan: "Pilih lokasi Pos SAPA terlebih dahulu.",
    };
  }

  // Pastikan lokasi yang dipilih memang berada di wilayah petugas.
  // RLS juga menegakkan ini, tetapi pesan galatnya lebih jelas di sini.
  const { data: pos } = await supabase
    .from("pos_sapa")
    .select("id, wilayah_id")
    .eq("id", masukan.posId)
    .maybeSingle();

  if (!pos) {
    return { sukses: false, pesan: "Lokasi Pos SAPA tidak ditemukan." };
  }
  if (pos.wilayah_id !== profil.wilayah_id) {
    return {
      sukses: false,
      pesan: "Lokasi Pos SAPA berada di luar wilayah penugasan Anda.",
    };
  }

  // Validasi otoritatif di server — jangan percaya validasi klien.
  const hasil = validasi(masukan.jenis, masukan.data);
  if (!hasil.sukses) return { sukses: false, galat: hasil.galat };

  const { data: sesi } = await supabase.auth.getSession();
  if (!sesi.session) {
    return { sukses: false, pesan: "Sesi berakhir. Silakan masuk kembali." };
  }

  // Upsert induk: satu laporan per (pos, periode, jenis).
  //
  // `catatan_buka_kunci` dikosongkan saat laporan dikirim: catatan itu menandai
  // "kunci sedang dibuka, ini alasannya". Setelah petugas mengirim ulang,
  // tanda itu tidak lagi berlaku. Riwayatnya tetap tersimpan di audit_log.
  const { data: induk, error: errInduk } = await supabase
    .from("laporan")
    .upsert(
      {
        pos_id: masukan.posId,
        periode_id: masukan.periodeId,
        jenis_laporan: masukan.jenis,
        status: masukan.status,
        sumber_input: "form_internal",
        submitted_by: user.id,
        ...(masukan.status === "terkirim" ? { catatan_buka_kunci: null } : {}),
      },
      { onConflict: "pos_id,periode_id,jenis_laporan" }
    )
    .select("id")
    .single();

  if (errInduk || !induk) {
    return {
      sukses: false,
      pesan: `Gagal menyimpan laporan: ${errInduk?.message ?? "tidak diketahui"}`,
    };
  }

  // Upsert detail.
  const { error: errDetail } = await supabase
    .from(TABEL_DETAIL[masukan.jenis])
    .upsert(
      { laporan_id: induk.id, ...(hasil.data as Record<string, unknown>) },
      { onConflict: "laporan_id" }
    );

  if (errDetail) {
    return { sukses: false, pesan: `Gagal menyimpan detail: ${errDetail.message}` };
  }

  revalidatePath("/laporan-saya");
  revalidatePath("/monitoring");
  revalidatePath("/dashboard");

  return { sukses: true, laporanId: induk.id };
}

export async function hapusDraf(laporanId: string): Promise<HasilSimpan> {
  const supabase = await createClient();

  const { data: laporan } = await supabase
    .from("laporan")
    .select("status")
    .eq("id", laporanId)
    .maybeSingle();

  if (!laporan) return { sukses: false, pesan: "Laporan tidak ditemukan." };
  if (laporan.status !== "draf")
    return { sukses: false, pesan: "Hanya draf yang dapat dihapus." };

  const { error } = await supabase.from("laporan").delete().eq("id", laporanId);
  if (error) return { sukses: false, pesan: error.message };

  revalidatePath("/laporan-saya");
  return { sukses: true, laporanId };
}
