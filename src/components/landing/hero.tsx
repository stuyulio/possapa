import { Gambar } from "./gambar";
import { FOTO } from "./konvensi";

/**
 * Hero — pola dua kolom referensi: judul raksasa kiri, motto & CTA kanan,
 * keduanya rata bawah, lalu pita gambar lebar di bawahnya.
 *
 * Satu-satunya <h1> di halaman.
 */
export function Hero() {
  return (
    <section
      id="atas"
      aria-labelledby="judul-hero"
      className="relative overflow-hidden bg-gradient-to-b from-slate-100 via-slate-50 to-white"
    >
      <div className="publik-wrap pb-0 pt-10 sm:pt-14 lg:pt-16">
        <div className="grid items-end gap-6 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:gap-12">
          <div>
            <p className="publik-eyebrow mb-4">
              Mandat Menteri PPPA · Instruksi Presiden Nomor 18 Tahun 2025
            </p>
            <h1
              id="judul-hero"
              className="publik-judul text-[clamp(2.25rem,1.4rem+4.4vw,4.25rem)] leading-[0.98]"
            >
              Pos Sahabat{" "}
              <span className="publik-tekan">Perempuan dan Anak</span>
            </h1>
          </div>

          <div>
            <p className="font-display text-lg font-bold leading-snug text-slate-900 sm:text-xl">
              Terlindungi, pulih, dan berdaya.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
              Ruang layanan perlindungan perempuan dan anak di wilayah
              terdampak bencana — hadir di huntara, huntap, dan kawasan
              permukiman kembali di Aceh, Sumatera Utara, dan Sumatera Barat.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <a href="#mulai" className="publik-btn">
                Kenali Pos SAPA
                <span aria-hidden="true">↓</span>
              </a>
              <a href="#data" className="publik-btn-hantu">
                Lihat capaian data
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Pita gambar lebar, meniru "scene" berlapis referensi.
          Peleburan ke latar dilakukan dengan menumpuk gradien marginal DI
          DALAM pita (bukan lapisan terpisah di luarnya) supaya tidak ikut
          menutupi bagian berikutnya. */}
      <div className="relative mt-8 sm:mt-10">
        <div className="relative mx-auto aspect-[21/9] w-full max-w-[1400px] sm:aspect-[1650/620]">
          <Gambar
            src={FOTO.heroUtama?.src}
            alt={
              FOTO.heroUtama?.alt ??
              "Suasana layanan Pos SAPA di huntara"
            }
            prioritas
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/90 to-transparent"
          />
        </div>
      </div>
    </section>
  );
}
