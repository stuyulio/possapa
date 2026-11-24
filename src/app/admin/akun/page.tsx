import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { serviceRoleTersedia } from "@/lib/supabase/admin";
import { KelolaAkun, type Akun } from "./form-akun";

export const metadata = { title: "Kelola Akun — Pos SAPA" };
export const dynamic = "force-dynamic";

export default async function HalamanAkun() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profil } = user
    ? await supabase.from("pengguna").select("peran").eq("id", user.id).maybeSingle()
    : { data: null };

  if (profil?.peran !== "admin_pusat") {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-6">
        <h2 className="font-display font-bold text-slate-900">Akses terbatas</h2>
        <p className="text-sm text-slate-600 mt-2">
          Halaman ini hanya dapat diakses oleh Admin Pusat. Peran Anda:{" "}
          <strong>{profil?.peran ?? "belum ditetapkan"}</strong>.
        </p>
        <Link
          href="/dashboard"
          className="inline-block mt-4 text-sm font-semibold text-blue-700 hover:underline"
        >
          ← Kembali ke dashboard
        </Link>
      </div>
    );
  }

  const [akunRes, wilayahRes] = await Promise.all([
    supabase
      .from("pengguna")
      .select("id, nama, email, peran, wilayah_id, aktif")
      .order("peran")
      .order("nama"),
    supabase.from("wilayah").select("id, provinsi, kab_kota").order("provinsi"),
  ]);

  return (
    <>
      <div className="mb-5">
        <h2 className="font-display text-xl font-extrabold text-slate-900">
          Kelola Akun
        </h2>
        <p className="text-sm text-slate-500">
          Satu akun petugas per kabupaten/kota. Akun dibuat oleh Admin Pusat —
          tidak ada pendaftaran mandiri.
        </p>
      </div>

      <KelolaAkun
        daftar={(akunRes.data ?? []) as Akun[]}
        wilayah={wilayahRes.data ?? []}
        butuhWilayah
        adaServiceRole={serviceRoleTersedia()}
      />
    </>
  );
}
