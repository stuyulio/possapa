/**
 * Aturan kunci laporan petugas — dipakai bersama oleh UI dan server.
 *
 * Satu aturan, satu sumber. Sebelumnya status menentukan hak akses di tempat
 * yang berbeda-beda: `/laporan-saya` memakai daftar `("belum" | "draf" |
 * dibuka)`, `/input/actions.ts` menerima `draf` dan `terkirim` apa saja, dan
 * RLS punya `using` sendiri. Tiga tempat itu bisa berselisih tanpa ketahuan.
 */

export type StatusLaporan = "belum" | "draf" | "terkirim" | "terverifikasi";

/**
 * Laporan terkirim terkunci untuk petugas sampai Admin memverifikasi atau
 * membuka kuncinya.
 *
 * KENAPA TERKIRIM IKUT TERKUNCI
 *   Selama `terkirim` masih bisa diubah diam-diam, status itu tidak berarti
 *   apa-apa: laporan yang antre di /verifikasi dapat berubah isi di belakang
 *   layar Admin, dan yang diverifikasi bukan lagi yang dibaca. Perbaikan tetap
 *   mungkin, tetapi lewat jalur yang tercatat: Admin membuka kunci
 *   (`bukaKunciLaporan`) yang mengembalikan status ke `terkirim` sekaligus
 *   mengisi `catatan_buka_kunci`. Adanya catatan itulah yang membedakan
 *   "terkirim" yang menunggu verifikasi dari "terkirim" yang sedang diperbaiki.
 *
 * `catatanBukaKunci` adalah penanda tunggal, bukan `status` saja: buka kunci
 * tidak boleh membuat status baru (mis. `perlu_perbaikan`) yang harus dihitung
 * ulang di seluruh halaman.
 */
export function terkunciUntukPetugas(
  status: StatusLaporan,
  catatanBukaKunci?: string | null
): boolean {
  // Terverifikasi SELALU terkunci. Catatan buka kunci tidak melepasnya: satu-
  // satunya cara keluar dari terverifikasi adalah Admin mengubah statusnya
  // kembali ke terkirim lewat bukaKunciLaporan. (Kombinasi terverifikasi +
  // catatan memang tidak pernah terbentuk — kalau terbentuk, ia tetap terkunci.)
  if (status === "terverifikasi") return true;
  // Terkirim terkunci kecuali Admin sedang membukanya.
  return status === "terkirim" && !catatanBukaKunci;
}

/** Kebalikannya, supaya pemanggil tidak perlu menegasikan sendiri. */
export function bolehDiubahPetugas(
  status: StatusLaporan,
  catatanBukaKunci?: string | null
): boolean {
  return !terkunciUntukPetugas(status, catatanBukaKunci);
}

/**
 * Tombol mana yang ditampilkan di /input.
 *
 * `baru`  : belum ada barisnya — kirim langsung menetapkan terkirim.
 * `draf`  : ada draf — "Simpan draf" dan "Kirim laporan" sama-sama masuk akal.
 * `ulang` : terkunci sudah dibuka Admin — hanya "Kirim ulang" yang masuk akal;
 *           "Simpan draf" akan menurunkannya kembali ke draf dan menghapus
 *           jejak bahwa Admin pernah menulis alasan perbaikan.
 * `lihat` : terkunci — tidak ada tombol simpan sama sekali.
 */
export type ModeFormulir = "baru" | "draf" | "ulang" | "lihat";

export function modeFormulir(
  status: StatusLaporan,
  catatanBukaKunci?: string | null
): ModeFormulir {
  if (terkunciUntukPetugas(status, catatanBukaKunci)) return "lihat";
  if (status === "draf") return "draf";
  return catatanBukaKunci ? "ulang" : "baru";
}

/** Mode `lihat` mengunci seluruh isian formulir. */
export function bacaSaja(mode: ModeFormulir): boolean {
  return mode === "lihat";
}

/**
 * Aturan mode untuk Admin Pusat yang mengisi laporan.
 *
 * Admin Pusat adalah sumber yang diverifikasi, bukan pengirim yang menunggu
 * verifikasi: ia tidak punya draf (setiap simpan langsung terverifikasi) dan
 * tidak pernah terkunci — laporan terverifikasi pun harus dapat ia betulkan.
 * Karena itu satu-satunya pertanyaan yang tersisa adalah barisnya sudah ada
 * atau belum. Aturan petugas (`modeFormulir`/`terkunciUntukPetugas`) sengaja
 * tidak diubah: dua peran, dua aturan, masing-masing satu sumber.
 */
export type ModeAdmin = "baru" | "perbarui";

export function modeFormulirAdmin(status: StatusLaporan): ModeAdmin {
  return status === "belum" ? "baru" : "perbarui";
}
