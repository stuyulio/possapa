"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Informasi akun dan tombol keluar.
 *
 * Dulu blok ini berada di dasar sidebar kiri. Selain posisinya di sudut yang
 * jarang dilihat, tinggi sidebar bergantung pada jumlah menu — pada layar
 * pendek tombol Keluar dapat terdorong ke luar pandangan. Di kanan atas,
 * posisinya tetap dan jaraknya ke kursor lebih dekat, sehingga keluar akun
 * tidak perlu mencari.
 */

function IkonKeluar({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"
      />
    </svg>
  );
}

function useKeluar() {
  const router = useRouter();
  return async function keluar() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };
}

/**
 * Kelas max-width ditulis lengkap, bukan disusun dari variabel: Tailwind
 * membaca berkas sumber sebagai teks, jadi `max-w-${lebar}` tidak akan pernah
 * ikut ter-generate.
 */
const LEBAR = {
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
} as const;

/** Bar akun untuk desktop — melekat di kanan atas area konten. */
export function BarAkun({
  nama,
  peran,
  wilayah,
  lebar = "5xl",
}: {
  nama: string;
  peran: string;
  wilayah?: string | null;
  /** Samakan dengan max-width konten halaman agar sejajar. */
  lebar?: keyof typeof LEBAR;
}) {
  const keluar = useKeluar();

  return (
    <header className="hidden lg:block sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 no-print">
      <div
        className={`w-full ${LEBAR[lebar]} mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-end gap-4`}
      >
        <div className="text-right min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate">
            {nama}
          </p>
          <p className="text-[11px] text-slate-500 truncate">
            {peran}
            {wilayah ? ` · ${wilayah}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={keluar}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-400 transition"
        >
          <IkonKeluar className="w-3.5 h-3.5" />
          Keluar
        </button>
      </div>
    </header>
  );
}

/** Baris akun untuk panel geser di ponsel, karena bar desktop disembunyikan. */
export function AkunRingkas({
  nama,
  peran,
  wilayah,
}: {
  nama: string;
  peran: string;
  wilayah?: string | null;
}) {
  const keluar = useKeluar();

  return (
    <div className="px-3 py-3 border-t border-slate-700/60">
      <p className="text-xs text-slate-300 px-2 truncate font-semibold">{nama}</p>
      <p className="text-[11px] text-slate-500 px-2 truncate">{peran}</p>
      {wilayah && (
        <p className="text-[11px] text-amber-400/90 px-2 truncate">{wilayah}</p>
      )}
      <button
        type="button"
        onClick={keluar}
        className="mt-2 w-full inline-flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
      >
        <IkonKeluar className="w-3.5 h-3.5" />
        Keluar
      </button>
    </div>
  );
}
