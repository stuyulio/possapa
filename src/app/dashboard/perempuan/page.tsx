import { ambilLaporan, bacaFilter } from "@/lib/data/laporan";
import { agregatPerempuan } from "@/lib/data/agregat";
import { angka, persen } from "@/lib/format";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { GrafikBatang, WARNA } from "@/components/dashboard/charts";
import { Panel, TabelKosong } from "@/components/dashboard/panel";
import { EksporExcel, CetakHalaman } from "@/components/dashboard/aksi-laporan";
import { kegiatanTampilPerempuan } from "@/lib/kegiatan";

export const metadata = { title: "Aktivitas Perempuan — Pos SAPA" };

export default async function HalamanPerempuan({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const laporan = await ambilLaporan(bacaFilter(await searchParams));
  const p = agregatPerempuan(laporan);

  const dataRentan = [
    { nama: "Kepala keluarga", jumlah: p.kepalaKeluarga },
    { nama: "Hamil", jumlah: p.hamil },
    { nama: "Menyusui", jumlah: p.menyusui },
    { nama: "Lansia", jumlah: p.lansia },
    { nama: "Disabilitas", jumlah: p.disabilitas },
  ];

  const daftar = laporan.filter((l) => l.laporan_perempuan);

  return (
    <>
      <div className="flex justify-end gap-2 mb-4 no-print">
        <EksporExcel jenis="perempuan" />
        <CetakHalaman />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total perempuan penerima manfaat" nilai={angka(p.totalIkut)} aksen="rose" />
        <KpiCard label="Total kegiatan" nilai={angka(p.totalKegiatan)} keterangan={`${p.jumlahLaporan} laporan`} />
        <KpiCard label="Perempuan kepala keluarga" nilai={angka(p.kepalaKeluarga)} keterangan={`${persen(p.kepalaKeluarga, p.totalIkut)}% dari total`} aksen="amber" />
        <KpiCard label="Perempuan disabilitas" nilai={angka(p.disabilitas)} keterangan={`${persen(p.disabilitas, p.totalIkut)}% dari total`} aksen="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel judul="Komposisi kelompok sasaran" keterangan="Jumlah peserta pada masing-masing kelompok">
          <GrafikBatang data={dataRentan} warna={WARNA.rose} />
        </Panel>
        <Panel judul="Jenis kegiatan terbanyak" keterangan="Berdasarkan jumlah laporan">
          <GrafikBatang
            data={p.jenisTerbanyak}
            satuan="laporan"
            warna={WARNA.indigo}
            horizontal
          />
        </Panel>
      </div>

      <Panel
        judul="Sebaran laporan per kabupaten/kota"
        keterangan={`${p.perWilayah.length} wilayah`}
      >
        <GrafikBatang
          data={p.perWilayah.map((w) => ({ nama: w.kab_kota, jumlah: w.jumlah }))}
          satuan="laporan"
          horizontal
        />
      </Panel>

      <Panel judul="Rincian laporan aktivitas perempuan">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-600 border-b border-slate-200">
              <tr>
                <th className="text-left font-semibold py-2.5 pr-4 sticky left-0 bg-white">Wilayah / Lokasi</th>
                <th className="text-left font-semibold py-2.5 px-3">Kegiatan</th>
                <th className="text-center font-semibold py-2.5 px-3">Total</th>
                <th className="text-center font-semibold py-2.5 px-3">KK</th>
                <th className="text-center font-semibold py-2.5 px-3">Hamil</th>
                <th className="text-center font-semibold py-2.5 px-3">Menyusui</th>
                <th className="text-center font-semibold py-2.5 px-3">Lansia</th>
                <th className="text-center font-semibold py-2.5 px-3">Dis.</th>
                <th className="text-left font-semibold py-2.5 px-3">Manfaat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {daftar.length === 0 ? (
                <TabelKosong kolom={9} pesan="Belum ada laporan aktivitas perempuan pada filter ini." />
              ) : (
                daftar.map((l) => {
                  const x = l.laporan_perempuan!;
                  return (
                    <tr key={l.id} className="hover:bg-slate-50 align-top">
                      <td className="py-3 pr-4 sticky left-0 bg-white">
                        <div className="font-semibold text-slate-900">{l.pos_sapa?.wilayah?.kab_kota}</div>
                        <div className="text-xs text-slate-500">{l.pos_sapa?.nama_lokasi}</div>
                        <div className="text-[11px] text-rose-600 font-semibold mt-0.5">{l.periode?.label}</div>
                      </td>
                      <td className="py-3 px-3">
                        {kegiatanTampilPerempuan(
                          x.kegiatan,
                          x.nama_kegiatan,
                          x.jenis_kegiatan
                        ).map((k, i) => (
                          <div key={i} className={i > 0 ? "mt-1" : undefined}>
                            <div className="font-medium text-slate-800">{k.nama}</div>
                            {k.jenis && (
                              <div className="text-xs text-slate-500">{k.jenis}</div>
                            )}
                          </div>
                        ))}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-rose-700">{x.total_ikut}</td>
                      <td className="py-3 px-3 text-center">{x.kepala_keluarga}</td>
                      <td className="py-3 px-3 text-center">{x.hamil}</td>
                      <td className="py-3 px-3 text-center">{x.menyusui}</td>
                      <td className="py-3 px-3 text-center">{x.lansia}</td>
                      <td className="py-3 px-3 text-center">{x.disabilitas}</td>
                      <td className="py-3 px-3 text-xs text-slate-700 max-w-xs">{x.manfaat ?? "—"}</td>
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
