import { ambilLaporan, bacaFilter } from "@/lib/data/laporan";
import {
  agregatAnak,
  agregatPerempuan,
  agregatPengaduan,
  agregatKasus,
  agregatPublikasi,
  kelengkapanDokumentasi,
} from "@/lib/data/agregat";
import { angka, persen } from "@/lib/format";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { GrafikBatang, GrafikDonat } from "@/components/dashboard/charts";
import { Panel, Badge, TabelKosong } from "@/components/dashboard/panel";
import { EksporExcel, CetakHalaman } from "@/components/dashboard/aksi-laporan";

export default async function Ringkasan({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filter = bacaFilter(await searchParams);
  const laporan = await ambilLaporan(filter);

  const anak = agregatAnak(laporan);
  const perempuan = agregatPerempuan(laporan);
  const pengaduan = agregatPengaduan(laporan);
  const kasus = agregatKasus(laporan);
  const publikasi = agregatPublikasi(laporan);
  const dok = kelengkapanDokumentasi(laporan);

  const hitungWilayah = new Map<string, number>();
  for (const l of laporan) {
    const nama = l.pos_sapa?.wilayah?.kab_kota;
    if (!nama) continue;
    hitungWilayah.set(nama, (hitungWilayah.get(nama) ?? 0) + 1);
  }
  const grafikWilayah = [...hitungWilayah.entries()]
    .map(([nama, jumlah]) => ({ nama, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah);

  const komposisi = [
    { nama: "Aktivitas Anak", jumlah: laporan.filter((l) => l.laporan_anak).length },
    { nama: "Aktivitas Perempuan", jumlah: laporan.filter((l) => l.laporan_perempuan).length },
    { nama: "Rekap Pengaduan", jumlah: laporan.filter((l) => l.laporan_rekap_pengaduan).length },
    { nama: "Tindak Lanjut Kasus", jumlah: laporan.filter((l) => l.laporan_kasus).length },
    { nama: "Publikasi", jumlah: laporan.filter((l) => l.laporan_publikasi).length },
  ];

  const sorotan = [
    ...anak.temuan.map((t) => ({
      jenis: "anak" as const,
      judul: `${t.kab_kota} — ${t.lokasi}`,
      isi: t.temuan,
      tindakan: `Perlu layanan lanjutan: ${t.perlu} anak`,
    })),
    ...kasus.rincian
      .filter((k) => k.status_penanganan !== "selesai")
      .map((k) => ({
        jenis: "kasus" as const,
        judul: `${k.kode_kasus} — ${k.jenis_kasus ?? "—"}`,
        isi: `Korban: ${k.jumlah_korban} orang · ${k.kab_kota}`,
        tindakan:
          k.status_penanganan === "dalam_proses"
            ? "Dalam proses penanganan"
            : "Sudah dirujuk",
      })),
  ];

  return (
    <>
      <div className="flex justify-end gap-2 mb-4 no-print">
        <EksporExcel jenis="ringkasan" />
        <CetakHalaman />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Anak penerima manfaat"
          nilai={angka(anak.totalAnak)}
          keterangan={`${angka(anak.disabilitas)} penyandang disabilitas`}
          aksen="blue"
        />
        <KpiCard
          label="Perempuan penerima manfaat"
          nilai={angka(perempuan.totalIkut)}
          keterangan={`${angka(perempuan.kepalaKeluarga)} kepala keluarga`}
          aksen="rose"
        />
        <KpiCard
          label="Pengaduan diterima"
          nilai={angka(pengaduan.aduanMasuk)}
          keterangan={`${persen(pengaduan.ditindaklanjuti, pengaduan.aduanMasuk)}% ditindaklanjuti`}
          aksen="amber"
        />
        <KpiCard
          label="Tercatat SIMFONI PPA"
          nilai={`${persen(pengaduan.simfoni, pengaduan.aduanMasuk)}%`}
          keterangan={`${angka(pengaduan.simfoni)} dari ${angka(pengaduan.aduanMasuk)} aduan`}
          aksen="emerald"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total laporan masuk" nilai={angka(laporan.length)} aksen="slate" />
        <KpiCard label="Kasus ditangani" nilai={angka(kasus.jumlahKasus)} keterangan={`${angka(kasus.korban)} korban`} aksen="rose" />
        <KpiCard label="Publikasi kegiatan" nilai={angka(publikasi.jumlahPublikasi)} aksen="emerald" />
        <KpiCard label="Kelengkapan dokumentasi" nilai={`${dok.persen}%`} keterangan={`${angka(dok.ada)} dari ${angka(dok.total)} laporan`} aksen="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel judul="Laporan masuk per kabupaten/kota" keterangan="Berdasarkan filter aktif">
          <GrafikBatang data={grafikWilayah.slice(0, 10)} satuan="laporan" horizontal />
        </Panel>

        <Panel judul="Komposisi jenis laporan">
          <GrafikDonat data={komposisi} />
        </Panel>
      </div>

      <Panel
        judul="Sorotan prioritas"
        keterangan="Temuan anak yang memerlukan tindak lanjut dan kasus yang belum selesai"
      >
        {sorotan.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            Tidak ada temuan mendesak atau kasus tertunda pada filter ini.
          </div>
        ) : (
          <ul className="space-y-3">
            {sorotan.slice(0, 20).map((s, i) => (
              <li
                key={i}
                className={`p-3.5 rounded-xl border ${
                  s.jenis === "anak"
                    ? "bg-blue-50/50 border-blue-200"
                    : "bg-rose-50/50 border-rose-200"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge warna={s.jenis === "anak" ? "blue" : "rose"}>
                    {s.jenis === "anak" ? "Temuan anak" : "Kasus aktif"}
                  </Badge>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {s.judul}
                  </span>
                </div>
                <p className="text-xs text-slate-800 leading-relaxed">{s.isi}</p>
                <p className="text-[11px] font-semibold text-slate-600 mt-1">
                  {s.tindakan}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel judul="Rekapitulasi per wilayah" keterangan={`${grafikWilayah.length} kabupaten/kota pada filter ini`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-600 border-b border-slate-200">
              <tr>
                <th className="text-left font-semibold py-2.5 pr-4">Kabupaten/Kota</th>
                <th className="text-right font-semibold py-2.5 px-3">Laporan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grafikWilayah.length === 0 ? (
                <TabelKosong kolom={2} pesan="Belum ada laporan pada filter ini." />
              ) : (
                grafikWilayah.map((w) => (
                  <tr key={w.nama} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-4 font-semibold text-slate-900">{w.nama}</td>
                    <td className="py-2.5 px-3 text-right">{angka(w.jumlah)}</td>
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
