import { Pengungkap } from "./pengungkap";
import { Galeri } from "./galeri";
import { FOTO } from "./konvensi";

/**
 * Empat aktivitas kunci di Pos SAPA (slide 8). Nomor 01–04 memakai warna
 * semantik PRD §8.1: biru untuk layanan anak, emerald untuk pemberdayaan,
 * rose untuk pengaduan kekerasan, slate/biru untuk edukasi.
 *
 * `foto` berisi daftar: kartu dengan beberapa foto menjadi galeri geser.
 */

const AKTIVITAS = [
  {
    no: "01",
    judul: "Aktivitas Bermain dan Dukungan Psikososial Anak",
    isi: "Ruang bermain aman, aktivitas kreatif, dan dukungan psikososial untuk membantu pemulihan anak.",
    foto: FOTO.aktivitasAnak,
    alt: "Anak-anak mengikuti kegiatan bermain di Pos SAPA",
    badge: "bg-blue-700",
  },
  {
    no: "02",
    judul: "Aktivitas Pemberdayaan dan Dukungan Psikososial Perempuan",
    isi: "Penguatan kapasitas, aktivitas keterampilan dan produktif, serta dukungan psikososial bagi perempuan.",
    foto: FOTO.aktivitasPerempuan,
    alt: "Ibu-ibu mengikuti kegiatan pemberdayaan di Pos SAPA",
    badge: "bg-emerald-700",
  },
  {
    no: "03",
    judul: "Layanan Pengaduan Kekerasan",
    isi: "Penerimaan pengaduan, identifikasi awal, pendampingan, perlindungan, dan rujukan kasus kekerasan.",
    foto: FOTO.aktivitasPengaduan,
    alt: "Pendampingan pengaduan kekerasan di Pos SAPA",
    badge: "bg-rose-700",
  },
  {
    no: "04",
    judul: "Aktivitas Edukasi dan Sosialisasi pada Masyarakat",
    isi: "Edukasi dan sosialisasi pencegahan kekerasan melalui pertemuan masyarakat, forum desa, dan kegiatan komunitas.",
    foto: FOTO.aktivitasEdu,
    alt: "Sosialisasi pencegahan kekerasan kepada warga",
    badge: "bg-slate-700",
  },
];

export function Aktivitas() {
  return (
    <section id="aktivitas" aria-labelledby="judul-aktivitas" className="publik-anchor">
      <div className="publik-wrap publik-bagian">
        <Pengungkap>
          <div className="publik-kepala">
            <div>
              <p className="publik-eyebrow mb-2.5">Aktivitas kunci</p>
              <h2 id="judul-aktivitas" className="publik-judul text-3xl sm:text-4xl">
                Empat layanan yang berjalan setiap hari
              </h2>
            </div>
            <p className="publik-lead">
              Setiap Pos SAPA menjalankan empat jenis kegiatan yang saling
              melengkapi — dari pemulihan anak sampai penanganan kasus
              kekerasan.
            </p>
          </div>
        </Pengungkap>

        <div className="grid gap-4 sm:grid-cols-2">
          {AKTIVITAS.map((a, i) => (
            <Pengungkap key={a.no} jeda={i % 2}>
              <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="aspect-[16/10] w-full">
                  <Galeri foto={a.foto} alt={a.alt} label={a.judul} />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <span
                    className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 font-display text-[11px] font-extrabold tracking-wider text-white ${a.badge}`}
                  >
                    {a.no}
                  </span>
                  <h3 className="mt-2.5 font-display text-base font-bold leading-snug text-slate-900">
                    {a.judul}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {a.isi}
                  </p>
                </div>
              </article>
            </Pengungkap>
          ))}
        </div>
      </div>
    </section>
  );
}
