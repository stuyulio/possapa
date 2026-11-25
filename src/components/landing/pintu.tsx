import { Pengungkap } from "./pengungkap";
import { Gambar } from "./gambar";
import { FOTO } from "./konvensi";

/**
 * Tiga jalur audiens — pola `.door` referensi. Setiap kartu mengarahkan ke
 * bagian yang paling relevan bagi pembacanya.
 */

const PINTU = [
  {
    jalur: "Warga & pendamping",
    judul: "Saya warga, kader, atau pendamping lapangan",
    isi: "Kenali layanan yang tersedia di Pos SAPA terdekat: ruang aman, pendampingan, dan rujukan kasus.",
    tujuan: "#aktivitas",
    tautan: "Lihat layanan",
    foto: FOTO.pintuWarga,
    alt: "Warga berkumpul dalam kegiatan Pos SAPA",
  },
  {
    jalur: "Petugas & pemerintah daerah",
    judul: "Saya petugas, dinas, atau pemerintah kabupaten",
    isi: "Pahami lima tahap penyelenggaraan, capaian layanan, dan kewajiban pelaporan berkala.",
    tujuan: "#alur",
    tautan: "Ikuti alur penyelenggaraan",
    foto: FOTO.pintuPetugas,
    alt: "Petugas Pos SAPA saat pendataan layanan",
  },
  {
    jalur: "Lembaga mitra",
    judul: "Saya lembaga masyarakat atau mitra pembangunan",
    isi: "Lihat sebaran 18 titik dan sebelas lembaga yang telah menjadi mitra pelaksana Pos SAPA.",
    tujuan: "#sebaran",
    tautan: "Lihat sebaran dan mitra",
    foto: FOTO.pintuMitra,
    alt: "Pertemuan mitra pelaksana Pos SAPA",
  },
];

export function Pintu() {
  return (
    <section
      id="untuk-siapa"
      aria-labelledby="judul-pintu"
      className="publik-anchor border-y border-slate-200 bg-slate-50"
    >
      <div className="publik-wrap publik-bagian">
        <Pengungkap>
          <div className="publik-kepala">
            <div>
              <p className="publik-eyebrow mb-2.5">Untuk siapa</p>
              <h2 id="judul-pintu" className="publik-judul text-3xl sm:text-4xl">
                Tiga jalur, satu layanan
              </h2>
            </div>
            <p className="publik-lead">
              Tidak semua orang perlu membaca semuanya. Pilih jalur yang sesuai
              peran Anda — setiap jalur menuju bagian yang paling relevan.
            </p>
          </div>
        </Pengungkap>

        <div className="grid gap-4 md:grid-cols-3">
          {PINTU.map((p, i) => (
            <Pengungkap key={p.jalur} jeda={i}>
              <a href={p.tujuan} className="publik-pintu group h-full">
                <div className="aspect-[16/10] w-full overflow-hidden">
                  <Gambar src={p.foto} alt={p.alt} />
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-5">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    {p.jalur}
                  </span>
                  <span className="font-display text-base font-bold leading-snug text-slate-900">
                    {p.judul}
                  </span>
                  <span className="text-sm leading-relaxed text-slate-600">
                    {p.isi}
                  </span>
                  <span className="mt-auto pt-3 text-sm font-bold text-slate-900 underline decoration-amber-500 decoration-2 underline-offset-4 group-hover:decoration-amber-600">
                    {p.tautan} →
                  </span>
                </div>
              </a>
            </Pengungkap>
          ))}
        </div>
      </div>
    </section>
  );
}
