"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogoKemenPPPA } from "@/components/brand/logo";

const MENU_ADMIN = [
  { href: "/admin/akun", label: "Akun", ikon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { href: "/admin/periode", label: "Periode", ikon: "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18" },
  { href: "/admin/wilayah", label: "Wilayah & Lokasi", ikon: "M12 21s-7-5.7-7-11a7 7 0 1 1 14 0c0 5.3-7 11-7 11zM12 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" },
];

const MENU_KEMBALI = [{ href: "/dashboard", label: "Dashboard", ikon: "M3 12l9-9 9 9M5 10v10h14V10" }];

export function SidebarAdmin({
  nama,
  peran,
}: {
  nama: string;
  peran: string;
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

  const Item = ({
    href,
    label,
    ikon,
  }: {
    href: string;
    label: string;
    ikon: string;
  }) => {
    const aktif = pathname.startsWith(href);
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

  return (
    <>
      {/* Bar atas untuk ponsel */}
      <div className="lg:hidden sticky top-0 z-40 bg-slate-900 text-white border-b-4 border-amber-500 no-print">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <LogoKemenPPPA className="h-8 w-8 shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold">
                Admin
              </p>
              <p className="font-display font-bold text-sm">Pos SAPA</p>
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
            {MENU_ADMIN.map((menu) => (
              <Item key={menu.href} {...menu} />
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
              Admin Pos SAPA
            </h1>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {MENU_ADMIN.map((menu) => (
            <Item key={menu.href} {...menu} />
          ))}
          <div className="pt-3 mt-3 border-t border-slate-700/60">
            {MENU_KEMBALI.map((menu) => (
              <Item key={menu.href} {...menu} />
            ))}
          </div>
        </nav>

        <div className="px-3 py-3 border-t border-slate-700/60">
          <p className="text-xs text-slate-400 px-2 truncate">{nama}</p>
          <p className="text-[11px] text-slate-500 px-2 mb-2 truncate">{peran}</p>
          <button
            onClick={keluar}
            className="w-full text-left px-2 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            Keluar
          </button>
        </div>
      </aside>
    </>
  );
}
