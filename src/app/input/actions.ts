"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validasi, type JenisForm } from "@/lib/validasi/laporan";
import { terkunciUntukPetugas, type StatusLaporan } from "@/lib/laporan";
import { ambilAnomaliLaporan } from "@/lib/data/verifikasi";
import { idPublikasiDibuang, petakanIdPublikasi } from "@/lib/publikasi";

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
    "hambatan",
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
    "hambatan",
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

/**
 * Kolom tabel `laporan` yang boleh disentuh pemanggil saat menentukan baris
 * publikasi mana yang dipakai ulang.
 *
 * Tujuannya bukan keamanan — RLS sudah membatasi baris mana yang boleh
 * ditulis — melainkan agar `terkirim` dari klien tidak bisa dipakai untuk
 * melewati aturan status (petugas hanya boleh menulis baris `draf`/`terkirim`,
 * dan `terverifikasi` selalu terkunci).
 */
function idPublikasiDariKlien(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

export async function simpanLaporan(masukan: {
  jenis: JenisForm;
  posId: string;
  periodeId: string;
  data: unknown;
  status: "draf" | "terkirim" | "terverifikasi";
  laporanId?: string;
  /**
   * Khusus publikasi: id baris `laporan` lamanya, sejajar dengan urutan
   * `data.publikasi`. Baris yang dipertahankan dipakai ulang (agar status dan
   * jejak auditnya tidak hilang); baris yang tidak disebut lagi dihapus.
   */
  idPublikasi?: string[];
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
  // Publikasi boleh lebih dari satu baris, jadi pencariannya TIDAK boleh
  // `.maybeSingle()`: PostgREST akan menjawab "multiple rows" dan petugas tidak
  // dapat menyimpan sama sekali. Baris publikasi juga dipakai ulang per
  // publikasi (lihat `barisPublikasi`), bukan satu baris untuk seluruh jenis.
  const { data: barisAda, error: errCek } = await supabase
    .from("laporan")
    .select("id, status, catatan_buka_kunci")
    .eq("pos_id", masukan.posId)
    .eq("periode_id", masukan.periodeId)
    .eq("jenis_laporan", masukan.jenis)
    .order("submitted_at", { ascending: true, nullsFirst: true });

  if (errCek) {
    return {
      sukses: false,
      pesan: `Gagal memeriksa status laporan: ${errCek.message}`,
    };
  }

  // Satu baris tetap dipakai untuk empat jenis lain dan untuk jalur lama;
  // publikasi memakai seluruh daftar.
  const tersimpan = barisAda?.[0] ?? null;

  // Bagi publikasi, "terkunci" berarti SEMUA barisnya terkunci: satu baris
  // terkirim tidak boleh diubah hanya karena baris lain masih draf.
  const terkunci = !adminPusat
    ? masukan.jenis === "publikasi"
      ? (barisAda ?? []).some((b) =>
          terkunciUntukPetugas(
            b.status as StatusLaporan,
            b.catatan_buka_kunci
          )
        )
      : Boolean(
          tersimpan &&
            terkunciUntukPetugas(
              tersimpan.status as StatusLaporan,
              tersimpan.catatan_buka_kunci
            )
        )
    : false;

  if (terkunci) {
    const statusTerkunci = (barisAda ?? []).find((b) =>
      terkunciUntukPetugas(b.status as StatusLaporan, b.catatan_buka_kunci)
    )?.status;
    return {
      sukses: false,
      pesan:
        statusTerkunci === "terverifikasi"
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
  //
  //    PUBLIKASI BERBEDA: satu kiriman membawa BEBERAPA publikasi, dan tiap
  //    publikasi adalah satu baris `laporan` penuh (dashboard menghitung
  //    publikasi dari banyaknya baris). Karena itu jalurnya dipisah ke
  //    `simpanPublikasi`, bukan diselipkan ke alur satu-baris di bawah.
  if (masukan.jenis === "publikasi") {
    return simpanPublikasi({
      supabase,
      userId: user.id,
      masukan,
      terkirim,
      adminPusat,
      daftar: hasil.data as { publikasi: Record<string, unknown>[] },
      barisAda: barisAda ?? [],
    });
  }

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

/**
 * Simpan satu kiriman yang memuat beberapa publikasi.
 *
 * Setiap publikasi adalah satu baris `laporan` + satu baris `laporan_publikasi`.
 * Baris yang sudah ada dipakai ulang sesuai `idPublikasi` yang dikirim klien,
 * sehingga status dan jejak auditnya bertahan; baris yang tidak disebut lagi
 * dihapus — itu yang dilakukan tombol "Hapus" di formulir.
 *
 * URUTAN TETAP SAMA dengan jalur satu-baris, dan alasannya sama: RLS menilai
 * hak tulis rincian dari keadaan INDUK. Baris baru disisipkan sebagai `draf`
 * dan ditulis rinciannya lebih dulu; status akhir ditetapkan paling akhir.
 * Kalau status ditetapkan lebih awal, rinciannya sendiri langsung terkunci.
 */
async function simpanPublikasi({
  supabase,
  userId,
  masukan,
  terkirim,
  adminPusat,
  daftar,
  barisAda,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  masukan: {
    posId: string;
    periodeId: string;
    catatanVerifikasi?: string;
    idPublikasi?: string[];
  };
  terkirim: boolean;
  adminPusat: boolean;
  daftar: { publikasi: Record<string, unknown>[] };
  barisAda: { id: string; status: string; catatan_buka_kunci: string | null }[];
}): Promise<HasilSimpan> {
  // `idPakai[i]` selalu milik `publikasi[i]` — lihat alasannya di modul itu:
  // pemetaan yang bergeser menimpa publikasi yang salah tanpa galat.
  const idPakai = petakanIdPublikasi(
    masukan.idPublikasi,
    new Set(barisAda.map((b) => b.id)),
    daftar.publikasi.length
  );

  const indukIds: string[] = [];

  for (let i = 0; i < daftar.publikasi.length; i++) {
    const publikasi = daftar.publikasi[i];
    const isian = Object.fromEntries(
      KOLOM_DETAIL.publikasi
        .filter((k) => k in publikasi)
        .map((k) => [k, publikasi[k]])
    );

    let indukId: string | null = idPakai[i] ?? null;

    // Langkah 1 — induk. Baris lama tidak disentuh; baris baru disisipkan
    // sebagai draf agar rinciannya boleh ditulis.
    if (!indukId) {
      const { data: indukBaru, error: errInduk } = await supabase
        .from("laporan")
        .insert({
          pos_id: masukan.posId,
          periode_id: masukan.periodeId,
          jenis_laporan: "publikasi",
          status: "draf",
          sumber_input: "form_internal",
          submitted_by: userId,
        })
        .select("id")
        .single();

      if (errInduk || !indukBaru) {
        return {
          sukses: false,
          pesan:
            `Publikasi ke-${i + 1} gagal disimpan: ` +
            `${errInduk?.message ?? "tidak diketahui"}.` +
            (indukIds.length > 0
              ? ` ${indukIds.length} publikasi sebelumnya sudah tersimpan.`
              : ""),
        };
      }
      indukId = indukBaru.id;
    }

    // Langkah 2 — rincian, selagi hak tulisnya masih terbuka.
    const { error: errDetail } = await supabase
      .from("laporan_publikasi")
      .upsert({ laporan_id: indukId, ...isian }, { onConflict: "laporan_id" });

    if (errDetail) {
      return {
        sukses: false,
        pesan:
          `Rincian publikasi ke-${i + 1} gagal disimpan: ${errDetail.message}.` +
          (indukIds.length > 0
            ? ` ${indukIds.length} publikasi sebelumnya sudah tersimpan.`
            : ""),
      };
    }

    indukIds.push(indukId as string);
  }

  // Baris yang tidak dipakai lagi dihapus — inilah tombol "Hapus" di
  // formulir. Dihapus SEBELUM status final ditetapkan: setelah menjadi
  // `terkirim`, baris lama itu terkunci dan tidak dapat dibersihkan lagi.
  const idBuang = idPublikasiDibuang(
    barisAda.map((b) => b.id),
    indukIds
  );
  if (idBuang.length > 0) {
    // `.select("id")` WAJIB. RLS yang menolak DELETE tidak mengembalikan galat
    // — ia menyaring baris, sehingga DELETE mengenai nol baris dan tampak
    // berhasil. Tanpa membaca baris yang benar-benar terhapus, petugas diberi
    // tahu "tersimpan" padahal publikasi yang ia hapus masih ada.
    const { data: terhapus, error: errHapus } = await supabase
      .from("laporan")
      .delete()
      .in("id", idBuang)
      .select("id");

    if (errHapus) {
      return {
        sukses: false,
        pesan:
          `Publikasi tersimpan, tetapi ${idBuang.length} publikasi yang ` +
          `dihapus gagal dibersihkan: ${errHapus.message}`,
      };
    }

    const sisa = idBuang.length - (terhapus?.length ?? 0);
    if (sisa > 0) {
      return {
        sukses: false,
        pesan:
          `Publikasi tersimpan, tetapi ${sisa} publikasi gagal dihapus. ` +
          "Kemungkinan publikasi itu sudah terkirim atau terverifikasi — " +
          "hanya draf yang dapat dihapus petugas. Minta Admin menanganinya.",
      };
    }
  }

  // Langkah 3 — status final untuk SELURUH baris kiriman ini.
  // Satu status untuk satu kelompok publikasi: visi produknya "publikasi Pos
  // ini sudah terkirim", bukan status per tautan.
  if (terkirim) {
    const catatanVerifikasi = masukan.catatanVerifikasi?.trim() || null;

    // Gerbang anomali Admin Pusat. Sama dengan jalur satu-baris: anomali
    // dihitung dari data yang TERSIMPAN, bukan dari kiriman klien.
    if (adminPusat) {
      for (const id of indukIds) {
        const anomali = await ambilAnomaliLaporan(id);
        if (anomali.length > 0 && !catatanVerifikasi) {
          // Kembalikan baris yang sudah terverifikasi ke draf, seperti jalur
          // satu-baris — data terverifikasi tidak boleh tersimpan tanpa alasan.
          await supabase
            .from("laporan")
            .update({ status: "draf" })
            .in("id", indukIds)
            .eq("status", "terverifikasi");

          const tinggi = anomali.filter((a) => a.tingkat === "tinggi").length;
          return {
            sukses: false,
            pesan:
              "Isian tersimpan, tetapi belum terverifikasi: salah satu " +
              `publikasi punya ${anomali.length} anomali` +
              (tinggi > 0 ? ` (${tinggi} tingkat tinggi)` : "") +
              ". Isi catatan verifikasi untuk menjelaskan mengapa datanya diterima, lalu simpan lagi.",
          };
        }
      }
    }

    const finalKolom: Record<string, unknown> = adminPusat
      ? {
          status: "terverifikasi",
          verified_by: userId,
          verified_at: new Date().toISOString(),
          catatan_verifikasi: catatanVerifikasi,
          catatan_buka_kunci: null,
        }
      : { status: "terkirim", catatan_buka_kunci: null };

    const { error: errFinal } = await supabase
      .from("laporan")
      .update(finalKolom)
      .in("id", indukIds);

    if (errFinal) {
      return {
        sukses: false,
        pesan:
          "Publikasi tersimpan, tetapi status akhir gagal ditetapkan: " +
          `${errFinal.message}. Coba kirim ulang sekali lagi.`,
      };
    }
  }

  revalidatePath("/laporan-saya");
  revalidatePath("/admin/input-laporan");
  revalidatePath("/monitoring");
  revalidatePath("/dashboard");
  revalidatePath("/verifikasi");

  return { sukses: true, laporanId: indukIds[0] ?? "" };
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
