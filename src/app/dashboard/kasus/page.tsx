import { ambilLaporan, bacaFilter } from "@/lib/data/laporan";
import { agregatKasus } from "@/lib/data/agregat";
import { angka, persen, tanggalPendek } from "@/lib/format";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { GrafikBatang, WARNA } from "@/components/dashboard/charts";
import { Panel, Badge, TabelKosong } from "@/components/dashboard/panel";
import { EksporExcel, CetakHalaman } from "@/components/dashboard/aksi-laporan";

export const metadata = { title: "Tindak Lanjut Kasus — Pos SAPA" };

const LABEL_STATUS: Record<string, string> = {
  dalam_proses: "Dalam proses",
  dirujuk: "Dirujuk",
  selesai: "Selesai",
};

export default async function HalamanKasus({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const laporan = await ambilLaporan(bacaFilter(await searchParams));
  const k = agregatKasus(laporan);

  return (
    <>
      <div className="flex justify-end gap-2 mb-4 no-print">
        <EksporExcel jenis="kasus" />
        <CetakHalaman />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Jumlah kasus" nilai={angka(k.jumlahKasus)} keterangan={`${angka(k.korban)} korban/pelapor`} aksen="rose" />
        <KpiCard label="Kasus kekerasan" nilai={angka(k.perKategori.kekerasan)} keterangan={`${angka(k.perKategori.non_kekerasan)} non-kekerasan`} />
        <KpiCard label="Kasus selesai" nilai={angka(k.perStatus.selesai)} keterangan={`${persen(k.perStatus.selesai, k.jumlahKasus)}% dari kasus`} aksen="emerald" />
        <KpiCard label="Kasus dirujuk" nilai={angka(k.perStatus.dirujuk)} keterangan={`${persen(k.perStatus.dirujuk, k.jumlahKasus)}% dari kasus`} aksen="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel judul="Status penanganan kasus">
          <GrafikBatang
            data={[
              { nama: "Dalam proses", jumlah: k.perStatus.dalam_proses },
              { nama: "Dirujuk", jumlah: k.perStatus.dirujuk },
              { nama: "Selesai", jumlah: k.perStatus.selesai },
            ]}
            warna={WARNA.emerald}
          />
        </Panel>
        <Panel judul="Kategori kasus">
          <GrafikBatang
            data={[
              { nama: "Kekerasan", jumlah: k.perKategori.kekerasan },
              { nama: "Non-kekerasan", jumlah: k.perKategori.non_kekerasan },
            ]}
            warna={WARNA.rose}
          />
        </Panel>
      </div>

      <Panel
        judul="Rincian tindak lanjut kasus"
        keterangan="Ditampilkan dengan kode kasus — tanpa identitas korban"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-600 border-b border-slate-200">
              <tr>
                <th className="text-left font-semibold py-2.5 pr-4 sticky left-0 bg-white">Kode · Tanggal</th>
                <th className="text-left font-semibold py-2.5 px-3">Kategori / Jenis</th>
                <th className="text-left font-semibold py-2.5 px-3">Korban</th>
                <th className="text-center font-semibold py-2.5 px-3">Status</th>
                <th className="text-left font-semibold py-2.5 px-3">Kebutuhan / Tindak lanjut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {k.rincian.length === 0 ? (
                <TabelKosong kolom={5} pesan="Belum ada kasus pada filter ini." />
              ) : (
                k.rincian.map((x) => (
                  <tr key={x.laporan_id} className="hover:bg-slate-50 align-top">
                    <td className="py-3 pr-4 sticky left-0 bg-white">
                      <span className="inline-block bg-slate-900 text-amber-400 font-mono font-bold text-xs px-2 py-1 rounded-lg">
                        {x.kode_kasus}
                      </span>
                      <div className="text-xs text-slate-600 mt-1">{tanggalPendek(x.tanggal_aduan)}</div>
                      <div className="text-[11px] text-slate-500">{x.kab_kota}</div>
                    </td>
                    <td className="py-3 px-3">
                      <Badge warna={x.kategori === "kekerasan" ? "rose" : "blue"}>
                        {x.kategori === "kekerasan" ? "Kekerasan" : "Non-kekerasan"}
                      </Badge>
                      <div className="text-xs font-medium text-slate-800 mt-1">{x.jenis_kasus ?? "—"}</div>
                    </td>
                    <td className="py-3 px-3 text-xs space-y-0.5">
                      <div><strong>{x.jumlah_korban}</strong> orang</div>
                      <div className="text-slate-600">{x.jenis_kelamin ?? "—"}</div>
                      <div className="text-slate-600">{x.kelompok_usia ?? "—"}</div>
                      <div className="text-slate-600">Disabilitas: {x.disabilitas ? "Ya" : "Tidak"}</div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge
                        warna={
                          x.status_penanganan === "selesai"
                            ? "emerald"
                            : x.status_penanganan === "dirujuk"
                            ? "blue"
                            : "amber"
                        }
                      >
                        {LABEL_STATUS[x.status_penanganan]}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-700 max-w-sm space-y-1">
                      <div><span className="font-bold">Kebutuhan:</span> {x.kebutuhan_korban ?? "—"}</div>
                      <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                        <span className="font-bold text-blue-800">Tindak lanjut:</span> {x.tindak_lanjut ?? "—"}
                      </div>
                      {x.hambatan && (
                        <div className="text-slate-500"><span className="font-bold">Hambatan:</span> {x.hambatan}</div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
