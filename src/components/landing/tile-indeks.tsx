import { Pengungkap } from "./pengungkap";
import { Gambar } from "./gambar";

/**
 * "Mulai di sini" — pola `.tiles` referensi: grid gambar-atas yang sekaligus
 * menjadi daftar isi halaman. Berbeda dari referensi (yang hanya menampilkan
 * ini di ponsel), grid dipakai di semua breakpoint karena pengunjung baru
 * butuh satu pintu masuk yang jelas.
 */

const TILE = [
  {
    id: "konsep",
    judul: "Apa itu Pos SAPA?",
    ringkas: "Ruang layanan perlindungan yang dibentuk dalam situasi bencana.",
  },
  {
    id: "mandat",
    judul: "Mandat & dasar hukum",
    ringkas: "Instruksi Presiden Nomor 18 Tahun 2025 dan empat butir mandat Menteri PPPA.",
  },
  {
    id: "alur",
    judul: "Lima tahap penyelenggaraan",
    ringkas: "Dari advokasi dan asesmen sampai monitoring dan evaluasi.",
  },
  {
    id: "aktivitas",
    judul: "Empat aktivitas kunci",
    ringkas: "Pendampingan anak, pemberdayaan perempuan, pengaduan, dan edukasi.",
  },
  {
    id: "sebaran",
    judul: "18 titik layanan",
    ringkas: "Sebaran Pos SAPA di Aceh, Sumatera Utara, dan Sumatera Barat.",
  },
] as const;

export function TileIndeks() {
  return (
    <section id="mulai" aria-labelledby="judul-mulai" className="publik-anchor">
      <div className="publik-wrap pb-12 pt-8 sm:pb-16 sm:pt-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="judul-mulai" className="publik-judul text-2xl sm:text-3xl">
              Mulai di sini
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Pilih yang ingin Anda ketahui lebih dulu.
            </p>
          </div>
          <a href="#data" className="text-sm font-bold text-slate-900 underline decoration-amber-500 decoration-2 underline-offset-4 hover:decoration-amber-600">
            Langsung ke data capaian →
          </a>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TILE.map((t, i) => (
            <Pengungkap key={t.id} jeda={i % 3}>
              <a href={`#${t.id}`} className="publik-tile h-full">
                <div className="h-[84px] w-full shrink-0">
                  <Gambar src={undefined} alt="" ukuran="strip" />
                </div>
                <span className="flex flex-col gap-1 p-4">
                  <b>{t.judul}</b>
                  <span className="text-xs leading-snug text-slate-600">
                    {t.ringkas}
                  </span>
                </span>
              </a>
            </Pengungkap>
          ))}
        </div>
      </div>
    </section>
  );
}
