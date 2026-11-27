import { ambilLaporan, bacaFilter } from "@/lib/data/laporan";
import { agregatAnak } from "@/lib/data/agregat";
import { angka, persen } from "@/lib/format";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { GrafikBatang, GrafikDonat, WARNA } from "@/components/dashboard/charts";
import { Panel, Badge, TabelKosong } from "@/components/dashboard/panel";
import { EksporExcel, CetakHalaman } from "@/components/dashboard/aksi-laporan";
import { kegiatanTampilAnak } from "@/lib/kegiatan";

export const metadata = { title: "Aktivitas Anak — Pos SAPA" };

export default async function HalamanAnak({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const laporan = await ambilLaporan(bacaFilter(await searchParams));
  const a = agregatAnak(laporan);

  const dataUsia = [
    { nama: "0–5 tahun", jumlah: a.usia0_5 },
    { nama: "6–12 tahun", jumlah: a.usia6_12 },
    { nama: "13–17 tahun", jumlah: a.usia13_17 },
  ];
  const dataGender = [
    { nama: "Laki-laki", jumlah: a.laki },
    { nama: "Perempuan", jumlah: a.perempuan },
  ];

  const daftar = laporan.filter((l) => l.laporan_anak);

  return (
    <>
      <div className="flex justify-end gap-2 mb-4 no-print">
        <EksporExcel jenis="anak" />
        <CetakHalaman />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total anak penerima manfaat" nilai={angka(a.totalAnak)} aksen="blue" />
        <KpiCard label="Total kegiatan" nilai={angka(a.totalKegiatan)} keterangan={`${a.jumlahLaporan} laporan`} />
        <KpiCard label="Anak penyandang disabilitas" nilai={angka(a.disabilitas)} keterangan={`${persen(a.disabilitas, a.totalAnak)}% dari total`} aksen="amber" />
        <KpiCard label="Perlu layanan lanjutan" nilai={angka(a.perluLanjutan)} aksen="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel judul="Distribusi usia anak">
          <GrafikBatang data={dataUsia} warna={WARNA.blue} />
        </Panel>
        <Panel judul="Komposisi jenis kelamin">
          <GrafikBatang data={dataGender} warna={WARNA.rose} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel judul="Komposisi jenis kegiatan">
          <GrafikDonat data={a.jenis} satuan="kegiatan" />
        </Panel>
        <Panel judul="Sebaran laporan per kabupaten/kota">
          <GrafikBatang data={a.perWilayah.map((w) => ({ nama: w.kab_kota, jumlah: w.jumlah }))} satuan="laporan" horizontal />
        </Panel>
      </div>

      <Panel
        judul="Temuan anak yang perlu ditindaklanjuti"
        keterangan={`${a.temuan.length} temuan`}
      >
        {a.temuan.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Tidak ada temuan pada filter ini.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {a.temuan.map((t, i) => (
              <li key={i} className="p-3 rounded-xl bg-rose-50/60 border border-rose-200">
                <p className="text-[11px] font-bold text-rose-800">
                  {t.kab_kota} — {t.lokasi} · {t.perlu} anak
                </p>
                <p className="text-xs text-slate-800 mt-1 leading-relaxed">{t.temuan}</p>
                {t.tindak_lanjut && (
                  <p className="text-xs text-slate-600 mt-1">
                    <strong>Tindak lanjut:</strong> {t.tindak_lanjut}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        judul="Hambatan/kendala yang dilaporkan"
        keterangan={`${a.hambatan.length} laporan`}
      >
        {a.hambatan.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Tidak ada hambatan yang dilaporkan pada filter ini.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {a.hambatan.map((h, i) => (
              <li key={i} className="p-3 rounded-xl bg-amber-50/60 border border-amber-200">
                <p className="text-[11px] font-bold text-amber-800">
                  {h.kab_kota} — {h.lokasi}
                </p>
                <p className="text-xs text-slate-800 mt-1 leading-relaxed">{h.isi}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel judul="Rincian laporan aktivitas anak">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-600 border-b border-slate-200">
              <tr>
                <th className="text-left font-semibold py-2.5 pr-4 sticky left-0 bg-white">Wilayah / Lokasi</th>
                <th className="text-left font-semibold py-2.5 px-3">Kegiatan</th>
                <th className="text-center font-semibold py-2.5 px-3">Keg.</th>
                <th className="text-center font-semibold py-2.5 px-3">0–5</th>
                <th className="text-center font-semibold py-2.5 px-3">6–12</th>
                <th className="text-center font-semibold py-2.5 px-3">13–17</th>
                <th className="text-center font-semibold py-2.5 px-3">L</th>
                <th className="text-center font-semibold py-2.5 px-3">P</th>
                <th className="text-center font-semibold py-2.5 px-3">Dis.</th>
                <th className="text-center font-semibold py-2.5 px-3">Perlu TL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {daftar.length === 0 ? (
                <TabelKosong kolom={10} pesan="Belum ada laporan aktivitas anak pada filter ini." />
              ) : (
                daftar.map((l) => {
                  const x = l.laporan_anak!;
                  return (
                    <tr key={l.id} className="hover:bg-slate-50 align-top">
                      <td className="py-3 pr-4 sticky left-0 bg-white">
                        <div className="font-semibold text-slate-900">{l.pos_sapa?.wilayah?.kab_kota}</div>
                        <div className="text-xs text-slate-500">{l.pos_sapa?.nama_lokasi}</div>
                        <div className="text-[11px] text-blue-600 font-semibold mt-0.5">{l.periode?.label}</div>
                      </td>
                      <td className="py-3 px-3">
                        {kegiatanTampilAnak(
                          x.kegiatan,
                          x.nama_kegiatan,
                          x.jenis_kegiatan ?? []
                        ).map((k, i) => (
                          <div key={i} className={i > 0 ? "mt-1.5" : undefined}>
                            <div className="font-medium text-slate-800">{k.nama}</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {k.jenis.map((j) => (
                                <Badge key={j} warna="blue">{j}</Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </td>
                      <td className="py-3 px-3 text-center">{x.jumlah_kegiatan}</td>
                      <td className="py-3 px-3 text-center">{x.usia_0_5}</td>
                      <td className="py-3 px-3 text-center">{x.usia_6_12}</td>
                      <td className="py-3 px-3 text-center">{x.usia_13_17}</td>
                      <td className="py-3 px-3 text-center">{x.laki_laki}</td>
                      <td className="py-3 px-3 text-center">{x.perempuan}</td>
                      <td className="py-3 px-3 text-center">{x.disabilitas}</td>
                      <td className="py-3 px-3 text-center">
                        {x.perlu_layanan_lanjutan > 0 ? (
                          <Badge warna="rose">{x.perlu_layanan_lanjutan}</Badge>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
