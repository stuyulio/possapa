import { Pengungkap } from "./pengungkap";
import { Gambar } from "./gambar";
import { FOTO } from "./konvensi";

/**
 * Mandat Menteri PPPA — pola `.thesis` referensi: kartu kutipan gelap di kiri,
 * gambar pendamping di kanan, lalu empat butir mandat bernomor.
 */

const MANDAT = [
  "Memastikan perlindungan perempuan dan anak dari kekerasan, eksploitasi, dan diskriminasi.",
  "Memenuhi kebutuhan spesifik perempuan dan anak terdampak bencana.",
  "Melakukan pemulihan psikososial perempuan dan anak.",
  "Memperkuat layanan pengaduan, pendampingan, dan rujukan yang responsif gender dan ramah anak.",
];

export function Mandat() {
  return (
    <section
      id="mandat"
      aria-labelledby="judul-mandat"
      className="publik-anchor border-y border-slate-200 bg-slate-50"
    >
      <div className="publik-wrap publik-bagian">
        <Pengungkap>
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-14">
            <blockquote className="rounded-2xl bg-slate-900 p-6 text-slate-200 sm:p-9">
              <p className="font-display text-xl font-bold leading-snug text-white sm:text-2xl">
                Wujud konkret pelaksanaan mandat Menteri PPPA di wilayah
                terdampak — untuk memastikan perempuan dan anak{" "}
                <span className="text-amber-300">terlindungi, pulih, dan berdaya</span>.
              </p>
              <cite className="mt-5 block text-xs not-italic leading-relaxed text-slate-400">
                Instruksi Presiden Nomor 18 Tahun 2025 tentang Percepatan
                Penanganan Darurat, Rehabilitasi, dan Rekonstruksi Pascabencana
                Alam di Provinsi Aceh, Provinsi Sumatera Utara, dan Provinsi
                Sumatera Barat.
              </cite>
            </blockquote>

            <figure className="m-0">
              <div className="aspect-[4/3] overflow-hidden rounded-2xl">
                <Gambar
                  src={FOTO.mandat}
                  alt="Anak-anak mengikuti kegiatan bermain di Pos SAPA"
                />
              </div>
              <figcaption className="mt-2.5 text-xs text-slate-500">
                Pos SAPA sebagai implementasi mandat Menteri PPPA.
              </figcaption>
            </figure>
          </div>
        </Pengungkap>

        <div className="mt-12 sm:mt-16">
          <h2 id="judul-mandat" className="publik-judul text-2xl sm:text-3xl">
            Empat butir mandat Menteri PPPA
          </h2>
          <ol className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {MANDAT.map((m, i) => (
              <Pengungkap key={m} sebagai="li" jeda={i % 2}>
                <div className="flex gap-3.5">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-extrabold text-white"
                  >
                    ✓
                  </span>
                  <p className="text-sm leading-relaxed text-slate-700 sm:text-base">
                    {m}
                  </p>
                </div>
              </Pengungkap>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
