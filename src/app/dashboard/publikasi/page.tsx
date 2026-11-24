import { ambilLaporan, bacaFilter } from "@/lib/data/laporan";
import { agregatPublikasi, kelengkapanDokumentasi } from "@/lib/data/agregat";
import { angka, tanggalPendek } from "@/lib/format";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { GrafikDonat } from "@/components/dashboard/charts";
import { Panel, Badge } from "@/components/dashboard/panel";
import { GrafikBatang } from "@/components/dashboard/charts";
import { EksporExcel, CetakHalaman } from "@/components/dashboard/aksi-laporan";

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
              <article
                key={x.laporan_id}
                className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge warna="slate">{x.platform}</Badge>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {tanggalPendek(x.tanggal_publikasi)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm leading-snug">
                    {x.kegiatan ?? "—"}
                  </h3>
                  <div className="text-xs text-slate-600 mt-2 space-y-0.5">
                    <div><strong>Akun:</strong> {x.nama_akun ?? "—"}</div>
                    <div>{x.kab_kota} — {x.lokasi}</div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400 truncate max-w-[45%]">
                    {x.file_publikasi ?? "Tautan eksternal"}
                  </span>
                  <a
                    href={x.link_publikasi}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
                  >
                    Buka tautan
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
