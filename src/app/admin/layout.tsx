import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SidebarAdmin } from "@/components/admin/sidebar";
import { KakiHalaman } from "@/components/brand/kaki";

const LABEL_PERAN: Record<string, string> = {
  petugas: "Petugas Kab/Kota",
  admin_kabkota: "Admin Kab/Kota",
  admin_pusat: "Admin Pusat",
  pimpinan: "Pimpinan",
};

export default async function LayoutAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profil } = user
    ? await supabase.from("pengguna").select("nama, peran").eq("id", user.id).maybeSingle()
    : { data: null };

  if (profil?.peran !== "admin_pusat") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
        <div className="bg-white rounded-2xl border border-amber-200 p-6 max-w-md">
          <h1 className="font-display font-bold text-slate-900">Akses terbatas</h1>
          <p className="text-sm text-slate-600 mt-2">
            Area admin hanya untuk Admin Pusat. Peran Anda:{" "}
            <strong>{LABEL_PERAN[profil?.peran ?? ""] ?? "belum ditetapkan"}</strong>.
          </p>
          <Link
            href="/dashboard"
            className="inline-block mt-4 text-sm font-semibold text-blue-700 hover:underline"
          >
            ← Kembali ke dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <SidebarAdmin
        nama={profil?.nama ?? user?.email ?? "Pengguna"}
        peran={LABEL_PERAN[profil?.peran ?? ""] ?? "Admin Pusat"}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
        <KakiHalaman gelap={false} />
      </div>
    </div>
  );
}
