import { Pengungkap } from "./pengungkap";

/**
 * Sebaran 18 titik Pos SAPA dan 11 lembaga mitra pelaksana (slide 5 & 7).
 *
 * Data sengaja ditulis statis sesuai paparan, BUKAN dibaca dari tabel
 * `pos_sapa` — seed wilayah memang tidak mengisi lokasi, dan angka "18 titik
 * diaktivasi" adalah angka paparan per 4 November 2026. Jumlah pos aktif
 * menurut laporan live tetap tampil terpisah di `#data`.
 */

const PROVINSI = [
  {
    nama: "Aceh",
    jumlah: 8,
    titik: [
      ["Aceh Tamiang", "Huntara Kampung Empat, Kec. Karang Baru"],
      ["Aceh Timur", "Desa Grg-Grong, Kec. Pante Bidari"],
      ["Aceh Utara", "Gampong Alue Anou Timu, Kec. Baktiya"],
      ["Pidie Jaya", "Kantor Dinsos PPPA Kab. Pidie Jaya"],
      ["Bener Meriah", "Huntara Tunyang, Kec. Timang Gajah"],
      ["Aceh Tengah", "Huntara Penarun, Kec. Linge"],
      ["Gayo Lues", "Huntara Rigep, Kec. Dabun Gelang"],
      ["Nagan Raya", "Huntara Beutong Ateuh, Kec. Beutong Ateuh Banggalang"],
    ],
  },
  {
    nama: "Sumatera Barat",
    jumlah: 5,
    titik: [
      ["Padang Pariaman", "Huntara Asam Pulau, Kec. 2x11 Kayu Tanam"],
      ["Kota Padang", "Huntara Lubuk Buaya"],
      ["Agam", "Huntara Kayu Pasak, Kec. Palembayan"],
      ["Solok", "Pos SAPA Junjung Sirih, Rumah Relawan Solok"],
      ["Tanah Datar", "Pos SAPA Ladang Laweh, Kec. Rambatan"],
    ],
  },
  {
    nama: "Sumatera Utara",
    jumlah: 5,
    titik: [
      ["Langkat", "Ruang Publik Terpadu Ramah Anak (RPTRA) Kec. Gebang"],
      ["Sibolga", "Pos SAPA Kelurahan Aek Parombunan"],
      ["Tapanuli Tengah", "Pos SAPA Kawasan Rusunawa, Kec. Pandan"],
      ["Tapanuli Utara", "Pos SAPA Desa Dolok Nauli, Kec. Adian Koting"],
      ["Tapanuli Selatan", "Pos SAPA Huntap Hapesong Baru, Barangtoru"],
    ],
  },
] as const;

/**
 * Logo dipotong dari halaman 7 paparan RTM (gambar asli beresolusi penuh),
 * disimpan di `public/mitra/` sebagai PNG 180×180. Nama berkas =
 * `logo`, dan `nama` adalah teks yang tampil di bawahnya.
 */
const MITRA = [
  { nama: "Flower Aceh", logo: "/mitra/flower-aceh.png" },
  { nama: "Muslimat NU Provinsi Aceh", logo: "/mitra/muslimat-nu-aceh.png" },
  { nama: "Yayasan Geutanyoe", logo: "/mitra/geutanyoe.png" },
  { nama: "PD SALIMAH Gayo Lues", logo: "/mitra/salimah-gayo-lues.png" },
  { nama: "Jemari Sakato", logo: "/mitra/jemari-sakato.png" },
  { nama: "Aisyiyah Sumatera Barat", logo: "/mitra/aisyiyah-sumbar.png" },
  {
    nama: "Muslimat NU Kab. Padang Pariaman",
    logo: "/mitra/muslimat-nu-padang-pariaman.png",
  },
  {
    nama: "Muslimat NU Kab. Tanah Datar",
    logo: "/mitra/muslimat-nu-tanah-datar.png",
  },
  {
    nama: "Yayasan Fajar Sejahtera Indonesia (YAFSI)",
    logo: "/mitra/yafsi.png",
  },
  {
    nama: "Yayasan Pusat Kajian dan Perlindungan Anak (PKPA)",
    logo: "/mitra/pkpa.png",
  },
  {
    nama: "Yayasan Kelompok Kerja Sosial Perkotaan (KKSP)",
    logo: "/mitra/kksp.png",
  },
];

export function Sebaran() {
  let nomor = 0;

  return (
    <section id="sebaran" aria-labelledby="judul-sebaran" className="publik-anchor">
      <div className="publik-wrap publik-bagian">
        <Pengungkap>
          <div className="publik-kepala">
            <div>
              <p className="publik-eyebrow mb-2.5">Sebaran layanan</p>
              <h2 id="judul-sebaran" className="publik-judul text-3xl sm:text-4xl">
                18 titik Pos SAPA telah diaktivasi
              </h2>
            </div>
            <p className="publik-lead">
              Tersebar di tiga provinsi: Aceh 8 titik, Sumatera Barat 5 titik,
              dan Sumatera Utara 5 titik — sebagian besar di huntara dan huntap.
            </p>
          </div>
        </Pengungkap>

        <div className="grid items-start gap-5 lg:grid-cols-3">
          {PROVINSI.map((p, pi) => (
            <Pengungkap key={p.nama} jeda={pi}>
              <div className="h-full rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-3">
                  <h3 className="font-display text-base font-bold text-slate-900">
                    {p.nama}
                  </h3>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
                    {p.jumlah} titik
                  </span>
                </div>
                <ol className="divide-y divide-slate-100">
                  {p.titik.map(([kab, lokasi]) => {
                    nomor += 1;
                    return (
                      <li key={kab} className="flex gap-2.5 px-4 py-2.5">
                        <span
                          aria-hidden="true"
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-extrabold text-slate-950 tabular-nums"
                        >
                          {nomor}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-900">
                            {kab}
                          </span>
                          <span className="block text-xs leading-snug text-slate-600">
                            {lokasi}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </Pengungkap>
          ))}
        </div>

        <Pengungkap>
          <div className="mt-12 sm:mt-14">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="publik-judul text-xl sm:text-2xl">
                11 lembaga masyarakat menjadi mitra pelaksana
              </h3>
              <p className="text-xs text-slate-500">
                Sumber: Paparan RTM Menteri PPPA, 4 November 2026
              </p>
            </div>
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {MITRA.map((m) => (
                <li
                  key={m.logo}
                  className="flex flex-col items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-4 text-center"
                >
                  {/* Kotak tinggi tetap: logo punya rasio berbeda-beda
                      (Geutanyoe bertumpuk teks, Jemari Sakato melebar), jadi
                      tanpa ini nama lembaga tidak sejajar antar-kartu. */}
                  <div className="flex h-24 w-full items-center justify-center">
                    {/* img biasa: logo PNG statis di public/, tanpa
                        optimisasi next/image. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.logo}
                      alt={`Logo ${m.nama}`}
                      width={96}
                      height={96}
                      loading="lazy"
                      decoding="async"
                      className="max-h-24 max-w-full object-contain"
                    />
                  </div>
                  <span className="text-xs font-semibold leading-snug text-slate-700">
                    {m.nama}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Pengungkap>
      </div>
    </section>
  );
}
