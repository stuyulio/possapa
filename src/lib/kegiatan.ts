/**
 * Rincian kegiatan per laporan.
 *
 * Sejak 27 Nov 2026, "Jumlah kegiatan" bukan lagi sekadar angka ringkasan:
 * angka itu menentukan berapa kartu kegiatan yang diisi petugas, dan tiap
 * kegiatan punya nama serta jenisnya sendiri. Rinciannya disimpan di kolom
 * `kegiatan` (jsonb) pada `laporan_anak` / `laporan_perempuan`.
 *
 * PENERIMA MANFAAT TETAP TOTAL PERIODE, bukan per kegiatan. Satu anak yang
 * ikut dua kegiatan hanya dihitung sekali — persis seperti Google Form aslinya,
 * yang memang hanya punya satu sel "Jumlah Usia Anak 0-5 Tahun" per laporan.
 * Karena itu kolom total (usia, jenis kelamin, kelompok sasaran) sengaja TIDAK
 * dipecah per kegiatan.
 *
 * Kolom lama `nama_kegiatan` dan `jenis_kegiatan` tetap diisi sebagai ringkasan
 * (lihat `ringkasNama` / `gabungJenis`). Dengan begitu dashboard, ekspor, view
 * `anomali_laporan`, dan impor Sheets yang sudah ada tidak perlu diubah, dan
 * laporan lama yang belum punya `kegiatan` tetap terbaca.
 */

/** Batas jumlah kegiatan per laporan, sama dengan skema validasi. */
export const MAKSIMAL_KEGIATAN = 50;

export type KegiatanAnak = {
  nama: string;
  jenis: string[];
};

export type KegiatanPerempuan = {
  nama: string;
  jenis: string;
};

/** Baris database boleh berbentuk apa saja; jangan percaya bentuknya. */
type Mentah = Record<string, unknown>;

const teks = (v: unknown): string => (typeof v === "string" ? v : "");

const daftarTeks = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : typeof v === "string" && v.trim() !== ""
      ? // Toleransi bentuk lama: satu string dipisah koma.
        v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

const angkaBulat = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/**
 * Berapa kartu kegiatan yang ditampilkan: mengikuti `jumlah_kegiatan`, kecuali
 * rincian yang tersimpan justru lebih panjang (data lama/kerusakan) — isian
 * yang ada jangan disembunyikan.
 */
function panjangTampil(jumlah: number, ada: number): number {
  return Math.max(1, jumlah, ada);
}

// -----------------------------------------------------------------------------
// Aktivitas anak
// -----------------------------------------------------------------------------

export function rapikanKegiatanAnak(d: Mentah): KegiatanAnak[] {
  const mentah = larikAman(d.kegiatan);
  const hasil: KegiatanAnak[] = mentah.map((k) => {
    const o = (k ?? {}) as Mentah;
    return { nama: teks(o.nama), jenis: daftarTeks(o.jenis) };
  });

  if (hasil.length === 0) {
    // Laporan lama (dan impor Google Form) hanya punya satu nama kegiatan
    // untuk sekian kali kegiatan. Nama itu menjadi kegiatan pertama; sisanya
    // kosong dan dapat dilengkapi bila Admin membuka kunci.
    hasil.push({
      nama: teks(d.nama_kegiatan),
      jenis: daftarTeks(d.jenis_kegiatan),
    });
  }

  const jumlah = panjangTampil(
    angkaBulat(d.jumlah_kegiatan),
    hasil.length
  );
  while (hasil.length < jumlah) hasil.push({ nama: "", jenis: [] });

  return hasil;
}

// -----------------------------------------------------------------------------
// Aktivitas perempuan
// -----------------------------------------------------------------------------

export function rapikanKegiatanPerempuan(d: Mentah): KegiatanPerempuan[] {
  const mentah = larikAman(d.kegiatan);
  const hasil: KegiatanPerempuan[] = mentah.map((k) => {
    const o = (k ?? {}) as Mentah;
    // `jenis` perempuan disimpan sebagai satu teks bebas, bukan daftar.
    const jenis = Array.isArray(o.jenis) ? daftarTeks(o.jenis).join(", ") : teks(o.jenis);
    return { nama: teks(o.nama), jenis };
  });

  if (hasil.length === 0) {
    hasil.push({
      nama: teks(d.nama_kegiatan),
      jenis: teks(d.jenis_kegiatan),
    });
  }

  const jumlah = panjangTampil(
    angkaBulat(d.jumlah_kegiatan),
    hasil.length
  );
  while (hasil.length < jumlah) hasil.push({ nama: "", jenis: "" });

  return hasil;
}

