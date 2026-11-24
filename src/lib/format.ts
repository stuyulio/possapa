const nf = new Intl.NumberFormat("id-ID");

export function angka(n: number | null | undefined): string {
  return nf.format(Number(n ?? 0));
}

export function persen(pembilang: number, penyebut: number): number {
  if (!penyebut) return 0;
  return Math.round((pembilang / penyebut) * 100);
}

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** "2026-11-01" -> "1 November 2026" */
export function tanggalPanjang(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${NAMA_BULAN[m - 1]} ${y}`;
}

/** "2026-11-01" -> "01-11-2026" */
export function tanggalPendek(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

export function labelPeriode(mulai: string, selesai: string): string {
  if (mulai === selesai) return tanggalPanjang(mulai);
  return `${tanggalPanjang(mulai)} – ${tanggalPanjang(selesai)}`;
}

const FORMAT_WAKTU = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

/**
 * Timestamp ISO -> "24 November 2026 pukul 09.15 WIB".
 * Mengembalikan null bila kosong/tidak valid, supaya pemanggil dapat
 * menyembunyikan barisnya alih-alih mencetak "Invalid Date".
 */
export function waktuPanjang(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return `${FORMAT_WAKTU.format(t)} WIB`;
}
