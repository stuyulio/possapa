import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ambilAntreanVerifikasi } from "@/lib/data/verifikasi";
import { AntreanVerifikasi } from "@/components/verifikasi/antrean";

export const metadata = { title: "Verifikasi Laporan — Pos SAPA" };
export const dynamic = "force-dynamic";

export default async function Verifikasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const periodeId = typeof params.periode === "string" ? params.periode : undefined;

  const [antrean, supabase] = await Promise.all([
    ambilAntreanVerifikasi(periodeId),
    createClient(),
  ]);

  if (antrean.galatAkses) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: profil } = user
      ? await supabase.from("pengguna").select("peran").eq("id", user.id).maybeSingle()
      : { data: null };

    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-6 max-w-lg">
        <h1 className="font-display font-bold text-slate-900">Akses terbatas</h1>
        <p className="text-sm text-slate-600 mt-2">{antrean.galatAkses}</p>
        {profil?.peran === "petugas" && (
          <p className="text-sm text-slate-600 mt-2">
            Laporan yang Anda kirim akan diperiksa Admin Kab/Kota. Statusnya
            terlihat di{" "}
            <Link href="/laporan-saya" className="text-blue-700 font-semibold hover:underline">
              Laporan Saya
            </Link>
            .
          </p>
        )}
        <Link
          href="/dashboard"
          className="inline-block mt-4 text-sm font-semibold text-blue-700 hover:underline"
        >
          ← Kembali ke dashboard
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold text-slate-900">
            Verifikasi Laporan
          </h2>
          <p className="text-sm text-slate-500">
            {antrean.periode
              ? `Periode ${antrean.periode.label}`
              : "Belum ada periode"}{" "}
            · {antrean.baris.length} laporan terkirim
          </p>
        </div>

        {antrean.daftarPeriode.length > 1 && (
          <form className="no-print flex items-center gap-2">
            <select
              name="periode"
              defaultValue={antrean.periode?.id ?? ""}
              className="text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white"
            >
              {antrean.daftarPeriode.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="text-xs font-semibold bg-slate-900 text-white px-3 py-2 rounded-xl"
            >
              Tampilkan
            </button>
          </form>
        )}
      </div>

      <AntreanVerifikasi antrean={antrean} />

      <p className="text-xs text-slate-500 mt-5">
        Anomali dihitung ulang setiap halaman dibuka, jadi tanda akan hilang
        sendiri setelah datanya diperbaiki. Riwayat perubahan ada di{" "}
        <Link href="/admin/audit" className="text-blue-700 font-semibold hover:underline">
          Log Audit
        </Link>{" "}
        (Admin Pusat).
      </p>
    </>
  );
}
