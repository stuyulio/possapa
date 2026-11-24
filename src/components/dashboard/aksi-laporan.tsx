"use client";

import { useSearchParams } from "next/navigation";

export function EksporExcel({ jenis }: { jenis: string }) {
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams.toString());
  params.set("jenis", jenis);

  return (
    <a
      href={`/api/ekspor?${params.toString()}`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
    >
      Ekspor Excel
    </a>
  );
}

export function CetakHalaman() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
    >
      Cetak
    </button>
  );
}
