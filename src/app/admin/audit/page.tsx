import Link from "next/link";
import {
  ambilLogAudit,
  LABEL_ENTITAS,
  type BarisAudit,
  type Perubahan,
} from "@/lib/data/audit";
import { waktuPanjang } from "@/lib/format";
import { Panel, Badge } from "@/components/dashboard/panel";

export const metadata = { title: "Log Audit — Pos SAPA" };
export const dynamic = "force-dynamic";

const AKSI: Record<string, { label: string; warna: "emerald" | "amber" | "rose" }> = {
  tambah: { label: "Tambah", warna: "emerald" },
  ubah: { label: "Ubah", warna: "amber" },
  hapus: { label: "Hapus", warna: "rose" },
};

/** "jenis_laporan" -> "Jenis laporan" */
function namaKolom(k: string): string {
  const teks = k.replace(/_/g, " ");
  return teks.charAt(0).toUpperCase() + teks.slice(1);
}

function nilai(v: unknown): string {
  if (v === null || v === undefined) return "kosong";
  if (typeof v === "boolean") return v ? "ya" : "tidak";
  if (typeof v === "object") {
    const s = JSON.stringify(v);
    return s.length > 120 ? `${s.slice(0, 117)}…` : s;
  }
  const s = String(v);
  return s === "" ? "kosong" : s;
}

/** Baris "kolom: sebelum → sesudah" dari objek perubahan jsonb. */
function RincianPerubahan({ perubahan }: { perubahan: Perubahan | null }) {
  if (!perubahan) return <span className="text-slate-400">—</span>;

  const sebelum = perubahan.sebelum ?? {};
  const sesudah = perubahan.sesudah ?? {};
  const kolom = [...new Set([...Object.keys(sebelum), ...Object.keys(sesudah)])];

  if (kolom.length === 0) return <span className="text-slate-400">—</span>;

  return (
    <ul className="space-y-1">
      {kolom.map((k) => (
        <li key={k} className="text-[11px] leading-snug">
          <span className="font-semibold text-slate-700">{namaKolom(k)}</span>
          {": "}
          {k in sebelum && (
            <>
              <span className="text-slate-500 line-through decoration-slate-300">
                {nilai(sebelum[k])}
              </span>
              {" → "}
            </>
          )}
          <span className="text-slate-900">{nilai(sesudah[k])}</span>
        </li>
      ))}
    </ul>
  );
}

