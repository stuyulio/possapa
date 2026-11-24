"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU_ANALISIS = [
  { href: "/dashboard", label: "Ringkasan" },
  { href: "/dashboard/anak", label: "Anak" },
  { href: "/dashboard/perempuan", label: "Perempuan" },
  { href: "/dashboard/pengaduan", label: "Pengaduan" },
  { href: "/dashboard/kasus", label: "Kasus" },
  { href: "/dashboard/publikasi", label: "Publikasi" },
  { href: "/peta", label: "Peta" },
];

export function NavDashboard({
  peranKode,
  punyaWilayah,
}: {
  peranKode: string | null;
  punyaWilayah: boolean;
}) {
  const pathname = usePathname();

  // Menu disesuaikan dengan peran — petugas tidak perlu melihat semua tab
  // analisis. "Input Laporan" tidak ada di sini karena /input selalu dibuka
  // dari sel di /laporan-saya, yang membawa lokasi dan periodenya.
  const menu =
    peranKode === "petugas"
      ? [{ href: "/laporan-saya", label: "Laporan Saya" }]
      : peranKode === "pimpinan"
      ? MENU_ANALISIS
      : [
          ...MENU_ANALISIS,
          { href: "/monitoring", label: "Monitoring" },
          // Admin Kab/Kota memverifikasi wilayahnya; Admin Pusat semuanya.
          ...(peranKode === "admin_kabkota" || peranKode === "admin_pusat"
            ? [{ href: "/verifikasi", label: "Verifikasi" }]
            : []),
          ...(peranKode === "admin_pusat"
            ? [
                { href: "/admin/periode", label: "Periode" },
                { href: "/admin/audit", label: "Log Audit" },
              ]
            : []),
          ...(punyaWilayah
            ? [{ href: "/laporan-saya", label: "Laporan Saya" }]
            : []),
        ];

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

      {/* Strip identitas tidak lagi di sini — dipindah ke bar akun kanan atas
          oleh KerangkaInternal, agar tombol Keluar selalu di posisi tetap. */}
    </>
  );
}
