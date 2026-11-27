"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validasi, type JenisForm } from "@/lib/validasi/laporan";
import { terkunciUntukPetugas, type StatusLaporan } from "@/lib/laporan";
import { ambilAnomaliLaporan } from "@/lib/data/verifikasi";

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

/**
 * Kolom yang boleh ditulis ke tiap tabel rincian, di luar `laporan_id`.
 *
 * Daftar ini kembar dengan skema validasi — dan itu memang disengaja: skema
 * menjaga bentuk isian, daftar ini menjaga apa yang benar-benar masuk tabel.
 * Menambah kolom baru berarti menambahkannya di migrasi, skema, dan di sini.
 */
const KOLOM_DETAIL: Record<JenisForm, readonly string[]> = {
  aktivitas_anak: [
    "jumlah_kegiatan",
    "kegiatan",
    "nama_kegiatan",
    "jenis_kegiatan",
    "usia_0_5",
    "usia_6_12",
    "usia_13_17",
    "laki_laki",
    "perempuan",
    "disabilitas",
    "perlu_layanan_lanjutan",
    "temuan",
    "tindak_lanjut",
  ],
  aktivitas_perempuan: [
    "jumlah_kegiatan",
    "kegiatan",
    "nama_kegiatan",
    "jenis_kegiatan",
    "total_ikut",
    "kepala_keluarga",
    "hamil",
    "menyusui",
    "lansia",
    "disabilitas",
    "manfaat",
  ],
  rekap_pengaduan: [
    "status_bulan",
    "aduan_masuk",
    "kekerasan_perempuan",
    "kekerasan_anak",
    "non_kekerasan_perempuan",
    "non_kekerasan_anak",
    "sudah_ditindaklanjuti",
    "tercatat_simfoni",
    "tindak_lanjut_umum",
    "pihak_terlibat",
  ],
  tindak_lanjut_kasus: [
    "kode_kasus",
    "tanggal_aduan",
    "kategori",
    "jenis_kasus",
    "jumlah_korban",
    "jenis_kelamin",
    "kelompok_usia",
    "disabilitas",
    "kebutuhan_korban",
    "tindak_lanjut",
    "status_penanganan",
    "hambatan",
  ],
  publikasi: [
    "tanggal_publikasi",
    "kegiatan",
    "platform",
    "nama_akun",
    "link_publikasi",
    "file_publikasi",
  ],
};