// -----------------------------------------------------------------------------
// Untuk layar baca (dashboard, pratinjau)
// -----------------------------------------------------------------------------

/**
 * Kegiatan yang layak ditampilkan untuk satu baris laporan.
 *
 * Berbeda dengan `rapikanKegiatan*` yang dipakai formulir, di sini tidak ada
 * baris kosong pengisi: layar baca hanya menampilkan kegiatan yang benar-benar
 * punya nama. Laporan lama tetap tampil sebagai satu kegiatan dari kolom
 * ringkasannya.
 */
export function kegiatanTampilAnak(
  kegiatan: unknown,
  namaLama: string | null | undefined,
  jenisLama: string[] | null | undefined
): KegiatanAnak[] {
  return rapikanKegiatanAnak({
    kegiatan,
    nama_kegiatan: namaLama ?? "",
    jenis_kegiatan: jenisLama ?? [],
    jumlah_kegiatan: 1,
  }).filter((k) => k.nama.trim() !== "");
}

export function kegiatanTampilPerempuan(
  kegiatan: unknown,
  namaLama: string | null | undefined,
  jenisLama: string | null | undefined
): KegiatanPerempuan[] {
  return rapikanKegiatanPerempuan({
    kegiatan,
    nama_kegiatan: namaLama ?? "",
    jenis_kegiatan: jenisLama ?? "",
    jumlah_kegiatan: 1,
  }).filter((k) => k.nama.trim() !== "");
}

// -----------------------------------------------------------------------------
// Ringkasan untuk kolom lama
// -----------------------------------------------------------------------------

/** Nama semua kegiatan, dipisah "; " — isi kolom `nama_kegiatan`. */
export function ringkasNama(
  kegiatan: { nama: string }[]
): string {
  return kegiatan
    .map((k) => k.nama.trim())
    .filter(Boolean)
    .join("; ");
}

/** Gabungan jenis kegiatan anak tanpa duplikat — isi kolom `jenis_kegiatan[]`. */
export function gabungJenisAnak(kegiatan: KegiatanAnak[]): string[] {
  return [...new Set(kegiatan.flatMap((k) => k.jenis))];
}

/**
 * Gabungan jenis kegiatan perempuan sebagai satu teks — isi kolom
 * `jenis_kegiatan`. Dipisah "; " supaya tidak tertukar dengan koma di dalam
 * nama jenis (mis. "pelatihan usaha, hidroponik").
 */
export function gabungJenisPerempuan(kegiatan: KegiatanPerempuan[]): string {
  const unik = [
    ...new Set(
      kegiatan
        .map((k) => k.jenis.trim())
        .filter(Boolean)
    ),
  ];
  return unik.join("; ");
}

// -----------------------------------------------------------------------------
// Penyiapan sebelum dikirim
// -----------------------------------------------------------------------------

/**
 * Potong/tambah daftar kegiatan tepat sebanyak `jumlah`.
 *
 * Dipotong dari BELAKANG. Saat mengisi, daftar di state sengaja dibiarkan lebih
 * panjang daripada yang tampil: bila petugas mengosongkan kolom jumlah untuk
 * mengetik angka baru, isian yang sudah diketik tidak ikut hilang. Pemotongan
 * dilakukan di sini, sekali, tepat sebelum validasi dan kirim.
 */
export function potongKegiatan<T>(kegiatan: T[], jumlah: number, kosong: () => T): T[] {
  const n = Math.max(1, Math.floor(jumlah) || 1);
  const hasil = kegiatan.slice(0, n);
  while (hasil.length < n) hasil.push(kosong());
  return hasil;
}

/**
 * Larik dari kolom jsonb, tanpa melempar bila bentuknya tak terduga.
 *
 * Baris hasil impor atau suntingan langsung di SQL Editor bisa berisi apa saja;
 * satu bentuk yang salah tidak boleh membuat seluruh halaman dashboard gagal
 * dirender.
 */
function larikAman(nilai: unknown): unknown[] {
  return Array.isArray(nilai) ? nilai : [];
}
