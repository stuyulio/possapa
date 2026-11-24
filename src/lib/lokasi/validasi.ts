import type { MasukanLokasi } from "./tipe";

/**
 * Validasi murni untuk isian lokasi Pos SAPA.
 * Dipakai bersama oleh aksi admin pusat dan aksi petugas.
 */
export type ValidasiLokasi = {
  galat: Record<string, string>;
  nilai: {
    nama_lokasi: string;
    kode_pos: string | null;
    jenis_hunian: "huntap" | "huntara" | null;
    lat: number | null;
    lng: number | null;
    penanggung_jawab: string | null;
    status_aktif: boolean;
  };
};

function angkaKoordinat(
  nilai: string | undefined,
  min: number,
  max: number,
  label: string
): { nilai: number | null; galat?: string } {
  if (!nilai || nilai.trim() === "") return { nilai: null };
  const n = Number(nilai);
  if (!Number.isFinite(n)) return { nilai: null, galat: `${label} harus berupa angka` };
  if (n < min || n > max)
    return { nilai: null, galat: `${label} di luar rentang wajar (${min}…${max})` };
  return { nilai: n };
}

export function validasiMasukanLokasi(m: MasukanLokasi): ValidasiLokasi {
  const galat: Record<string, string> = {};

  if (!m.namaLokasi?.trim()) galat.namaLokasi = "Nama lokasi wajib diisi";

  const lat = angkaKoordinat(m.lat, -11, 6, "Lintang");
  const lng = angkaKoordinat(m.lng, 95, 141, "Bujur");
  if (lat.galat) galat.lat = lat.galat;
  if (lng.galat) galat.lng = lng.galat;

  // Koordinat harus lengkap atau kosong sama sekali (constraint database).
  if ((lat.nilai === null) !== (lng.nilai === null)) {
    galat.lat = "Isi lintang dan bujur sekaligus, atau kosongkan keduanya";
  }

  return {
    galat,
    nilai: {
      nama_lokasi: m.namaLokasi?.trim() ?? "",
      kode_pos: m.kodePos?.trim() || null,
      jenis_hunian: m.jenisHunian || null,
      lat: lat.nilai,
      lng: lng.nilai,
      penanggung_jawab: m.penanggungJawab?.trim() || null,
      status_aktif: m.statusAktif,
    },
  };
}

/** Pesan kesalahan Postgres untuk nama lokasi ganda dalam satu wilayah. */
export function pesanGalatLokasi(kode: string | undefined, pesan: string) {
  if (kode === "23505") {
    return {
      pesan: "Lokasi dengan nama tersebut sudah ada di kabupaten/kota ini.",
      galat: { namaLokasi: "Nama lokasi sudah dipakai" },
    };
  }
  return { pesan, galat: undefined };
}
