import { Pengungkap } from "./pengungkap";

/**
 * Definisi dan tujuan Pos SAPA (slide 3) — pola `.sec-head` referensi:
 * judul kiri, keterangan kanan, lalu tiga kartu isi.
 */

const TUJUAN = [
  {
    judul: "Layanan cepat dan mudah diakses",
    isi: "Memastikan perempuan dan anak terdampak memperoleh layanan perlindungan yang cepat, aman, terintegrasi, dan mudah diakses.",
  },
  {
    judul: "Mencegah kekerasan",
    isi: "Mencegah kekerasan berbasis gender dan kekerasan terhadap anak di lingkungan huntara dan huntap.",
  },
  {
    judul: "Ruang aman dan psikososial",
    isi: "Memanfaatkan waktu luang perempuan dan anak, sekaligus menyediakan dukungan psikososial dan ruang aman.",
  },
];

export function Konsep() {
  return (
    <section id="konsep" aria-labelledby="judul-konsep" className="publik-anchor">
      <div className="publik-wrap publik-bagian">
        <Pengungkap>
          <div className="publik-kepala">
            <div>
              <p className="publik-eyebrow mb-2.5">Konsep penyelenggaraan</p>
              <h2 id="judul-konsep" className="publik-judul text-3xl sm:text-4xl">
                Layanan yang hadir di tengah warga terdampak
              </h2>
            </div>
            <p className="publik-lead">
              Pos Sahabat Perempuan dan Anak adalah ruang layanan perlindungan
              yang dibentuk dalam situasi bencana. Layanannya aman, mudah
              diakses, terkoordinasi, dan responsif terhadap kebutuhan perempuan
              dan anak terdampak.
            </p>
          </div>
        </Pengungkap>

        <Pengungkap>
          <p className="max-w-[70ch] rounded-xl border-l-4 border-slate-900 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700 sm:text-base">
            Pada fase pascabencana, Pos SAPA menjaga layanan tetap berlanjut,
            terutama di lingkungan huntara dan huntap.
          </p>
        </Pengungkap>

        <div className="mt-10 grid gap-4 sm:mt-12 md:grid-cols-3">
          {TUJUAN.map((t, i) => (
            <Pengungkap key={t.judul} jeda={i}>
              <div className="h-full rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="font-display text-base font-bold leading-snug text-slate-900">
                  {t.judul}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {t.isi}
                </p>
              </div>
            </Pengungkap>
          ))}
        </div>

        <Pengungkap>
          <div className="mt-10 rounded-2xl border border-slate-200 bg-blue-50/60 p-5 sm:p-7">
            <h3 className="font-display text-lg font-bold text-slate-900">
              Pos SAPA Mobile dan Komunitas
            </h3>
            <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-slate-700">
              Model berbasis komunitas yang memanfaatkan fasilitas masyarakat
              atau pemerintah yang sudah tersedia — tanpa perlu membangun gedung
              baru:
            </p>
            <ul className="mt-3 grid gap-1.5 text-sm text-slate-700 sm:grid-cols-3">
              <li className="rounded-lg bg-white px-3 py-2">
                Ruang serbaguna atau ruang komunal
              </li>
              <li className="rounded-lg bg-white px-3 py-2">
                Bangunan atau gedung yang sudah tidak terpakai
              </li>
              <li className="rounded-lg bg-white px-3 py-2">
                Kantor desa atau kantor kecamatan terdekat
              </li>
            </ul>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Unit mobile dioperasikan untuk menjangkau masyarakat yang tinggal
              di huntara dan huntap di wilayah sekitarnya.
            </p>
          </div>
        </Pengungkap>
      </div>
    </section>
  );
}