export async function simpanLaporan(masukan: {
  jenis: JenisForm;
  posId: string;
  periodeId: string;
  data: unknown;
  status: "draf" | "terkirim" | "terverifikasi";
  laporanId?: string;
  /** Hanya dibaca untuk Admin Pusat; wajib bila datanya beranomali. */
  catatanVerifikasi?: string;
}): Promise<HasilSimpan> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { sukses: false, pesan: "Sesi berakhir. Silakan masuk kembali." };

  const { data: profil } = await supabase
    .from("pengguna")
    .select("wilayah_id, peran")
    .eq("id", user.id)
    .maybeSingle();

  // Admin Pusat mengisi laporan seluruh wilayah; ia tidak terikat wilayah dan
  // tidak mengenal draf maupun kunci. Petugas tetap terikat ke wilayah, bukan
  // ke satu Pos SAPA.
  const adminPusat = profil?.peran === "admin_pusat";
  // Kewenangan ditentukan dari profil di server. Kiriman klien hanya menentukan
  // apa yang ingin disimpan, bukan siapa yang boleh menyimpannya.
  //
  // Admin Pusat selalu terverifikasi, apa pun yang dikirim klien: formulirnya
  // hanya menawarkan satu tombol, dan server tidak perlu mempertanyakan lagi.
  // Bagi petugas, "terverifikasi" dari klien diperlakukan sebagai "terkirim" —
  // petugas tidak dapat memverifikasi laporannya sendiri (celah yang sudah
  // ditutup di migrasi 20261124000001); RLS tetap penegak sebenarnya, ini hanya
  // menjaga pesan galatnya tetap masuk akal.
  const statusDiminta: "draf" | "terkirim" | "terverifikasi" = adminPusat
    ? "terverifikasi"
    : masukan.status === "terverifikasi"
      ? "terkirim"
      : masukan.status;

  if (!adminPusat && profil?.peran !== "petugas") {
    return {
      sukses: false,
      pesan:
        "Pengisian laporan hanya untuk Petugas Pos SAPA dan Admin Pusat.",
    };
  }

  if (!adminPusat && !profil?.wilayah_id) {
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

  // Pastikan lokasi yang dipilih memang ada — dan, bagi petugas, berada di
  // wilayahnya. RLS juga menegakkan ini, tetapi pesan galatnya lebih jelas di
  // sini.
  const { data: pos } = await supabase
    .from("pos_sapa")
    .select("id, wilayah_id")
    .eq("id", masukan.posId)
    .maybeSingle();

  if (!pos) {
    return { sukses: false, pesan: "Lokasi Pos SAPA tidak ditemukan." };
  }
  if (!adminPusat && pos.wilayah_id !== profil?.wilayah_id) {
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
  //
  // Admin Pusat tidak diperiksa: baginya tidak ada kunci. Keputusan produknya
  // jelas — Admin Pusat boleh memperbaiki laporan mana pun, termasuk yang sudah
  // terverifikasi, dan jejaknya tetap tercatat di audit_log.
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
    !adminPusat &&
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
  const terkirim = statusDiminta !== "draf";

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
  //
  //    Hanya kolom milik tabel rincian yang dikirim. Skema validasi juga
  //    menerima beberapa kunci tambahan (mis. `jenis` atau `posId` yang dibawa
  //    kiriman klien), dan PostgREST menolak seluruh upsert bila ada satu kunci
  //    yang bukan kolom tabel. Penyaringan ini menjaga daftar kolom tetap
  //    menjadi urusan tabel, bukan urusan pemanggil.
  const detail = hasil.data as Record<string, unknown>;
  const isian = Object.fromEntries(
    KOLOM_DETAIL[masukan.jenis]
      .filter((k) => k in detail)
      .map((k) => [k, detail[k]])
  );

  const { error: errDetail } = await supabase
    .from(TABEL_DETAIL[masukan.jenis])
    .upsert({ laporan_id: indukId, ...isian }, { onConflict: "laporan_id" });

  if (errDetail) {
    return { sukses: false, pesan: `Gagal menyimpan detail: ${errDetail.message}` };
  }

  // 3. Status final + pelepasan penanda buka kunci, setelah rincian tersimpan.
  //
  //    Kiriman pertama : draf -> terkirim.
  //    Kiriman ulang   : tetap terkirim, penanda buka kunci dilepas supaya
  //                      laporan kembali masuk antrean verifikasi. Riwayat buka
  //                      kuncinya tetap tersimpan di audit_log.
  //    Admin Pusat     : langsung terverifikasi, dengan dirinya sebagai
  //                      verifikator. `submitted_at` dan `verified_at` diisi
  //                      trigger `set_submitted_at`.
  if (!terkirim) {
    revalidatePath("/laporan-saya");
    return { sukses: true, laporanId: indukId };
  }

  const catatanVerifikasi = masukan.catatanVerifikasi?.trim() || null;

  // Gerbang anomali untuk Admin Pusat. Alasannya sama dengan verifikasi biasa
  // (PRD §6.4): anomali boleh diterima, tetapi alasannya harus tercatat.
  // Keputusan ini diambil dari data di database, bukan dari kiriman klien.
  //
  // Diperiksa SETELAH rincian tersimpan: anomali baru terbaca dari detailnya,
  // dan bila ditolak di sini isian Admin tidak hilang — formulir dapat dibuka
  // lagi dan catatannya dilengkapi.
  //
  // Baris LAMA yang sudah terverifikasi sengaja diturunkan ke `draf`, bukan
  // dibiarkan terverifikasi: bila statusnya dibiarkan, data terverifikasi
  // kembali tersimpan tanpa alasan — persis yang dicoba dicegah. Menurunkannya
  // membuat keadaannya jujur ("belum terverifikasi"), dan setelah catatan diisi
  // ia naik lagi ke terverifikasi lewat jalur yang sama.
  if (adminPusat) {
    const anomali = await ambilAnomaliLaporan(indukId);
    if (anomali.length > 0 && !catatanVerifikasi) {
      const tinggi = anomali.filter((a) => a.tingkat === "tinggi").length;

      if (tersimpan?.status === "terverifikasi") {
        const { error: errTurun } = await supabase
          .from("laporan")
          .update({ status: "draf" })
          .eq("id", indukId);

        if (errTurun) {
          return {
            sukses: false,
            pesan:
              "Rincian tersimpan, tetapi status verifikasi lama gagal diturunkan: " +
              `${errTurun.message}. Isi catatan verifikasi lalu simpan lagi.`,
          };
        }
      }

      return {
        sukses: false,
        pesan:
          `Isian tersimpan, tetapi belum terverifikasi: laporan ini ` +
          `punya ${anomali.length} anomali` +
          (tinggi > 0 ? ` (${tinggi} tingkat tinggi)` : "") +
          ". Isi catatan verifikasi untuk menjelaskan mengapa datanya diterima, lalu simpan lagi.",
      };
    }
  }

  const finalKolom: Record<string, unknown> = adminPusat
    ? {
        status: "terverifikasi",
        verified_by: user.id,
        // Ditulis eksplisit: trigger `set_submitted_at` hanya mengisi kolom ini
        // bila masih kosong, sehingga verifikasi ULANG atas baris yang sudah
        // terverifikasi akan tetap memakai tanggal lama. Yang tercatat harus
        // waktu persetujuan yang sedang berlaku.
        verified_at: new Date().toISOString(),
        catatan_verifikasi: catatanVerifikasi,
        catatan_buka_kunci: null,
      }
    : { status: "terkirim" };

  if (tersimpan && !adminPusat) finalKolom.catatan_buka_kunci = null;

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

  revalidatePath("/laporan-saya");
  revalidatePath("/admin/input-laporan");
  revalidatePath("/monitoring");
  revalidatePath("/dashboard");
  revalidatePath("/verifikasi");

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
