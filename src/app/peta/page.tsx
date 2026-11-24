import Link from "next/link";
import { ambilPeta } from "@/lib/data/peta";
import { PetaDimuat } from "@/components/peta/peta-dimuat";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Panel } from "@/components/dashboard/panel";

export const metadata = { title: "Peta Sebaran — Pos SAPA" };
export const dynamic = "force-dynamic";

export default async function HalamanPeta({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const periodeId = typeof params.periode === "string" ? params.periode : undefined;

  const p = await ambilPeta(periodeId);

  return (
    <>
      <div className="mb-5">
        <h2 className="font-display text-xl font-extrabold text-slate-900">
          Peta Sebaran Pos SAPA
        </h2>
        <p className="text-sm text-slate-500">
          {p.periode ? `Periode ${p.periode.label}` : "Belum ada periode"} ·{" "}
          {p.ringkasan.total} lokasi terdaftar
        </p>
      </div>

      {p.daftarPeriode.length > 1 && (
        <form className="mb-4 no-print flex items-center gap-2">
          <label htmlFor="periode" className="text-xs font-semibold text-slate-600">
            Periode
          </label>
          <select
            id="periode"
            name="periode"
            defaultValue={p.periode?.id ?? ""}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
          >
            {p.daftarPeriode.map((pr) => (
              <option key={pr.id} value={pr.id}>
                {pr.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
          >
            Tampilkan
          </button>
        </form>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard
          label="Melapor lengkap"
          nilai={String(p.ringkasan.lengkap)}
          keterangan="5 dari 5 jenis"
        />
        <KpiCard
          label="Melapor sebagian"
          nilai={String(p.ringkasan.sebagian)}
          keterangan="1–4 jenis"
        />
        <KpiCard
          label="Belum melapor"
          nilai={String(p.ringkasan.belum)}
          keterangan="0 jenis"
        />
        <KpiCard
          label="Tanpa koordinat"
          nilai={String(p.ringkasan.tanpaKoordinat)}
          keterangan="tidak tampil di peta"
        />
      </div>

      <PetaDimuat titik={p.titik} periodeLabel={p.periode?.label ?? null} />

      <div className="mt-5">
      <Panel judul="Keterangan">
        <ul className="text-sm text-slate-700 space-y-1.5">
          <li>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-600 mr-2 align-middle" />
            <strong>Hijau</strong> — melapor lengkap (5 jenis) pada periode aktif.
          </li>
          <li>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 mr-2 align-middle" />
            <strong>Amber</strong> — melapor sebagian (1–4 jenis).
          </li>
          <li>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-600 mr-2 align-middle" />
            <strong>Merah</strong> — belum melapor pada periode aktif.
          </li>
          <li>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-400 mr-2 align-middle" />
            <strong>Abu-abu</strong> — koordinat belum diisi, tidak tampil di peta.
          </li>
        </ul>
        <p className="text-xs text-slate-500 mt-3">
          Klik titik untuk melihat ringkasan lokasi. Data lokasi dapat diubah di{" "}
          <Link href="/admin/wilayah" className="text-blue-700 hover:underline">
            Admin → Wilayah &amp; Lokasi
          </Link>
          .
        </p>
      </Panel>
      </div>
    </>
  );
}