function Baris({ b }: { b: BarisAudit }) {
  const aksi = AKSI[b.aksi] ?? { label: b.aksi, warna: "slate" as const };

  return (
    <tr className="align-top">
      <td className="px-4 py-3 text-[11px] text-slate-600 whitespace-nowrap">
        {waktuPanjang(b.waktu) ?? b.waktu}
      </td>
      <td className="px-4 py-3 text-xs">
        {b.aktor ?? (
          <span
            className="text-slate-500 italic"
            title="Perubahan dari luar aplikasi: impor, SQL Editor, atau skrip migrasi"
          >
            di luar aplikasi
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge warna={aksi.warna}>{aksi.label}</Badge>
      </td>
      <td className="px-4 py-3 text-xs">
        <div className="font-semibold text-slate-800">
          {LABEL_ENTITAS[b.entitas] ?? b.entitas}
        </div>
        <div className="text-[11px] text-slate-500">
          {b.label ?? <code className="text-[10px]">{b.entitas_id}</code>}
        </div>
      </td>
      <td className="px-4 py-3 max-w-md">
        <RincianPerubahan perubahan={b.perubahan} />
      </td>
    </tr>
  );
}

export default async function LogAudit({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const satu = (v: string | string[] | undefined) =>
    typeof v === "string" && v !== "" ? v : undefined;

  const entitas = satu(params.entitas);
  const aksi = satu(params.aksi);
  const cari = satu(params.cari);

  const log = await ambilLogAudit({ entitas, aksi, cari });

  if (log.galat) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-6 max-w-lg">
        <h1 className="font-display font-bold text-slate-900">Akses terbatas</h1>
        <p className="text-sm text-slate-600 mt-2">{log.galat}</p>
        <Link
          href="/dashboard"
          className="inline-block mt-4 text-sm font-semibold text-blue-700 hover:underline"
        >
          ← Kembali ke dashboard
        </Link>
      </div>
    );
  }

  const adaFilter = Boolean(entitas || aksi || cari);

  return (
    <>
      <div className="mb-5">
        <h2 className="font-display text-xl font-extrabold text-slate-900">
          Log Audit
        </h2>
        <p className="text-sm text-slate-500">
          {adaFilter
            ? `${log.ringkasan.total} catatan cocok dengan filter`
            : `${log.ringkasan.total} catatan terbaru`}{" "}
          · dicatat otomatis oleh database
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kotak label="Ditampilkan" nilai={log.ringkasan.total} />
        <Kotak label="Penambahan" nilai={log.ringkasan.tambah} aksen="emerald" />
        <Kotak label="Perubahan" nilai={log.ringkasan.ubah} aksen="amber" />
        <Kotak label="Penghapusan" nilai={log.ringkasan.hapus} aksen="rose" />
      </div>

      <form className="no-print flex flex-wrap items-end gap-2 mb-4">
        <label className="text-xs">
          <span className="block font-semibold text-slate-600 mb-1">Entitas</span>
          <select
            name="entitas"
            defaultValue={entitas ?? "ALL"}
            className="text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white"
          >
            <option value="ALL">Semua entitas</option>
            {log.daftarEntitas.map((e) => (
              <option key={e} value={e}>
                {LABEL_ENTITAS[e] ?? e}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className="block font-semibold text-slate-600 mb-1">Aksi</span>
          <select
            name="aksi"
            defaultValue={aksi ?? "ALL"}
            className="text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white"
          >
            <option value="ALL">Semua aksi</option>
            <option value="tambah">Tambah</option>
            <option value="ubah">Ubah</option>
            <option value="hapus">Hapus</option>
          </select>
        </label>

        <label className="text-xs">
          <span className="block font-semibold text-slate-600 mb-1">
            Cari ID entitas
          </span>
          <input
            type="search"
            name="cari"
            defaultValue={cari ?? ""}
            placeholder="tempel UUID…"
            className="text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white w-56"
          />
        </label>

        <button
          type="submit"
          className="text-xs font-semibold bg-slate-900 text-white px-3.5 py-2 rounded-xl"
        >
          Tampilkan
        </button>

        {adaFilter && (
          <Link
            href="/admin/audit"
            className="text-xs font-semibold text-slate-600 hover:underline px-2 py-2"
          >
            Bersihkan
          </Link>
        )}
      </form>

      <Panel
        judul="Riwayat perubahan"
        keterangan={`Menampilkan ${log.ringkasan.total} dari maksimum ${log.batas} catatan terbaru. Nilai teks dipotong 200 karakter saat disimpan.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left font-semibold px-4 py-2.5">Waktu</th>
                <th className="text-left font-semibold px-4 py-2.5">Aktor</th>
                <th className="text-left font-semibold px-4 py-2.5">Aksi</th>
                <th className="text-left font-semibold px-4 py-2.5">Data</th>
                <th className="text-left font-semibold px-4 py-2.5">Perubahan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {log.baris.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                    {adaFilter
                      ? "Tidak ada catatan yang cocok dengan filter."
                      : "Belum ada catatan audit."}
                  </td>
                </tr>
              ) : (
                log.baris.map((b) => <Baris key={b.id} b={b} />)
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <p className="text-xs text-slate-500 mt-2">
        Catatan ditulis oleh trigger database, termasuk untuk perubahan yang
        dilakukan langsung lewat SQL Editor. Baris tanpa aktor berarti perubahan
        datang dari luar aplikasi.
      </p>
    </>
  );
}

function Kotak({
  label,
  nilai: angkaNilai,
  aksen = "slate",
}: {
  label: string;
  nilai: number;
  aksen?: "slate" | "amber" | "emerald" | "rose";
}) {
  const warna = {
    slate: "border-slate-200 bg-white",
    amber: "border-amber-200 bg-amber-50/60",
    emerald: "border-emerald-200 bg-emerald-50/60",
    rose: "border-rose-200 bg-rose-50/60",
  }[aksen];

  return (
    <div className={`rounded-2xl border p-4 ${warna}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </p>
      <p className="font-display text-2xl font-extrabold text-slate-900 mt-1">
        {angkaNilai}
      </p>
    </div>
  );
}
