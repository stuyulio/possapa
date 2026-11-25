import Link from "next/link";
import { LogoKemenPPPA } from "@/components/brand/logo";
import { NAV } from "./konvensi";

/**
 * Header landing publik — server component, tanpa JS.
 *
 * Hanya muncul di `/`; halaman internal memakai `KerangkaInternal` dengan
 * navigasinya sendiri. Tautan bagian memakai `<a>` biasa agar gulir sehalaman
 * ditangani browser (lompat instan, fokus pindah ke target).
 *
 * Di bawah 1000px navigasi turun ke baris kedua dan bergulir horizontal,
 * meniru perilaku referensi.
 */
export function HeaderPublik() {
  return (
    <header className="publik-header sticky top-0 z-50 border-b border-slate-200 bg-white/92 backdrop-blur">
      <div className="publik-wrap flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 lg:flex-nowrap">
        <a
          href="#atas"
          className="flex shrink-0 items-center gap-2.5"
          aria-label="Pos SAPA — kembali ke atas"
        >
          <LogoKemenPPPA className="h-9 w-9 shrink-0" />
          <span className="min-w-0">
            <span className="block font-display text-base font-extrabold leading-tight text-slate-900">
              Pos SAPA
            </span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500 sm:block">
              Sahabat Perempuan dan Anak
            </span>
          </span>
        </a>

        <nav
          aria-label="Bagian halaman"
          className="order-3 -mx-1 w-full basis-full overflow-x-auto border-t border-slate-100 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:order-none lg:mx-0 lg:w-auto lg:flex-1 lg:basis-auto lg:justify-center lg:border-0 lg:pt-0"
        >
          <ul className="flex items-center gap-0.5">
            {NAV.map((n) => (
              <li key={n.id}>
                <a
                  href={`#${n.id}`}
                  className="block whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Link
          href="/masuk"
          className="ml-auto shrink-0 rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-400 lg:ml-0"
        >
          Masuk
        </Link>
      </div>
    </header>
  );
}
