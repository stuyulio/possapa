"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogoKemenPPPA } from "@/components/brand/logo";

export type MenuSidebar = {
  href: string;
  label: string;
  ikon: string;
  /** Aktif hanya bila path sama persis (dipakai untuk indeks). */
  persis?: boolean;
};

const IKON = {
  ringkasan: "M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-5H3zM13 8h8V3h-8z",
  daftar: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  tambah: "M12 5v14M5 12h14",
  lokasi: "M12 21s-7-5.7-7-11a7 7 0 1 1 14 0c0 5.3-7 11-7 11zM12 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  bantuan: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01",
} as const;

/**
 * Sidebar kiri untuk area internal (dashboard petugas).
 * Tampil tetap di desktop; menjadi panel geser pada ponsel.
 */
export function SidebarInternal({
  nama,
  peran,
  wilayah,
  menu,
}: {
  nama: string;
  peran: string;
  wilayah?: string | null;
  menu: MenuSidebar[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [terbuka, setTerbuka] = useState(false);

  async function keluar() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const Item = ({ href, label, ikon, persis }: MenuSidebar) => {
    const aktif = persis ? pathname === href : pathname.startsWith(href);
    return (
      <Link
        href={href}
        onClick={() => setTerbuka(false)}
        aria-current={aktif ? "page" : undefined}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
          aktif
            ? "bg-amber-500 text-slate-950"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <svg
          className="w-4 h-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={ikon} />
        </svg>
        <span>{label}</span>
      </Link>
    );
  };

  const Profil = () => (
    <div className="px-3 py-3 border-t border-slate-700/60">
      <p className="text-xs text-slate-300 px-2 truncate font-semibold">{nama}</p>
      <p className="text-[11px] text-slate-500 px-2 truncate">{peran}</p>
      {wilayah && (
        <p className="text-[11px] text-amber-400/90 px-2 mb-2 truncate">{wilayah}</p>
      )}
      <button
        onClick={keluar}
        className="w-full text-left px-2 py-2 mt-1 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
      >
        Keluar
      </button>
    </div>
  );

  return (
    <>
      {/* Bar atas untuk ponsel */}
      <div className="lg:hidden sticky top-0 z-40 bg-slate-900 text-white border-b-4 border-amber-500 no-print">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <LogoKemenPPPA className="h-8 w-8 shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold">
                Pos SAPA
              </p>
              <p className="font-display font-bold text-sm truncate max-w-[52vw]">
                {wilayah ?? peran}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTerbuka((v) => !v)}
            aria-expanded={terbuka}
            aria-label="Buka menu"
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              {terbuka ? (
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {terbuka && (
          <nav className="px-3 pb-3 space-y-1">
            {menu.map((m) => (
              <Item key={m.href} {...m} />
            ))}
          </nav>
        )}
      </div>

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex lg:flex-col w-60 shrink-0 bg-slate-900 text-white min-h-screen sticky top-0 no-print">
        <div className="px-4 py-5 border-b border-slate-700/60 flex items-center gap-3">
          <LogoKemenPPPA className="h-10 w-10 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold">
              KemenPPPA RI
            </p>
            <h1 className="font-display font-extrabold text-base mt-0.5">
              Pos SAPA
            </h1>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menu.map((m) => (
            <Item key={m.href} {...m} />
          ))}
        </nav>

        <Profil />
      </aside>
    </>
  );
}

export const IKON_SIDEBAR = IKON;
