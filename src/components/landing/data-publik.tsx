import { Pengungkap } from "./pengungkap";
import { angka as fmt, persen, waktuPanjang } from "@/lib/format";

/**
 * Blok data live: 4 kartu KPI nasional + tabel per kabupaten/kota.
 *
 * Dipindahkan apa adanya dari `src/app/page.tsx` lama. `KartuKpi` sengaja
 * tetap lokal (tidak memakai `dashboard/kpi-card.tsx`) supaya tampilan
 * dashboard internal tidak ikut berubah bila kartu ini disesuaikan.
 */

export type Ringkasan = {
  provinsi: string;
  kab_kota: string;
  jumlah_pos_aktif: number;
  jumlah_pos_melapor: number;
  total_anak: number;
  total_perempuan: number;
  total_anak_disabilitas: number;
  total_aduan: number;
  total_aduan_ditindaklanjuti: number;
  total_aduan_simfoni: number;
  total_publikasi: number;
};

export type Total = {
  anak: number;
  perempuan: number;
  disabilitas: number;
  aduan: number;
  ditindaklanjuti: number;
  simfoni: number;
  publikasi: number;
};

function KartuKpi({
  label,
  nilai,
  keterangan,
}: {
  label: string;
  nilai: string;
  keterangan?: string;
}) {
  return (
    <div className="kpi-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl font-extrabold text-slate-900">
        {nilai}
      </p>
      {keterangan && <p className="mt-1 text-xs text-slate-500">{keterangan}</p>}
    </div>
  );
}

export function DataPublik({
  ringkasan,
  total,
  terakhirDiperbarui,
}: {
  ringkasan: Ringkasan[];
  total: Total;
  terakhirDiperbarui: string | null;
}) {
  const waktuDiperbarui = waktuPanjang(terakhirDiperbarui);
  const pctTl = persen(total.ditindaklanjuti, total.aduan);
  const pctSimfoni = persen(total.simfoni, total.aduan);

  // Belum ada satu pun laporan masuk. Menampilkan "0" akan terbaca sebagai
  // nol sungguhan (mis. "tidak ada anak penerima manfaat"), padahal artinya
  // data per periode ini belum dilaporkan. Tampilkan "—" dan keterangan.
  const belumAdaLaporan = !terakhirDiperbarui;
  const kosong = "—";
  const ketBelum = "Belum ada laporan terverifikasi";

  return (
    <section
      id="data"
      aria-labelledby="judul-data"
      className="publik-anchor"
    >
      <div className="publik-wrap publik-bagian">
        <Pengungkap>
          <div className="publik-kepala">
            <div>
              <p className="publik-eyebrow mb-2.5">Data live</p>
              <h2 id="judul-data" className="publik-judul text-3xl sm:text-4xl">
                Dashboard Capaian Kinerja Pos SAPA
              </h2>
            </div>
            <p className="publik-lead">
              Angka di bawah ini adalah agregat laporan berkala terverifikasi
              yang diisi petugas Pos SAPA dan diperbarui otomatis setiap lima
              menit. Hanya data agregat yang ditampilkan — tidak ada identitas
              atau rincian kasus.
            </p>
          </div>
        </Pengungkap>

        <Pengungkap>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KartuKpi
              label="Anak penerima manfaat"
              nilai={belumAdaLaporan ? kosong : fmt(total.anak)}
              keterangan={
                belumAdaLaporan
                  ? ketBelum
                  : `${fmt(total.disabilitas)} anak penyandang disabilitas`
              }
            />
            <KartuKpi
              label="Perempuan penerima manfaat"
              nilai={belumAdaLaporan ? kosong : fmt(total.perempuan)}
              keterangan={belumAdaLaporan ? ketBelum : undefined}
            />
            <KartuKpi
              label="Pengaduan diterima"
              nilai={belumAdaLaporan ? kosong : fmt(total.aduan)}
              keterangan={
                belumAdaLaporan ? ketBelum : `${pctTl}% ditindaklanjuti`
              }
            />
            <KartuKpi
              label="Tercatat SIMFONI PPA"
              nilai={belumAdaLaporan ? kosong : `${pctSimfoni}%`}
              keterangan={
                belumAdaLaporan
                  ? ketBelum
                  : `${fmt(total.simfoni)} dari ${fmt(total.aduan)} aduan`
              }
            />
          </div>
        </Pengungkap>

        <Pengungkap>
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="font-display font-bold text-slate-900">
                Ringkasan per Kabupaten/Kota
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {ringkasan.length} wilayah sasaran
                {waktuDiperbarui && (
                  <>
                    {" · "}
                    <span title="Waktu ubah laporan terakhir">
                      Data diperbarui {waktuDiperbarui}
                    </span>
                  </>
                )}
              </p>
            </div>

            {ringkasan.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Belum ada data. Pastikan database sudah terhubung dan seed
                wilayah sudah dijalankan.
              </div>
            ) : (
              <div
                className="overflow-x-auto"
                role="region"
                aria-label="Tabel ringkasan per kabupaten/kota"
                tabIndex={0}
              >
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    Ringkasan capaian Pos SAPA per kabupaten/kota: jumlah pos
                    aktif, pos melapor, anak, perempuan, aduan, dan publikasi.
                  </caption>
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th
                        scope="col"
                        className="sticky left-0 bg-slate-50 px-5 py-3 text-left font-semibold"
                      >
                        Kabupaten/Kota
                      </th>
                      <th scope="col" className="px-5 py-3 text-left font-semibold">
                        Provinsi
                      </th>
                      <th scope="col" className="px-5 py-3 text-right font-semibold">
                        Pos aktif
                      </th>
                      <th scope="col" className="px-5 py-3 text-right font-semibold">
                        Melapor
                      </th>
                      <th scope="col" className="px-5 py-3 text-right font-semibold">
                        Anak
                      </th>
                      <th scope="col" className="px-5 py-3 text-right font-semibold">
                        Perempuan
                      </th>
                      <th scope="col" className="px-5 py-3 text-right font-semibold">
                        Aduan
                      </th>
                      <th scope="col" className="px-5 py-3 text-right font-semibold">
                        Publikasi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ringkasan.map((r) => (
                      <tr
                        key={`${r.provinsi}-${r.kab_kota}`}
                        className="hover:bg-slate-50"
                      >
                        <td className="sticky left-0 bg-white px-5 py-3 font-semibold text-slate-900">
                          {r.kab_kota}
                        </td>
                        <td className="px-5 py-3 text-slate-600">{r.provinsi}</td>
                        <td className="px-5 py-3 text-right">
                          {r.jumlah_pos_aktif}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {r.jumlah_pos_melapor}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {fmt(r.total_anak)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {fmt(r.total_perempuan)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {fmt(r.total_aduan)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {fmt(r.total_publikasi)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Pengungkap>
      </div>
    </section>
  );
}
