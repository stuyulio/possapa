import { createClient } from "@/lib/supabase/server";
import { KerangkaInternal } from "@/components/dashboard/kerangka";
import { KerangkaAdmin } from "@/components/admin/kerangka";

const LABEL_PERAN: Record<string, string> = {
  petugas: "Petugas Pos SAPA",
  admin_kabkota: "Admin Kab/Kota",
  admin_pusat: "Admin Pusat",
  pimpinan: "Pimpinan",
};

/**
 * Kerangka formulir input.
 *
 * Admin Pusat memakai kerangka panel admin: sidebar kiri saja, tanpa header
 * eksekutif dan nav analisis yang tidak membawa ke mana pun selama ia mengisi
 * satu laporan, dan tanpa bar akun — jalannya keluar ada di dasar sidebar.
 *
 * Petugas tetap memakai kerangka internal seperti sebelumnya (sidebar
 * Laporan Saya / Lokasi Pos SAPA, yang memang jalan pulangnya).
 */
export default async function LayoutInput({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profil } = user
    ? await supabase
        .from("pengguna")
        .select("nama, peran")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  if (profil?.peran === "admin_pusat") {
    return (
      <KerangkaAdmin
        nama={profil.nama ?? user?.email ?? "Pengguna"}
        peran={LABEL_PERAN.admin_pusat}
        tampilkanBarAkun={false}
        lebar="5xl"
      >
        {children}
      </KerangkaAdmin>
    );
  }

  return <KerangkaInternal tampilkanFilter={false}>{children}</KerangkaInternal>;
}
