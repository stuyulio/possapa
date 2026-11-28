/**
 * Aturan pemetaan publikasi ke baris `laporan` yang sudah ada.
 *
 * Satu laporan publikasi = satu kelompok baris `laporan`, satu baris per
 * publikasi. Saat menyimpan ulang, formulir mengirim id baris lama sejajar
 * urutan kartu; fungsi di sini memutuskan baris mana yang dipakai ulang dan
 * mana yang dibuang.
 *
 * Modul murni supaya aturan yang mudah salah ini dapat diuji tanpa database.
 * Kesalahan di sini tidak memunculkan galat: ia diam-diam menimpa publikasi
 * yang salah, dan baru ketahuan saat Admin memverifikasi.
 */

/**
 * Petakan id dari klien ke indeks kartu.
 *
 * POSISIONAL: `hasil[i]` selalu milik kartu ke-i. Jangan menyaring lalu
 * memadatkan daftar — kalau kartu pertama baru (tanpa id) dan kartu kedua
 * memakai id lama, pemadatan akan menggeser id itu ke indeks 0, lalu isian
 * kartu pertama menimpa baris milik kartu kedua.
 *
 * Id yang tidak dikenal (sudah dihapus di tab lain, atau bukan milik
 * kombinasi pos+periode ini) menjadi null: kartu itu disimpan sebagai baris
 * baru. Menolak seluruh kiriman hanya karena satu id usang akan menghukum
 * pengguna atas keadaan yang bukan salahnya.
 */
export function petakanIdPublikasi(
  idDikirim: unknown,
  idSah: Set<string>,
  jumlahKartu: number
): (string | null)[] {
  const daftar = Array.isArray(idDikirim) ? idDikirim : [];

  return Array.from({ length: jumlahKartu }, (_, i) => {
    const id = daftar[i];
    return typeof id === "string" && id.length > 0 && idSah.has(id) ? id : null;
  });
}

/**
 * Baris lama yang harus dihapus: yang id-nya tidak dipakai lagi oleh kartu
 * mana pun. Inilah perwujudan tombol "Hapus" di formulir.
 */
export function idPublikasiDibuang(
  idLama: string[],
  idDipakai: (string | null)[]
): string[] {
  const dipakai = new Set(idDipakai.filter((id): id is string => Boolean(id)));
  return idLama.filter((id) => !dipakai.has(id));
}
