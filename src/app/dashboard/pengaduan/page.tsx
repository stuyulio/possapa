import { ambilLaporan, bacaFilter } from "@/lib/data/laporan";
import { agregatPengaduan } from "@/lib/data/agregat";
import { angka, persen } from "@/lib/format";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { GrafikBatang, WARNA } from "@/components/dashboard/charts";
import { Panel, Badge, TabelKosong } from "@/components/dashboard/panel";
import { EksporExcel, CetakHalaman } from "@/components/dashboard/aksi-laporan";

export const metadata = { title: "Layanan Pengaduan — Pos SAPA" };

export default async function HalamanPengaduan({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const laporan = await ambilLaporan(bacaFilter(await searchParams));
  const d = agregatPengaduan(laporan);

  const dataKategori = [
    { nama: "Kekerasan perempuan", jumlah: d.kekPerempuan },
    { nama: "Kekerasan anak", jumlah: d.kekAnak },
    { nama: "Non-kekerasan perempuan", jumlah: d.nonKekPerempuan },
    { nama: "Non-kekerasan anak", jumlah: d.nonKekAnak },
  ];

  return (
    <>
      <div className="flex justify-end gap-2 mb-4 no-print">
        <EksporExcel jenis="pengaduan" />
        <CetakHalaman />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Aduan diterima" nilai={angka(d.aduanMasuk)} keterangan={`${d.laporanAdaAduan} laporan berisi aduan`} aksen="amber" />
        <KpiCard label="Sudah ditindaklanjuti" nilai={angka(d.ditindaklanjuti)} keterangan={`${persen(d.ditindaklanjuti, d.aduanMasuk)}% dari aduan`} aksen="emerald" />
        <KpiCard label="Tercatat SIMFONI PPA" nilai={angka(d.simfoni)} keterangan={`${persen(d.simfoni, d.aduanMasuk)}% dari aduan`} aksen="blue" />
        <KpiCard label="Laporan nihil aduan" nilai={angka(d.laporanNihil)} keterangan={`dari ${d.jumlahLaporan} laporan rekap`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel judul="Komposisi aduan berdasarkan kategori">
          <GrafikBatang data={dataKategori} warna={WARNA.rose} horizontal />
        </Panel>
        <Panel judul="Rasio tindak lanjut" keterangan="Perbandingan aduan masuk, ditindaklanjuti, dan tercatat SIMFONI">
          <GrafikBatang
            data={[
              { nama: "Aduan masuk", jumlah: d.aduanMasuk },
              { nama: "Ditindaklanjuti", jumlah: d.ditindaklanjuti },
              { nama: "SIMFONI PPA", jumlah: d.simfoni },
            ]}
            warna={WARNA.amber}
          />
        </Panel>
      </div>

      <Panel judul="Rekapitulasi layanan pengaduan bulanan">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-600 border-b border-slate-200">
              <tr>
                <th className="text-left font-semibold py-2.5 pr-4 sticky left-0 bg-white">Wilayah / Lokasi</th>
                <th className="text-center font-semibold py-2.5 px-2">Status</th>
                <th className="text-center font-semibold py-2.5 px-2">Masuk</th>
                <th className="text-center font-semibold py-2.5 px-2">Kek. Pr</th>
                <th className="text-center font-semibold py-2.5 px-2">Kek. Anak</th>
                <th className="text-center font-semibold py-2.5 px-2">NonKek Pr</th>
                <th className="text-center font-semibold py-2.5 px-2">NonKek Anak</th>
                <th className="text-center font-semibold py-2.5 px-2">TL</th>
                <th className="text-center font-semibold py-2.5 px-2">SIMFONI</th>
                <th className="text-left font-semibold py-2.5 px-3">Pihak terlibat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.rincian.length === 0 ? (
                <TabelKosong kolom={10} pesan="Belum ada laporan rekapitulasi pengaduan pada filter ini." />
              ) : (
                d.rincian.map((r) => (
                  <tr key={r.laporan_id} className="hover:bg-slate-50 align-top">
                    <td className="py-3 pr-4 sticky left-0 bg-white">
                      <div className="font-semibold text-slate-900">{r.kab_kota}</div>
                      <div className="text-xs text-slate-500">{r.lokasi}</div>
                      <div className="text-[11px] text-amber-700 font-semibold mt-0.5">{r.periode}</div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <Badge warna={r.status_bulan === "Nihil" ? "slate" : "rose"}>
                        {r.status_bulan}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-center font-bold">{r.aduan_masuk}</td>
                    <td className="py-3 px-2 text-center">{r.kekerasan_perempuan}</td>
                    <td className="py-3 px-2 text-center">{r.kekerasan_anak}</td>
                    <td className="py-3 px-2 text-center">{r.non_kekerasan_perempuan}</td>
                    <td className="py-3 px-2 text-center">{r.non_kekerasan_anak}</td>
                    <td className="py-3 px-2 text-center">{r.sudah_ditindaklanjuti}</td>
                    <td className="py-3 px-2 text-center">{r.tercatat_simfoni}</td>
                    <td className="py-3 px-3 text-xs text-slate-700">{r.pihak_terlibat ?? "—"}</td>
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
