"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Wilayah = { id: string; provinsi: string; kab_kota: string };
type Pos = { id: string; nama_lokasi: string; wilayah_id: string };
type Periode = { id: string; label: string };

export function FilterBar({
  wilayah,
  pos,
  periode,
}: {
  wilayah: Wilayah[];
  pos: Pos[];
  periode: Periode[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [memuat, mulai] = useTransition();

  const provinsiTerpilih = searchParams.get("provinsi") ?? "";
  const kabTerpilih = searchParams.get("kabkota") ?? "";

  const daftarProvinsi = [...new Set(wilayah.map((w) => w.provinsi))].sort();

  const daftarKab = [
    ...new Set(
      wilayah
        .filter((w) => !provinsiTerpilih || w.provinsi === provinsiTerpilih)
        .map((w) => w.kab_kota)
    ),
  ].sort();

  const daftarPos = pos.filter((p) => {
    if (!kabTerpilih) return true;
    const w = wilayah.find((x) => x.id === p.wilayah_id);
    return w?.kab_kota === kabTerpilih;
  });

  function ubah(kunci: string, nilai: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nilai) params.set(kunci, nilai);
    else params.delete(kunci);

    // Pilihan turunan direset saat induknya berubah.
    if (kunci === "provinsi") params.delete("kabkota");
    if (kunci === "provinsi" || kunci === "kabkota") params.delete("lokasi");

    mulai(() => router.push(`${pathname}?${params.toString()}`));
  }

  const adaFilter =
    searchParams.has("periode") ||
    searchParams.has("provinsi") ||
    searchParams.has("kabkota") ||
    searchParams.has("lokasi");

  const kelasSelect =
    "w-full text-xs sm:text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 focus:outline-none focus:border-blue-600";

  return (
    <div className="bg-white border-b border-slate-200 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 shrink-0">
            Filter
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 flex-1">
            <select
              aria-label="Periode"
              className={kelasSelect}
              value={searchParams.get("periode") ?? ""}
              onChange={(e) => ubah("periode", e.target.value)}
            >
              <option value="">Semua periode</option>
              {periode.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Provinsi"
              className={kelasSelect}
              value={provinsiTerpilih}
              onChange={(e) => ubah("provinsi", e.target.value)}
            >
              <option value="">Semua provinsi</option>
              {daftarProvinsi.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              aria-label="Kabupaten/Kota"
              className={kelasSelect}
              value={kabTerpilih}
              onChange={(e) => ubah("kabkota", e.target.value)}
            >
              <option value="">Semua kabupaten/kota</option>
              {daftarKab.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>

            <select
              aria-label="Lokasi Pos SAPA"
              className={kelasSelect}
              value={searchParams.get("lokasi") ?? ""}
              onChange={(e) => ubah("lokasi", e.target.value)}
            >
              <option value="">Semua lokasi Pos SAPA</option>
              {daftarPos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama_lokasi}
                </option>
              ))}
            </select>
          </div>

          {adaFilter && (
            <button
              type="button"
              onClick={() => mulai(() => router.push(pathname))}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-xl hover:bg-slate-100 transition shrink-0"
            >
              Reset filter
            </button>
          )}

          {memuat && (
            <span className="text-xs text-slate-400 shrink-0" role="status">
              Memuat…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
