"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MENU_ANALISIS = [
  { href: "/dashboard", label: "Ringkasan" },
  { href: "/dashboard/anak", label: "Anak" },
  { href: "/dashboard/perempuan", label: "Perempuan" },
  { href: "/dashboard/pengaduan", label: "Pengaduan" },
  { href: "/dashboard/kasus", label: "Kasus" },
  { href: "/dashboard/publikasi", label: "Publikasi" },
];

export function NavDashboard({
  nama,
  peran,
  peranKode,
  punyaWilayah,
}: {
  nama: string;
  peran: string;
  peranKode: string | null;
  punyaWilayah: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Menu disesuaikan dengan peran — petugas tidak perlu melihat semua tab analisis.
  const menu =
    peranKode === "petugas"
      ? [
          { href: "/laporan-saya", label: "Laporan Saya" },
          { href: "/input", label: "Input Laporan" },
        ]
      : peranKode === "pimpinan"
      ? MENU_ANALISIS
      : [
          ...MENU_ANALISIS,
          { href: "/monitoring", label: "Monitoring" },
          ...(peranKode === "admin_pusat"
            ? [{ href: "/admin/periode", label: "Periode" }]
            : []),
          ...(punyaWilayah
            ? [
                { href: "/laporan-saya", label: "Laporan Saya" },
                { href: "/input", label: "Input Laporan" },
              ]
            : []),
        ];

  async function keluar() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <div className="bg-slate-900 border-b border-slate-700/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav
            className="flex gap-1 overflow-x-auto py-1.5"
            aria-label="Navigasi dashboard"
          >
            {menu.map((m) => {
              const aktif =
                m.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(m.href);
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  aria-current={aktif ? "page" : undefined}
                  className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                    aktif
                      ? "bg-amber-500 text-slate-950"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {m.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="bg-slate-800 text-slate-300 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between gap-3 text-xs">
          <span className="truncate">
            Masuk sebagai <strong className="text-white">{nama}</strong>{" "}
            <span className="text-slate-400">({peran})</span>
          </span>
          <button
            onClick={keluar}
            className="font-semibold hover:text-white transition shrink-0"
          >
            Keluar
          </button>
        </div>
      </div>
    </>
  );
}
