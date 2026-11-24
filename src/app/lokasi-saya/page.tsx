import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KelolaLokasiForm } from "@/components/lokasi/kelola-lokasi";
import { hitungLaporanPerPos } from "@/components/lokasi/bingkai";
import type { Lokasi, WilayahRingkas } from "@/lib/lokasi/tipe";
import { simpanLokasiSaya, hapusLokasiSaya } from "./actions";

export const metadata = { title: "Lokasi Pos SAPA Saya — Pos SAPA" };
export const dynamic = "force-dynamic";

export default async function HalamanLokasiSaya() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profil } = user
    ? await supabase
        .from("pengguna")
        .select("peran, wilayah_id")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  if (profil?.peran !== "petugas") {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-6">
        <h2 className="font-display font-bold text-slate-900">Akses terbatas</h2>
        <p className="text-sm text-slate-600 mt-2">
          Menu ini khusus untuk Petugas Pos SAPA.
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

  if (!profil.wilayah_id) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-6">
        <h2 className="font-display font-bold text-slate-900">
          Akun belum terhubung ke kabupaten/kota
        </h2>
        <p className="text-sm text-slate-600 mt-2">
          Hubungi Admin Pusat untuk menetapkan kabupaten/kota penugasan Anda
          sebelum menambahkan lokasi Pos SAPA.
        </p>
      </div>
    );
  }

  const [wilayahRes, posRes, hitung] = await Promise.all([
    supabase
      .from("wilayah")
      .select("id, provinsi, kab_kota")
      .eq("id", profil.wilayah_id)
      .maybeSingle(),
    supabase
      .from("pos_sapa")
      .select(
        "id, wilayah_id, nama_lokasi, kode_pos, jenis_hunian, lat, lng, penanggung_jawab, status_aktif"
      )
      .eq("wilayah_id", profil.wilayah_id)
      .order("nama_lokasi"),
    hitungLaporanPerPos(),
  ]);

  const wilayah = wilayahRes.data as WilayahRingkas | null;

  const daftar: Lokasi[] = (
    (posRes.data ?? []) as Omit<Lokasi, "jumlah_laporan">[]
  ).map((p) => ({ ...p, jumlah_laporan: hitung.get(p.id) ?? 0 }));

  const aktif = daftar.filter((l) => l.status_aktif).length;

  return (
    <>
      <div className="mb-5">
        <h2 className="font-display text-xl font-extrabold text-slate-900">
          Lokasi Pos SAPA
        </h2>
        <p className="text-sm text-slate-500">
          Kelola lokasi Pos SAPA (Huntap/Huntara) di{" "}
          <strong className="text-slate-700">
            {wilayah ? `${wilayah.kab_kota} — ${wilayah.provinsi}` : "wilayah Anda"}
          </strong>
          . Tambahkan satu baris untuk setiap lokasi pelayanan.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
            Total lokasi
          </p>
          <p className="font-display text-2xl font-extrabold text-slate-900">
            {daftar.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
            Lokasi aktif
          </p>
          <p className="font-display text-2xl font-extrabold text-emerald-700">
            {aktif}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 col-span-2 sm:col-span-1">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
            Nonaktif
          </p>
          <p className="font-display text-2xl font-extrabold text-slate-500">
            {daftar.length - aktif}
          </p>
        </div>
      </div>

      <KelolaLokasiForm
        daftar={daftar}
        wilayah={wilayah ? [wilayah] : []}
        kunciWilayahId={profil.wilayah_id}
        simpanAksi={simpanLokasiSaya}
        hapusAksi={hapusLokasiSaya}
        judulKosong="Belum ada lokasi Pos SAPA di wilayah Anda. Tambahkan lokasi pertama agar laporan dapat diinput."
      />

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-900 mt-5">
        <p className="font-semibold mb-1">Catatan</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Lokasi yang sudah memiliki laporan tidak dapat dihapus — nonaktifkan saja.</li>
          <li>Lokasi nonaktif tidak muncul di pilihan input laporan.</li>
          <li>Anda hanya dapat mengelola lokasi di kabupaten/kota penugasan Anda.</li>
        </ul>
      </div>
    </>
  );
}
