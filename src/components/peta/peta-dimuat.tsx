"use client";

import dynamic from "next/dynamic";
import type { TitikPeta } from "@/lib/data/peta";

/**
 * Leaflet menyentuh `window` saat modul dimuat, jadi peta harus dirender
 * hanya di klien. Berkas ini tipis dan hanya berisi pemuatan dinamis.
 */
const PetaSebaran = dynamic(
  () => import("./peta-sebaran").then((m) => m.PetaSebaran),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 h-[520px] flex items-center justify-center">
        <p className="text-sm text-slate-500">Memuat peta…</p>
      </div>
    ),
  }
);

export function PetaDimuat(props: {
  titik: TitikPeta[];
  periodeLabel: string | null;
}) {
  return <PetaSebaran {...props} />;
}
