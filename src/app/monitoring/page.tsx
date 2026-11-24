import Link from "next/link";
import { ambilMatriks, SEMUA_JENIS } from "@/lib/data/kepatuhan";
import { angka } from "@/lib/format";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Panel } from "@/components/dashboard/panel";

export const metadata = { title: "Monitoring Pelaporan — Pos SAPA" };
export const dynamic = "force-dynamic";

const SINGKAT: Record<string, string> = {
  aktivitas_anak: "Anak",
  aktivitas_perempuan: "Perempuan",
  rekap_pengaduan: "Rekap",
  tindak_lanjut_kasus: "Kasus",
  publikasi: "Publikasi",
};

const WARNA_SEL: Record<string, string> = {
  lengkap: "bg-emerald-100 text-emerald-800",
  sebagian: "bg-amber-100 text-amber-800",
  belum: "bg-slate-100 text-slate-500",
  kosong: "bg-white text-rose-300 border border-dashed border-rose-200",
};

export default async function Monitoring({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const periodeId = typeof params.periode === "string" ? params.periode : undefined;

  const m = await ambilMatriks(periodeId);

  const belumMelapor = m.baris.filter((b) => b.jumlahTerkirim === 0);
  const sebagian = m.baris.filter(
    (b) => b.jumlahTerkirim > 0 && b.jumlahTerkirim < SEMUA_JENIS.length
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold text-slate-900">
            Monitoring Pelaporan
          </h2>
          <p className="text-sm text-slate-500">
            {m.periode ? `Periode ${m.periode.label}` : "Belum ada periode"} ·{" "}
            {m.ringkasan.totalPos} Pos SAPA aktif
          </p>
        </div>

        {m.daftarPeriode.length > 1 && (
          <form className="no-print flex items-center gap-2">
            <select
              name="periode"
              defaultValue={m.periode?.id ?? ""}
              className="text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white"
            >
              {m.daftarPeriode.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="text-xs font-semibold bg-slate-900 text-white px-3 py-2 rounded-xl"
            >
              Tampilkan
            </button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Laporan lengkap"
          nilai={`${angka(m.ringkasan.lengkap)}/${angka(m.ringkasan.totalPos)}`}
          keterangan={`${m.ringkasan.persenLengkap}% Pos melapor 5 jenis`}
          aksen="emerald"
        />
        <KpiCard label="Melapor sebagian" nilai={angka(m.ringkasan.sebagian)} aksen="amber" />
        <KpiCard label="Belum melapor" nilai={angka(m.ringkasan.belum)} aksen="rose" />
        <KpiCard label="Periode" nilai={m.periode ? "1" : "0"} keterangan={m.periode?.label ?? "—"} />
      </div>

      <Panel
        judul="Matriks kepatuhan per Pos SAPA"
        keterangan="Hijau: terkirim · Kuning: sebagian · Abu: belum · Garis putus-putus: belum ada sama sekali"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-600 border-b border-slate-200">
              <tr>
                <th className="text-left font-semibold py-2.5 pr-4 sticky left-0 bg-white">
                  Pos SAPA
                </th>
                {SEMUA_JENIS.map((j) => (
                  <th key={j} className="text-center font-semibold py-2.5 px-2 text-xs">
                    {SINGKAT[j]}
                  </th>
                ))}
                <th className="text-center font-semibold py-2.5 px-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {m.baris.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                    Belum ada Pos SAPA aktif. Tambahkan lokasi melalui data master.
                  </td>
                </tr>
              ) : (
                m.baris.map((b) => (
                  <tr key={b.pos_id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-4 sticky left-0 bg-white">
                      <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                        {b.nama_lokasi}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {b.kab_kota}, {b.provinsi}
                      </div>
                    </td>
                    {SEMUA_JENIS.map((j) => (
                      <td key={j} className="py-2.5 px-2 text-center">
                        <span
                          className={`inline-block w-6 h-6 rounded-md text-[10px] font-bold leading-6 ${WARNA_SEL[b.sel[j]]}`}
                          title={b.sel[j]}
                        >
                          {b.sel[j] === "lengkap" ? "✓" : ""}
                        </span>
                      </td>
                    ))}
                    <td className="py-2.5 px-2 text-center font-bold">
                      {b.jumlahTerkirim}/5
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {belumMelapor.length > 0 && (
        <Panel
          judul="Perlu ditindaklanjuti"
          keterangan="Pos SAPA yang belum menyampaikan laporan pada periode ini"
        >
          <ul className="space-y-2">
            {[...belumMelapor, ...sebagian].map((b) => (
              <li
                key={b.pos_id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 ${
                  b.jumlahTerkirim === 0
                    ? "bg-rose-50/60 border-rose-200"
                    : "bg-amber-50/60 border-amber-200"
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {b.nama_lokasi}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    {b.kab_kota} · {b.jumlahTerkirim} dari 5 jenis laporan
                  </p>
                </div>
                <span className="text-[11px] font-bold text-slate-600">
                  {b.jumlahTerkirim === 0 ? "Belum melapor" : "Sebagian"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <p className="text-xs text-slate-500 mt-4">
        Ekspor daftar ini:{" "}
        <Link href="/api/ekspor?jenis=ringkasan" className="text-blue-700 font-semibold hover:underline">
          unduh Excel
        </Link>
      </p>
    </>
  );
}
