"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validasi, type JenisForm } from "@/lib/validasi/laporan";
import { terkunciUntukPetugas, type StatusLaporan } from "@/lib/laporan";

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

  // Laporan yang sudah terkirim terkunci untuk petugas: ia boleh membacanya,
  // tetapi tidak boleh mengubahnya sampai Admin memverifikasi atau membuka
  // kunci. Diperiksa di sini supaya petugas mendapat penjelasan yang jelas —
  // RLS dan trigger `laporan_cek_kunci_petugas` tetap menjadi penegak
  // sebenarnya, jadi pemeriksaan ini tidak dapat dilewati dari klien.
  const { data: tersimpan, error: errCek } = await supabase
    .from("laporan")
    .select("id, status, catatan_buka_kunci")
    .eq("pos_id", masukan.posId)
    .eq("periode_id", masukan.periodeId)
    .eq("jenis_laporan", masukan.jenis)
    .maybeSingle();

  if (errCek) {
    return {
      sukses: false,
      pesan: `Gagal memeriksa status laporan: ${errCek.message}`,
    };
  }

  if (
    tersimpan &&
    terkunciUntukPetugas(
      tersimpan.status as StatusLaporan,
      tersimpan.catatan_buka_kunci
    )
  ) {
    return {
      sukses: false,
      pesan:
        tersimpan.status === "terverifikasi"
          ? "Laporan ini sudah terverifikasi dan terkunci. Minta Admin membuka kuncinya bila perlu diperbaiki."
          : "Laporan ini sudah terkirim dan menunggu verifikasi, sehingga belum dapat diubah. Minta Admin membuka kuncinya bila perlu diperbaiki.",
    };
  }

  // Validasi otoritatif di server — jangan percaya validasi klien.
  const hasil = validasi(masukan.jenis, masukan.data);
  if (!hasil.sukses) return { sukses: false, galat: hasil.galat };

  const { data: sesi } = await supabase.auth.getSession();
  if (!sesi.session) {
    return { sukses: false, pesan: "Sesi berakhir. Silakan masuk kembali." };
  }

  // ---------------------------------------------------------------------------
  // URUTAN PENYIMPANAN TIGA LANGKAH — jangan disederhanakan.
  //
  // RLS menilai Hak TULIS rincian dari keadaan baris INDUK: `boleh_tulis_laporan`
  // mengizinkan petugas menulis rincian hanya bila induknya `draf`, atau
  // `terkirim` yang `catatan_buka_kunci`-nya terisi. Akibatnya laporan yang baru
  // saja menjadi `terkirim` tanpa penanda LANGSUNG terkunci — termasuk
  // rinciannya sendiri. Kalau status akhir ditetapkan pada langkah pertama,
  // upsert rincian di langkah berikutnya selalu ditolak RLS, dan tidak ada satu
  // pun laporan yang bisa terkirim.
  //
  // Jadi induk disimpan dalam keadaan yang masih boleh ditulis, rinciannya
  // disusul, dan status final ditetapkan paling akhir.
  // ---------------------------------------------------------------------------
  const terkirim = masukan.status === "terkirim";

  // 1. Induk. Baris yang SUDAH ADA sengaja tidak disentuh sama sekali:
  //    mengubah statusnya di sini akan menutup hak tulis rincian pada langkah 2.
  //    Baris baru disisipkan berstatus draf — satu-satunya status yang boleh
  //    disisipkan petugas.
  let indukId: string;

  if (tersimpan) {
    indukId = tersimpan.id;
  } else {
    const { data: indukBaru, error: errInduk } = await supabase
      .from("laporan")
      .insert({
        pos_id: masukan.posId,
        periode_id: masukan.periodeId,
        jenis_laporan: masukan.jenis,
        status: "draf",
        sumber_input: "form_internal",
        submitted_by: user.id,
      })
      .select("id")
      .single();

    if (errInduk || !indukBaru) {
      return {
        sukses: false,
        pesan: `Gagal menyimpan laporan: ${errInduk?.message ?? "tidak diketahui"}`,
      };
    }
    indukId = indukBaru.id;
  }

  // 2. Rincian — disimpan selagi hak tulisnya masih terbuka.
  const { error: errDetail } = await supabase
    .from(TABEL_DETAIL[masukan.jenis])
    .upsert(
      { laporan_id: indukId, ...(hasil.data as Record<string, unknown>) },
      { onConflict: "laporan_id" }
    );

  if (errDetail) {
    return { sukses: false, pesan: `Gagal menyimpan detail: ${errDetail.message}` };
  }

  // 3. Status final + pelepasan penanda buka kunci, setelah rincian tersimpan.
  //
  //    Kiriman pertama : draf -> terkirim.
  //    Kiriman ulang   : tetap terkirim, penanda buka kunci dilepas supaya
  //                      laporan kembali masuk antrean verifikasi. Riwayat buka
  //                      kuncinya tetap tersimpan di audit_log.
  if (terkirim) {
    const finalKolom: Record<string, unknown> = { status: "terkirim" };
    if (tersimpan) finalKolom.catatan_buka_kunci = null;

    const { error: errFinal } = await supabase
      .from("laporan")
      .update(finalKolom)
      .eq("id", indukId);

    if (errFinal) {
      // Isi laporan sudah tersimpan dan rinciannya lengkap; yang gagal hanya
      // penetapan status akhir. Dikatakan apa adanya supaya tidak dikira
      // seluruh kiriman hilang — petugas cukup mengirim ulang sekali lagi.
      return {
        sukses: false,
        pesan:
          "Rincian laporan tersimpan, tetapi status akhir gagal ditetapkan: " +
          `${errFinal.message}. Coba kirim ulang sekali lagi.`,
      };
    }
  }

  revalidatePath("/laporan-saya");
  revalidatePath("/monitoring");
  revalidatePath("/dashboard");

  return { sukses: true, laporanId: indukId };
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
