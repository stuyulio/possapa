import type { JenisForm } from "@/lib/validasi/laporan";

/**
 * Bentuk draf lokal di perangkat petugas.
 *
 * Riwanya: dulu satu lokasi hanya punya SATU draf, dan `periodeId` di dalamnya
 * hanya dipakai untuk menolak draf periode lain. Akibatnya draf periode lama
 * tidak pernah terpakai, tetapi juga tidak pernah terhapus — lalu hilang
 * tertimpa begitu petugas mulai mengisi periode berikutnya tanpa peringatan.
 * Sekarang setiap periode punya embernya sendiri.
 *
 * Modul ini sengaja murni (tanpa localStorage) supaya aturan pemindahan bentuk
 * lama dan pembatasan jumlah ember dapat diuji tanpa browser.
 */

export type IsiDraf = Partial<Record<JenisForm, unknown>>;
export type EmberDraf = Record<string, IsiDraf>;

/** Bentuk yang pernah tersimpan di perangkat petugas. */
type DrafMentah = {
  periodeId?: string;
  data?: IsiDraf;
  perPeriode?: EmberDraf;
};

/** Berapa periode yang drafnya disimpan bersamaan di satu perangkat. */
export const MAKS_PERIODE_DRAF = 4;

/**
 * Bentuk lama `{ periodeId, data }` dipindahkan ke ember periode miliknya —
 * bukan ke periode yang sedang dibuka. Draf itu ditulis saat petugas mengisi
 * periode tersebut, jadi memindahkannya ke periode berjalan akan menampilkan
 * angka periode lama di formulir periode baru.
 */
export function normalisasiDraf(mentah: unknown): EmberDraf {
  if (!mentah || typeof mentah !== "object") return {};
  const d = mentah as DrafMentah;
  if (d.perPeriode && typeof d.perPeriode === "object") return d.perPeriode;
  if (typeof d.periodeId === "string" && d.periodeId && d.data) {
    return { [d.periodeId]: d.data };
  }
  return {};
}

/**
 * Simpan isian seluruh jenis pada satu periode.
 *
 * Ember periode lain dibiarkan utuh; yang berlebih dibuang menurut urutan
 * kunci, dan periode yang sedang diisi tidak pernah ikut terbuang.
 */
export function gabungDraf(
  simpanan: EmberDraf,
  periodeId: string,
  nilai: IsiDraf,
  maks = MAKS_PERIODE_DRAF
): EmberDraf {
  const hasil: EmberDraf = {
    ...simpanan,
    [periodeId]: { ...(simpanan[periodeId] ?? {}), ...nilai },
  };

  let berlebih = Object.keys(hasil).length - maks;
  for (const k of Object.keys(hasil)) {
    if (berlebih <= 0) break;
    if (k === periodeId) continue;
    delete hasil[k];
    berlebih--;
  }

  return hasil;
}

/**
 * Buang satu jenis setelah terkirim. Ember yang menjadi kosong ikut dibuang
 * agar tidak menyisakan penanda "ada draf" tanpa isi.
 */
export function buangJenisDraf(
  simpanan: EmberDraf,
  periodeId: string,
  jenis: JenisForm
): EmberDraf {
  const ember = simpanan[periodeId];
  if (!ember) return simpanan;

  const sisa = { ...ember };
  delete sisa[jenis];

  const hasil = { ...simpanan };
  if (Object.keys(sisa).length === 0) delete hasil[periodeId];
  else hasil[periodeId] = sisa;

  return hasil;
}
