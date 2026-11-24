export type RentangPeriode = {
  id: string;
  label: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
};

export type TumpangTindih = {
  a: RentangPeriode;
  b: RentangPeriode;
};

/**
 * Cari pasangan periode yang rentang tanggalnya beririsan.
 *
 * PRD §6.4 mensyaratkan periode "tidak tumpang tindih" — aturan master data,
 * bukan ciri sebuah laporan. Karena itu pemeriksaannya ada di sini (dipakai
 * halaman /admin/periode), bukan di view anomali per laporan.
 *
 * Perbandingan memakai string ISO "YYYY-MM-DD" yang urutannya sama dengan
 * urutan kronologis, jadi tidak perlu mengubahnya menjadi Date.
 */
export function cariTumpangTindih(daftar: RentangPeriode[]): TumpangTindih[] {
  const hasil: TumpangTindih[] = [];

  for (let i = 0; i < daftar.length; i++) {
    for (let j = i + 1; j < daftar.length; j++) {
      const a = daftar[i];
      const b = daftar[j];
      if (a.tanggal_mulai <= b.tanggal_selesai && b.tanggal_mulai <= a.tanggal_selesai) {
        hasil.push({ a, b });
      }
    }
  }

  return hasil;
}

/** Himpunan id periode yang terlibat tumpang tindih. */
export function idTerlibat(tumpangTindih: TumpangTindih[]): Set<string> {
  const id = new Set<string>();
  for (const t of tumpangTindih) {
    id.add(t.a.id);
    id.add(t.b.id);
  }
  return id;
}
