import { Pengungkap } from "./pengungkap";
import { Gambar } from "./gambar";
import { FOTO } from "./konvensi";
import { angka } from "@/lib/format";

/**
 * Capaian layanan per 4 November 2026 (slide 9–12).
 *
 * Seluruh angka di bagian ini STATIS, disalin dari paparan RTM. Ini sengaja
 * dibedakan dari tabel live di `#data` dan diberi atribusi sumber tertulis
 * supaya pembaca tidak menyangka keduanya satu sumber.
 */

const ANGKA = [
  { nilai: 18, label: "titik Pos SAPA diaktivasi", rujukan: "3 provinsi" },
  { nilai: 144, label: "petugas Pos SAPA aktif", rujukan: "SK bupati/kepala dinas PPPA" },
  { nilai: 850, label: "anak penerima manfaat", rujukan: "bermain & psikososial" },
  { nilai: 1773, label: "penerima manfaat edukasi", rujukan: "974 perempuan · 799 anak" },
  { nilai: 39, label: "kegiatan edukasi masyarakat", rujukan: "berbasis komunitas" },
  { nilai: 17, label: "perempuan kepala keluarga", rujukan: "pemberdayaan ekonomi" },
  { nilai: 11, label: "kasus/aduan diterima", rujukan: "11 dari 11 ditindaklanjuti" },
  { nilai: 11, label: "lembaga mitra pelaksana", rujukan: "masyarakat sipil" },
];

/** Bentuk kegiatan anak — ditampilkan sebagai daftar pendek, bukan kartu. */
const BENTUK_ANAK = [
  "Latihan menari",
  "Mengaji",
  "Bermain",
  "Olahraga",
  "Membaca buku",
];

export function Capaian() {
  return (
    <section
      id="capaian"
      aria-labelledby="judul-capaian"
      className="publik-anchor border-y border-slate-200 bg-slate-50"
    >
      <div className="publik-wrap publik-bagian">
        <Pengungkap>
          <div className="publik-kepala">
            <div>
              <p className="publik-eyebrow mb-2.5">Capaian layanan</p>
              <h2 id="judul-capaian" className="publik-judul text-3xl sm:text-4xl">
                Yang sudah berjalan di lapangan
              </h2>
            </div>
            <p className="publik-lead">
              Angka di bawah ini berasal dari paparan RTM Menteri PPPA per 4
              November 2026, bukan dari laporan berkala live. Data live per
              kabupaten/kota ada di bagian{" "}
              <a
                href="#data"
                className="font-semibold text-slate-900 underline decoration-amber-500 decoration-2 underline-offset-4"
              >
                Capaian data
              </a>
              .
            </p>
          </div>
        </Pengungkap>

        <Pengungkap>
          <div className="publik-angka [&>div]:flex [&>div]:flex-col [&>div]:justify-between">
            {ANGKA.map((a) => (
              <div key={a.label}>
                <b>{angka(a.nilai)}</b>
                <span>{a.label}</span>
                <i>{a.rujukan}</i>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Sumber: Paparan RTM Menteri PPPA, 4 November 2026.
          </p>
        </Pengungkap>

        <div className="mt-10 grid gap-4 sm:mt-12 lg:grid-cols-3">
          <Pengungkap>
            <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="aspect-[16/10] w-full">
                <Gambar
                  src={undefined}
                  alt="Anak-anak bermain di halaman Pos SAPA"
                />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-display text-base font-bold leading-snug text-slate-900">
                  Bermain dan dukungan psikososial anak
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  Dilaksanakan setiap hari dengan 850 penerima manfaat anak.
                </p>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {BENTUK_ANAK.map((b) => (
                    <li
                      key={b}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                    >
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </Pengungkap>

          <Pengungkap jeda={1}>
            <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-display text-base font-bold leading-snug text-slate-900">
                Pemberdayaan perempuan
              </h3>
              <p className="mt-1.5 text-sm text-slate-600">
                17 perempuan kepala keluarga menjadi penerima manfaat.
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
                <li className="flex gap-2">
                  <span aria-hidden="true" className="text-emerald-700">▸</span>
                  Edukasi melalui pengajian ibu-ibu.
                </li>
                <li className="flex gap-2">
                  <span aria-hidden="true" className="text-emerald-700">▸</span>
                  Pemberian bibit sayur pola hidroponik untuk penguatan ekonomi
                  keluarga.
                </li>
                <li className="flex gap-2">
                  <span aria-hidden="true" className="text-emerald-700">▸</span>
                  Penguatan perempuan kepala keluarga terkait pola tanam
                  hidroponik.
                </li>
              </ul>
            </article>
          </Pengungkap>

          <Pengungkap jeda={2}>
            <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-display text-base font-bold leading-snug text-slate-900">
                Layanan pengaduan
              </h3>
              <p className="mt-1.5 text-sm text-slate-600">
                11 kasus/aduan diterima dari 6 dari 18 kabupaten; seluruhnya
                dalam proses tindak lanjut.
              </p>
              <dl className="mt-3 space-y-2">
                <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2">
                  <dt className="text-sm text-slate-600">Korban/penerima layanan</dt>
                  <dd className="font-display text-lg font-extrabold text-slate-900 tabular-nums">
                    11
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2">
                  <dt className="text-sm text-slate-600">Dalam proses tindak lanjut</dt>
                  <dd className="font-display text-lg font-extrabold text-emerald-700 tabular-nums">
                    11 / 11
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-sm text-slate-600">Kabupaten melaporkan kasus</dt>
                  <dd className="font-display text-lg font-extrabold text-slate-900 tabular-nums">
                    6 / 18
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                Rincian per kabupaten tidak ditampilkan di halaman publik.
                Ringkasan live per wilayah ada di tabel Capaian data.
              </p>
            </article>
          </Pengungkap>
        </div>
      </div>
    </section>
  );
}
