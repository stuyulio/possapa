import { SidebarAdmin } from "@/components/admin/sidebar";
import { BarAkun } from "@/components/dashboard/menu-akun";
import { KakiHalaman } from "@/components/brand/kaki";

/**
 * Kerangka halaman Admin Pusat: sidebar kiri, konten di kanan.
 *
 * Dipakai bersama oleh `/admin/**` dan `/input` (ketika dibuka Admin Pusat).
 * Sebelum ini `/input` memakai `KerangkaInternal`, yang untuk peran admin
 * merender header eksekutif dan nav analisis horizontal — dua lapis navigasi
 * yang tidak berguna saat Admin sedang mengisi satu formulir: ia tidak pindah
 * tab dari sana, dan nav itu menambah tinggi tanpa menambah jalan.
 */

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

export function KerangkaAdmin({
  children,
  nama,
  peran,
  tampilkanBarAkun = true,
  lebar = "6xl",
}: {
  children: React.ReactNode;
  nama: string;
  peran: string;
  /**
   * Bar akun kanan atas berisi nama dan tombol Keluar. Halaman yang punya
   * tombol kembali sendiri (mis. formulir input) dapat mematikannya; identitas
   * dan Keluar lalu pindah ke dasar sidebar, supaya keduanya tidak hilang.
   */
  tampilkanBarAkun?: boolean;
  lebar?: keyof typeof LEBAR;
}) {
  return (
    <div className="min-h-screen flex bg-slate-50">
      <SidebarAdmin
        nama={nama}
        peran={peran}
        akunDiSidebar={!tampilkanBarAkun}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {tampilkanBarAkun && (
          <BarAkun nama={nama} peran={peran} lebar={lebar} />
        )}
        <main
          className={`flex-1 w-full ${LEBAR[lebar]} mx-auto px-4 sm:px-6 lg:px-8 py-6`}
        >
          {children}
        </main>
        <KakiHalaman gelap={false} />
      </div>
    </div>
  );
}
