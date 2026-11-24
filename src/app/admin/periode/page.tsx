import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DaftarPeriode, type Periode } from "./form-periode";

export const metadata = { title: "Kelola Periode — Pos SAPA" };
export const dynamic = "force-dynamic";

export default async function HalamanPeriode() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profil } = user
    ? await supabase
        .from("pengguna")
        .select("peran")
        .eq("id", user.id)
        .maybeSingle()
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

  const [periodeRes, laporanRes] = await Promise.all([
    supabase
      .from("periode")
      .select("id, tanggal_mulai, tanggal_selesai, label")
      .order("tanggal_mulai", { ascending: false }),
    supabase.from("laporan").select("periode_id"),
  ]);

  // Hitung pemakaian di memori — volume kecil, tidak perlu agregasi SQL.
  const hitung = new Map<string, number>();
  for (const l of (laporanRes.data ?? []) as { periode_id: string }[]) {
    hitung.set(l.periode_id, (hitung.get(l.periode_id) ?? 0) + 1);
  }

  const daftar: Periode[] = (
    (periodeRes.data ?? []) as {
      id: string;
      tanggal_mulai: string;
      tanggal_selesai: string;
      label: string;
    }[]
  ).map((p) => ({
    ...p,
    jumlah_laporan: hitung.get(p.id) ?? 0,
  }));

  return (
    <>
      <div className="mb-5">
        <h2 className="font-display text-xl font-extrabold text-slate-900">
          Kelola Periode Pelaporan
        </h2>
        <p className="text-sm text-slate-500">
          Periode menentukan rentang tanggal laporan. Label diturunkan otomatis
          dari tanggal mulai dan selesai.
        </p>
      </div>

      <DaftarPeriode daftar={daftar} />

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-900 mt-5">
        <p className="font-semibold mb-1">Ketentuan</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Rentang tanggal <strong>tidak boleh tumpang tindih</strong> dengan
            periode lain (PRD §6.4). Pelanggaran ditandai di tabel, tidak
            memblokir — data historis hasil migrasi Google Form memang
            tumpang tindih, jadi master data yang ada masih perlu dirapikan.
          </li>
          <li>
            Periode yang sudah dipakai laporan <strong>tidak dapat dihapus</strong>{" "}
            — ini menjaga integritas data. Mengubah tanggalnya tetap
            diperbolehkan.
          </li>
          <li>Mengubah tanggal tidak memindahkan laporan ke periode lain.</li>
        </ul>
      </div>
    </>
  );
}
