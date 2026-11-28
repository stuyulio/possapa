/**
 * Titik tunggal konfigurasi landing page.
 *
 * Foto lapangan disimpan di `public/foto/beranda/` sebagai WebP ±150-260 KB,
 * diproduksi dari berkas kamera mentah dengan `scripts/siapkan-foto-landing.py`
 * (skrip itu juga membuang EXIF/GPS). Jangan menaruh berkas kamera apa pun di
 * `public/` — subfolder mentah diabaikan git.
 */

export type Foto = {
  src: string;
  /** Alt wajib dan harus menggambarkan isi foto yang benar-benar tampil. */
  alt: string;
};

export const FOTO: {
  heroUtama?: Foto;
  mandat?: Foto;
  aktivitasAnak: Foto[];
  aktivitasPerempuan: Foto[];
  aktivitasPengaduan: Foto[];
  aktivitasEdu: Foto[];
  pintuWarga: Foto[];
  pintuPetugas: Foto[];
  pintuMitra: Foto[];
} = {
  heroUtama: {
    src: "/foto/beranda/hero-utama.webp",
    alt: "Anak-anak dan warga berkumpul di depan panggung berhias balon pada perhelatan Pos SAPA",
  },
  mandat: {
    src: "/foto/beranda/mandat.webp",
    alt: "Seorang anak bermain komidi putar di taman bermain kawasan huntara",
  },

  aktivitasAnak: [
    {
      src: "/foto/beranda/aktivitas-anak-1.webp",
      alt: "Pendamping Pos SAPA mengajak seorang ibu melakukan gerakan dukungan psikososial",
    },
    {
      src: "/foto/beranda/aktivitas-anak-2.webp",
      alt: "Anak-anak bermain di taman bermain ramah anak di kawasan huntara",
    },
    {
      src: "/foto/beranda/aktivitas-anak-3.webp",
      alt: "Anak-anak mengikuti kegiatan bermain dan bercerita bersama pendamping di bawah tenda Pos SAPA",
    },
    {
      src: "/foto/beranda/aktivitas-anak-4.webp",
      alt: "Seorang anak tertawa saat bermain di taman bermain hunian sementara",
    },
  ],

  aktivitasPerempuan: [
    {
      src: "/foto/beranda/aktivitas-perempuan-1.webp",
      alt: "Peserta perempuan menyusun peta kapasitas bersama di atas tikar",
    },
    {
      src: "/foto/beranda/aktivitas-perempuan-2.webp",
      alt: "Peserta perempuan berdiskusi dalam kelompok dengan kertas tempel",
    },
    {
      src: "/foto/beranda/aktivitas-perempuan-3.webp",
      alt: "Perempuan peserta pelatihan menempelkan catatan pada lembar kerja kelompok",
    },
    {
      src: "/foto/beranda/aktivitas-perempuan-4.webp",
      alt: "Peserta perempuan berdiskusi sambil mendampingi anak",
    },
  ],

  // Folder sumber masih kosong: kartu 03 tetap memakai placeholder bergradien
  // sampai foto pendampingan pengaduan yang tidak menampilkan korban tersedia.
  aktivitasPengaduan: [],

  aktivitasEdu: [
    {
      src: "/foto/beranda/aktivitas-edu-1.webp",
      alt: "Pemaparan aktivasi dan peningkatan kapasitas Forum Anak di hadapan peserta",
    },
    {
      src: "/foto/beranda/aktivitas-edu-2.webp",
      alt: "Peserta Forum Anak mengikuti sesi peningkatan kapasitas di aula",
    },
  ],

  pintuWarga: [
    {
      src: "/foto/beranda/pintu-warga-1.webp",
      alt: "Seorang perempuan menyampaikan sambutan di hadapan warga dalam perhelatan Pos SAPA",
    },
    {
      src: "/foto/beranda/pintu-warga-2.webp",
      alt: "Anak-anak dan warga duduk mengikuti kegiatan bersama di bawah tenda",
    },
  ],

  pintuPetugas: [
    {
      src: "/foto/beranda/pintu-petugas-1.webp",
      alt: "Dua petugas memeriksa dokumen di depan spanduk Pos SAPA",
    },
    {
      src: "/foto/beranda/pintu-petugas-2.webp",
      alt: "Petugas Pos SAPA berfoto bersama sambil memegang brosur layanan",
    },
    {
      src: "/foto/beranda/pintu-petugas-3.webp",
      alt: "Petugas bersama warga melakukan pendataan di lantai rumah",
    },
  ],

  pintuMitra: [
    {
      src: "/foto/beranda/pintu-mitra-1.webp",
      alt: "Pertemuan pendamping Yayasan Geutanyoe bersama warga di depan spanduk Pos SAPA",
    },
  ],
};

/** Navigasi header — sumber tunggal agar header dan tile tidak menyimpang. */
export const NAV = [
  { id: "mandat", label: "Mandat" },
  { id: "konsep", label: "Konsep" },
  { id: "aktivitas", label: "Aktivitas" },
  { id: "sebaran", label: "Sebaran" },
  { id: "data", label: "Data" },
] as const;
