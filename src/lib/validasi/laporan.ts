import { z } from "zod";

/**
 * Skema validasi dipakai di klien (umpan balik langsung) dan di server
 * (otoritatif). Aturannya mencerminkan constraint database di
 * supabase/migrations/20261118000001_init.sql.
 */

const angka = (maks = 100000) =>
  z.coerce
    .number({ invalid_type_error: "Harus berupa angka" })
    .int("Harus bilangan bulat")
    .min(0, "Tidak boleh negatif")
    .max(maks, "Nilai terlalu besar");

const teksWajib = (label: string) =>
  z.string().trim().min(1, `${label} wajib diisi`);

const teksOpsional = z.string().trim().optional().nullable();

export const JENIS_KEGIATAN_ANAK = [
  "Edukasi",
  "Trauma Healing",
  "Kegiatan Fisik",
  "Bermain Bersama",
  "Lainnya",
] as const;

export const PLATFORM = [
  "Instagram",
  "Facebook",
  "Tik Tok",
  "YouTube",
  "Website Resmi",
  "Lainnya",
] as const;

/**
 * Aturan Penerima Manfaat Aktivitas Anak — satu sumber untuk skema (server
 * menolak) dan formulir (tombol kirim dinonaktifkan).
 *
 * Dua aturan, keduanya tentang TOTAL, bukan tiap kolom:
 *  1. Minimal satu penerima manfaat. Kegiatan tanpa peserta membuat rasio
 *     penerima manfaat per kegiatan menyesatkan.
 *  2. Total per usia harus sama dengan total per jenis kelamin — keduanya
 *     menghitung orang yang sama. Sebelumnya selisih ini baru tampak sebagai
 *     anomali A1 setelah laporan terkirim; sekarang laporan ditolak lebih dulu.
 *
 * Angka 0 tetap sah untuk kelompok yang memang tidak ada (mis. tidak ada
 * peserta usia 13–17 tahun atau tidak ada penyandang disabilitas).
 */
export function galatPenerimaManfaat(d: {
  usia_0_5: number;
  usia_6_12: number;
  usia_13_17: number;
  laki_laki: number;
  perempuan: number;
}): string | null {
  const totalUsia = d.usia_0_5 + d.usia_6_12 + d.usia_13_17;
  const totalGender = d.laki_laki + d.perempuan;

  if (totalUsia === 0 && totalGender === 0) {
    return "Penerima manfaat wajib diisi — isi minimal satu angka pada kelompok usia atau jenis kelamin";
  }
  if (totalUsia === 0) {
    return `Penerima manfaat wajib diisi — total per jenis kelamin (${totalGender}) belum punya rincian usia`;
  }
  if (totalUsia !== totalGender) {
    return `Total per usia (${totalUsia}) harus sama dengan total per jenis kelamin (${totalGender})`;
  }
  return null;
}

export const skemaAnak = z
  .object({
    jumlah_kegiatan: angka(1000).min(1, "Minimal 1 kegiatan"),
    nama_kegiatan: teksWajib("Nama kegiatan"),
    jenis_kegiatan: z
      .array(z.string())
      .min(1, "Pilih minimal satu jenis kegiatan"),
    usia_0_5: angka(),
    usia_6_12: angka(),
    usia_13_17: angka(),
    laki_laki: angka(),
    perempuan: angka(),
    disabilitas: angka(),
    perlu_layanan_lanjutan: angka(),
    temuan: teksOpsional,
    tindak_lanjut: teksOpsional,
  })
  .superRefine((d, ctx) => {
    const pesan = galatPenerimaManfaat(d);
    if (pesan) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["penerima_manfaat"],
        message: pesan,
      });
    }
  });

export const skemaPerempuan = z
  .object({
    jumlah_kegiatan: angka(1000).min(1, "Minimal 1 kegiatan"),
    nama_kegiatan: teksWajib("Nama kegiatan"),
    jenis_kegiatan: teksOpsional,
    total_ikut: angka(),
    kepala_keluarga: angka(),
    // Hamil dan menyusui diisi terpisah. Seorang perempuan dapat hamil
    // sekaligus menyusui, jadi angkanya boleh tumpang tindih — yang diperiksa
    // masing-masing terhadap total, bukan jumlah keduanya.
    hamil: angka(),
    menyusui: angka(),
    lansia: angka(),
    disabilitas: angka(),
    manfaat: teksOpsional,
  })
  .refine((d) => d.total_ikut >= d.kepala_keluarga, {
    message: "Kepala keluarga tidak boleh melebihi total peserta",
    path: ["kepala_keluarga"],
  })
  .refine((d) => d.total_ikut >= d.hamil, {
    message: "Peserta hamil tidak boleh melebihi total",
    path: ["hamil"],
  })
  .refine((d) => d.total_ikut >= d.menyusui, {
    message: "Peserta menyusui tidak boleh melebihi total",
    path: ["menyusui"],
  })
  .refine((d) => d.total_ikut >= d.lansia, {
    message: "Peserta lansia tidak boleh melebihi total",
    path: ["lansia"],
  })
  .refine((d) => d.total_ikut >= d.disabilitas, {
    message: "Peserta disabilitas tidak boleh melebihi total",
    path: ["disabilitas"],
  });

