/**
 * Titik tunggal konfigurasi landing page.
 *
 * `FOTO` sengaja dibiarkan kosong. Saat foto lapangan sudah tersedia, simpan
 * berkas ke `public/foto/` (nama dan rasio tercantum di `gambar.tsx`) lalu
 * isi nilainya di sini — tidak perlu menyentuh komponen mana pun.
 */

export const FOTO: Record<
  | "heroUtama"
  | "heroLatar"
  | "aktivitasAnak"
  | "aktivitasPerempuan"
  | "aktivitasPengaduan"
  | "aktivitasEdu"
  | "pintuWarga"
  | "pintuPetugas"
  | "pintuMitra"
  | "mandat"
  | "sebaran",
  string | undefined
> = {
  heroUtama: undefined,
  heroLatar: undefined,
  aktivitasAnak: undefined,
  aktivitasPerempuan: undefined,
  aktivitasPengaduan: undefined,
  aktivitasEdu: undefined,
  pintuWarga: undefined,
  pintuPetugas: undefined,
  pintuMitra: undefined,
  mandat: undefined,
  sebaran: undefined,
};

/** Navigasi header — sumber tunggal agar header dan tile tidak menyimpang. */
export const NAV = [
  { id: "mandat", label: "Mandat" },
  { id: "konsep", label: "Konsep" },
  { id: "aktivitas", label: "Aktivitas" },
  { id: "sebaran", label: "Sebaran" },
  { id: "capaian", label: "Capaian" },
  { id: "data", label: "Data" },
] as const;
