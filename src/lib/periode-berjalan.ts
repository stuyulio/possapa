/**
 * Penanda periode berjalan.
 *
 * Periode pelaporan disimpan sebagai rentang tanggal (`YYYY-MM-DD`), bukan
 * timestamp. Karena itu "hari ini" harus dibaca sebagai tanggal WIB — server
 * produksi berjalan di UTC, dan antara pukul 00.00–07.00 WIB tanggalnya masih
 * tanggal kemarin menurut UTC. Memakai `new Date()` langsung akan menandai
 * periode dengan status yang berbeda selama tujuh jam setiap hari.
 *
 * Modul ini murni: `sekarang` selalu diteruskan pemanggil, jadi dapat diuji
 * tanpa memalsukan jam sistem.
 */

export type StatusPeriode = "belum" | "berjalan" | "lewat";

export type RentangPeriodeRingkas = {
  id: string;
  label: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
};

const ZONA = "Asia/Jakarta";

/**
 * Tanggal hari ini di WIB sebagai `YYYY-MM-DD`.
 *
 * `en-CA` dipakai karena format bawaannya ISO (`2026-11-28`), bukan karena
 * bahasanya — hasilnya tidak pernah ditampilkan ke pengguna.
 */
export function tanggalJakarta(sekarang: Date = new Date()): string {
  const bagian = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(sekarang);
  return bagian;
}

/**
 * Status satu periode terhadap tanggal hari ini.
 *
 * Perbandingan memakai string ISO karena urutan leksikografisnya sama dengan
 * urutan kronologis, sehingga tidak perlu mengubahnya menjadi Date.
 */
export function statusPeriode(
  periode: Pick<RentangPeriodeRingkas, "tanggal_mulai" | "tanggal_selesai">,
  hariIni: string
): StatusPeriode {
  if (hariIni < periode.tanggal_mulai) return "belum";
  if (hariIni > periode.tanggal_selesai) return "lewat";
  return "berjalan";
}

/**
 * Ringkasan keadaan periode untuk satu halaman.
 *
 * `berjalan` hanya terisi bila memang ada periode yang mencakup hari ini.
 * Jeda antarperiode itu wajar (periode mingguan bisa berakhir Kamis dan
 * berikutnya baru mulai Jumat), jadi ketiadaannya bukan keadaan salah.
 */
export function ringkasPeriodeBerjalan(
  daftar: RentangPeriodeRingkas[],
  hariIni: string
) {
  const berjalan = daftar.find((p) => statusPeriode(p, hariIni) === "berjalan");

  return {
    berjalan: berjalan ?? null,
    status: new Map(daftar.map((p) => [p.id, statusPeriode(p, hariIni)])),
  };
}

/**
 * Peringatan singkat saat periode yang dibuka BUKAN periode berjalan.
 *
 * Mengembalikan null bila tidak ada yang perlu dikatakan: periode yang sedang
 * dibuka memang periode berjalan, atau tidak ada periode berjalan sama sekali
 * (di antar-periode). Peringatan yang selalu muncul kehilangan maknanya.
 */
export function peringatanPeriode(
  terpilih: RentangPeriodeRingkas | null,
  berjalan: RentangPeriodeRingkas | null,
  hariIni: string
): { teks: string; jenis: "lewat" | "belum" } | null {
  if (!terpilih || !berjalan || terpilih.id === berjalan.id) return null;

  const status = statusPeriode(terpilih, hariIni);
  if (status === "lewat") {
    return {
      jenis: "lewat",
      teks: `Anda membuka periode yang sudah berakhir. Periode berjalan sekarang: ${berjalan.label}.`,
    };
  }

  return {
    jenis: "belum",
    teks: `Anda membuka periode yang belum dimulai. Periode berjalan sekarang: ${berjalan.label}.`,
  };
}
