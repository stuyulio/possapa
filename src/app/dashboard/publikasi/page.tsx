import { ambilLaporan, bacaFilter } from "@/lib/data/laporan";
import { agregatPublikasi, kelengkapanDokumentasi } from "@/lib/data/agregat";
import { angka } from "@/lib/format";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { GrafikDonat } from "@/components/dashboard/charts";
import { Panel } from "@/components/dashboard/panel";
import { GrafikBatang } from "@/components/dashboard/charts";
import { EksporExcel, CetakHalaman } from "@/components/dashboard/aksi-laporan";
import { KartuPublikasi } from "@/components/dashboard/pratinjau-publikasi";

export const metadata = { title: "Publikasi — Pos SAPA" };

export default async function HalamanPublikasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const laporan = await ambilLaporan(bacaFilter(await searchParams));
  const p = agregatPublikasi(laporan);
  const dok = kelengkapanDokumentasi(laporan);

  return (
    <>
      <div className="flex justify-end gap-2 mb-4 no-print">
        <EksporExcel jenis="publikasi" />
        <CetakHalaman />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total publikasi" nilai={angka(p.jumlahPublikasi)} aksen="emerald" />
        <KpiCard label="Akun/instansi publikasi" nilai={angka(p.akunTerbanyak.length)} keterangan="akun berbeda" />
        <KpiCard label="Kelengkapan dokumentasi" nilai={`${dok.persen}%`} keterangan={`${angka(dok.ada)} dari ${angka(dok.total)} laporan`} aksen="amber" />
        <KpiCard label="Platform aktif" nilai={angka(p.platform.filter((x) => x.jumlah > 0).length)} keterangan="dari 6 platform" aksen="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel judul="Sebaran platform publikasi">
          <GrafikDonat data={p.platform.filter((x) => x.jumlah > 0)} satuan="publikasi" />
        </Panel>
        <Panel judul="Akun paling produktif" keterangan="Berdasarkan jumlah publikasi">
          <GrafikBatang
            data={p.akunTerbanyak.map((a) => ({ nama: a.nama, jumlah: a.jumlah }))}
            satuan="publikasi"
            horizontal
          />
        </Panel>
      </div>

      <Panel judul="Galeri publikasi kegiatan" keterangan={`${p.daftar.length} publikasi`}>
        {p.daftar.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Belum ada publikasi pada filter ini.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {p.daftar.map((x) => (
              <KartuPublikasi key={x.laporan_id} publikasi={x} />
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