export const skemaRekap = z
  .object({
    status_bulan: z.enum(["Ada aduan", "Nihil"]),
    aduan_masuk: angka(),
    kekerasan_perempuan: angka(),
    kekerasan_anak: angka(),
    non_kekerasan_perempuan: angka(),
    non_kekerasan_anak: angka(),
    sudah_ditindaklanjuti: angka(),
    tercatat_simfoni: angka(),
    tindak_lanjut_umum: teksOpsional,
    pihak_terlibat: teksOpsional,
  })
  .superRefine((d, ctx) => {
    const kategori =
      d.kekerasan_perempuan +
      d.kekerasan_anak +
      d.non_kekerasan_perempuan +
      d.non_kekerasan_anak;

    if (d.status_bulan === "Nihil") {
      if (
        d.aduan_masuk ||
        kategori ||
        d.sudah_ditindaklanjuti ||
        d.tercatat_simfoni
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["aduan_masuk"],
          message: "Status Nihil mengharuskan semua hitungan bernilai 0",
        });
      }
      return;
    }

    if (kategori !== d.aduan_masuk) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["aduan_masuk"],
        message: `Jumlah kategori (${kategori}) harus sama dengan aduan masuk (${d.aduan_masuk})`,
      });
    }
    if (d.sudah_ditindaklanjuti > d.aduan_masuk) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sudah_ditindaklanjuti"],
        message: "Tidak boleh melebihi jumlah aduan masuk",
      });
    }
    if (d.tercatat_simfoni > d.aduan_masuk) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tercatat_simfoni"],
        message: "Tidak boleh melebihi jumlah aduan masuk",
      });
    }
  });

export const skemaKasus = z
  .object({
    kode_kasus: teksWajib("Kode kasus"),
    tanggal_aduan: teksWajib("Tanggal aduan"),
    kategori: z.enum(["kekerasan", "non_kekerasan"]),
    jenis_kasus: teksWajib("Jenis kasus"),
    jumlah_korban: angka(10000).min(1, "Minimal 1 korban"),
    jenis_kelamin: teksWajib("Jenis kelamin korban"),
    kelompok_usia: teksWajib("Kelompok usia korban"),
    disabilitas: z.boolean(),
    kebutuhan_korban: teksOpsional,
    tindak_lanjut: teksOpsional,
    status_penanganan: z.enum(["dalam_proses", "dirujuk", "selesai"]),
    sudah_simfoni: z.boolean(),
    no_registrasi_simfoni: teksOpsional,
    tanggal_input_simfoni: teksOpsional,
    penginput_simfoni: teksOpsional,
    alasan_belum_simfoni: teksOpsional,
    hambatan: teksOpsional,
  })
  .superRefine((d, ctx) => {
    if (d.sudah_simfoni) {
      if (!d.no_registrasi_simfoni?.trim())
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["no_registrasi_simfoni"],
          message: "Wajib diisi bila sudah tercatat di SIMFONI",
        });
      if (!d.tanggal_input_simfoni?.trim())
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tanggal_input_simfoni"],
          message: "Wajib diisi bila sudah tercatat di SIMFONI",
        });
      if (!d.penginput_simfoni?.trim())
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["penginput_simfoni"],
          message: "Wajib diisi bila sudah tercatat di SIMFONI",
        });
    } else if (!d.alasan_belum_simfoni?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alasan_belum_simfoni"],
        message: "Alasan wajib diisi bila belum tercatat",
      });
    }
  });

export const skemaPublikasi = z.object({
  tanggal_publikasi: teksWajib("Tanggal publikasi"),
  kegiatan: teksWajib("Kegiatan yang dipublikasikan"),
  platform: z.enum(PLATFORM),
  nama_akun: teksWajib("Nama akun"),
  link_publikasi: z
    .string()
    .trim()
    .url("Harus berupa URL lengkap")
    .refine((v) => v.startsWith("https://"), {
      message: "URL harus diawali https://",
    }),
  file_publikasi: teksOpsional,
});

export const SKEMA = {
  aktivitas_anak: skemaAnak,
  aktivitas_perempuan: skemaPerempuan,
  rekap_pengaduan: skemaRekap,
  tindak_lanjut_kasus: skemaKasus,
  publikasi: skemaPublikasi,
} as const;

export type JenisForm = keyof typeof SKEMA;

export const LABEL_JENIS: Record<JenisForm, string> = {
  aktivitas_anak: "Aktivitas Anak (Bermain & Psikososial)",
  aktivitas_perempuan: "Aktivitas Perempuan (Pemberdayaan & Psikososial)",
  rekap_pengaduan: "Rekapitulasi Layanan Pengaduan Bulanan",
  tindak_lanjut_kasus: "Rincian Tindak Lanjut Kasus Pengaduan",
  publikasi: "Publikasi Media Sosial",
};

export type HasilValidasi =
  | { sukses: true; data: unknown }
  | { sukses: false; galat: Record<string, string> };

export function validasi(
  jenis: JenisForm,
  masukan: unknown
): HasilValidasi {
  const hasil = SKEMA[jenis].safeParse(masukan);
  if (hasil.success) return { sukses: true, data: hasil.data };

  const galat: Record<string, string> = {};
  for (const isu of hasil.error.issues) {
    const kunci = isu.path.join(".");
    if (!galat[kunci]) galat[kunci] = isu.message;
  }
  // Catatan: galat tingkat bagian memakai kunci yang BUKAN nama kolom, mis.
  // `penerima_manfaat` pada Aktivitas Anak. Formulir menampilkannya di kepala
  // bagian; jangan disalin ke salah satu kolom, karena itu menuduh kolom yang
  // belum tentu salah.
  return { sukses: false, galat };
}
