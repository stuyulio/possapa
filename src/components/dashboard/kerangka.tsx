import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ambilMasterData } from "@/lib/data/laporan";
import { FilterBar } from "./filter-bar";
import { NavDashboard } from "./nav";
import { SidebarInternal, IKON_SIDEBAR, type MenuSidebar } from "./sidebar";
import { BarAkun } from "./menu-akun";
import { LogoKemenPPPA } from "@/components/brand/logo";
import { KakiHalaman } from "@/components/brand/kaki";

const LABEL_PERAN: Record<string, string> = {
  petugas: "Petugas Pos SAPA",
  admin_kabkota: "Admin Kab/Kota",
  admin_pusat: "Admin Pusat",
  pimpinan: "Pimpinan",
};

/**
 * Menu sidebar untuk Petugas Pos SAPA.
 *
 * Tidak ada entri "Input Laporan": /input tidak lagi berdiri sendiri, ia hanya
 * dapat dibuka dari sel di /laporan-saya yang membawa lokasi dan periode. Dua
 * pintu masuk ke satu formulir membuat yang kedua kehilangan konteks — dulu
 * /input punya pemilih lokasi sendiri, dan lokasi yang berpindah di tengah
 * pengisian adalah risiko yang dicatat PRD §15.
 */
const MENU_PETUGAS: MenuSidebar[] = [
  { href: "/laporan-saya", label: "Laporan Saya", ikon: IKON_SIDEBAR.ringkasan },
  {
    href: "/lokasi-saya",
    label: "Lokasi Pos SAPA",
    ikon: IKON_SIDEBAR.lokasi,
  },
];

export async function KerangkaInternal({
  children,
  tampilkanFilter = true,
}: {
  children: React.ReactNode;
  tampilkanFilter?: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profil } = user
    ? await supabase
        .from("pengguna")
        .select("nama, peran, wilayah_id")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const master = tampilkanFilter ? await ambilMasterData() : null;

  // Petugas memakai tata letak sidebar kiri; peran lain tetap nav horizontal.
  if (profil?.peran === "petugas") {
    const { data: wilayahData } = profil.wilayah_id
      ? await supabase
          .from("wilayah")
          .select("kab_kota, provinsi")
          .eq("id", profil.wilayah_id)
          .maybeSingle()
      : { data: null };

    return (
      <div className="min-h-screen lg:flex bg-slate-50">
        <SidebarInternal
          nama={profil.nama ?? user?.email ?? "Pengguna"}
          peran={LABEL_PERAN.petugas}
          wilayah={wilayahData ? `${wilayahData.kab_kota}, ${wilayahData.provinsi}` : null}
          menu={MENU_PETUGAS}
        />

        <div className="flex-1 min-w-0 flex flex-col">
          <BarAkun
            nama={profil.nama ?? user?.email ?? "Pengguna"}
            peran={LABEL_PERAN.petugas}
            wilayah={
              wilayahData
                ? `${wilayahData.kab_kota}, ${wilayahData.provinsi}`
                : null
            }
            lebar="5xl"
          />
          <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>
          <KakiHalaman gelap={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="exec-header text-white border-b-4 border-amber-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <LogoKemenPPPA className="h-10 w-10 sm:h-11 sm:w-11 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-amber-300">
                  KemenPPPA RI — Deputi Bidang Perlindungan Khusus Anak
                </p>
                <h1 className="font-display text-lg sm:text-xl font-extrabold mt-0.5">
                  Dashboard Capaian Kinerja Pos SAPA
                </h1>
              </div>
            </div>

            {profil?.peran === "admin_pusat" && (
              <Link
                href="/admin/akun"
                className="shrink-0 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold no-print"
              >
                Panel admin
              </Link>
            )}
          </div>
        </div>
      </header>

      <NavDashboard
        peranKode={profil?.peran ?? null}
        punyaWilayah={Boolean(profil?.wilayah_id)}
      />

      <BarAkun
        nama={profil?.nama ?? user?.email ?? "Pengguna"}
        peran={LABEL_PERAN[profil?.peran ?? ""] ?? "belum ditetapkan"}
        wilayah={master?.wilayah && profil?.wilayah_id
          ? (master.wilayah.find((w) => w.id === profil.wilayah_id)?.kab_kota ?? null)
          : null}
        lebar="7xl"
      />

      {!profil && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900">
          Akun ini belum memiliki profil di tabel <code>pengguna</code>. Data
          mungkin tidak tampil. Hubungi Admin Pusat.
        </div>
      )}

      {master && (
        <FilterBar
          wilayah={master.wilayah}
          pos={master.pos}
          periode={master.periode as { id: string; label: string }[]}
        />
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1">
        {children}
      </main>

      <KakiHalaman />
    </div>
  );
}
