/**
 * Pilihan Jenis Tempat Pos SAPA — dipakai dropdown formulir dan label tampilan.
 *
 * Disebut "jenis tempat", bukan "jenis hunian": pilihannya mencakup kantor
 * Dinas/UPTD PPPA yang bukan tempat tinggal. Nama kolom database tetap
 * `jenis_hunian` agar tidak perlu migrasi.
 *
 * Daftar ini harus sejalan dengan constraint `pos_sapa_jenis_hunian_dikenal`
 * di migrasi `20261126000001_jenis_hunian_tambahan.sql`. Menambah jenis baru
 * berarti mengubah keduanya: nilai mentah disimpan di database, label hanya
 * untuk yang dibaca pengguna.
 *
 * KENAPA "LAINNYA" PUNYA ISIAN BEBAS
 *   Pos SAPA dapat berdiri di tempat yang belum terpikirkan saat daftar ini
 *   disusun. Tanpa isian bebas, petugas terpaksa memilih nilai yang salah
 *   atau menaruh keterangannya di kolom penanggung jawab — keduanya merusak
 *   data. Teks bebasnya disimpan terpisah di `jenis_hunian_lainnya`, bukan
 *   menimpa nilai `jenis_hunian`, supaya "Lainnya" tetap dapat dihitung.
 */

export const JENIS_HUNIAN = [
  { nilai: "huntap", label: "Huntap" },
  { nilai: "huntara", label: "Huntara" },
  { nilai: "dinas_pppa", label: "Dinas PPPA" },
  { nilai: "uptd_pppa", label: "UPTD PPPA" },
  { nilai: "lainnya", label: "Lainnya" },
] as const;

export type JenisHunian = (typeof JENIS_HUNIAN)[number]["nilai"];

export const NILAI_JENIS_HUNIAN: readonly string[] = JENIS_HUNIAN.map(
  (j) => j.nilai
);

/** Nilai yang membuka isian bebas. */
export const JENIS_HUNIAN_LAINNYA = "lainnya";

export function adalahJenisHunian(v: string): v is JenisHunian {
  return NILAI_JENIS_HUNIAN.includes(v);
}

/**
 * Label siap tampil. Untuk "Lainnya", teks bebasnya yang ditampilkan — label
 * "Lainnya" saja tidak memberi tahu apa pun kepada pembaca.
 */
export function labelJenisHunian(
  jenis: string | null | undefined,
  lainnya?: string | null
): string | null {
  if (!jenis) return null;
  if (jenis === JENIS_HUNIAN_LAINNYA) {
    return lainnya?.trim() || "Lainnya";
  }
  return JENIS_HUNIAN.find((j) => j.nilai === jenis)?.label ?? jenis;
}
