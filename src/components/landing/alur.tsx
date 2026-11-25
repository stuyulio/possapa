import { Pengungkap } from "./pengungkap";

/**
 * Lima tahap aktivasi dan operasionalisasi Pos SAPA (slide 4) — pola `.flow`
 * referensi: kartu bernomor dalam satu baris yang turun bertahap di layar
 * sempit.
 */

const TAHAP = [
  "Advokasi dan Sosialisasi Penyelenggaraan Pos SAPA",
  "Asesmen Kondisi dan Kebutuhan Pos SAPA",
  "Penguatan Kapasitas bagi Petugas Pos SAPA",
  "Aktivasi dan Operasionalisasi Pos SAPA",
  "Monitoring dan Evaluasi Penyelenggaraan Pos SAPA",
];

export function Alur() {
  return (
    <section
      id="alur"
      aria-labelledby="judul-alur"
      className="publik-anchor border-y border-slate-200 bg-slate-50"
    >
      <div className="publik-wrap publik-bagian">
        <Pengungkap>
          <div className="publik-kepala">
            <div>
              <p className="publik-eyebrow mb-2.5">Aktivasi &amp; operasionalisasi</p>
              <h2 id="judul-alur" className="publik-judul text-3xl sm:text-4xl">
                Lima tahap, satu rangkaian
              </h2>
            </div>
            <p className="publik-lead">
              Rangkaian upaya terstruktur untuk menghadirkan, menjalankan, dan
              memastikan keberfungsian layanan perlindungan perempuan dan anak
              di wilayah terdampak bencana.
            </p>
          </div>
        </Pengungkap>

        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {TAHAP.map((t, i) => (
            <Pengungkap key={t} sebagai="li" jeda={i}>
              <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4">
                <span className="font-display text-2xl font-extrabold leading-none text-blue-800 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mt-2.5 text-sm font-semibold leading-snug text-slate-800">
                  {t}
                </p>
              </div>
            </Pengungkap>
          ))}
        </ol>
      </div>
    </section>
  );
}
