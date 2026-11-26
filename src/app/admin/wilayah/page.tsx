import { createClient } from "@/lib/supabase/server";
import { KelolaLokasi } from "./form-lokasi";
import { hitungLaporanPerPos } from "@/components/lokasi/bingkai";
import type { Lokasi } from "@/lib/lokasi/tipe";

export const metadata = { title: "Wilayah & Lokasi — Pos SAPA" };
export const dynamic = "force-dynamic";

export default async function HalamanWilayah() {
  const supabase = await createClient();

  const [wilayahRes, posRes, hitung] = await Promise.all([
    supabase.from("wilayah").select("id, provinsi, kab_kota").order("provinsi"),
    supabase
      .from("pos_sapa")
      .select(
        "id, wilayah_id, nama_lokasi, kode_pos, jenis_hunian, jenis_hunian_lainnya, lat, lng, penanggung_jawab, status_aktif"
      )
      .order("nama_lokasi"),
    hitungLaporanPerPos(),
  ]);

  const daftar: Lokasi[] = (
    (posRes.data ?? []) as Omit<Lokasi, "jumlah_laporan">[]
  ).map((p) => ({ ...p, jumlah_laporan: hitung.get(p.id) ?? 0 }));

  return (
    <>
      <div className="mb-5">
        <h2 className="font-display text-xl font-extrabold text-slate-900">
          Wilayah &amp; Lokasi Pos SAPA
        </h2>
        <p className="text-sm text-slate-500">
          18 kabupaten/kota sasaran bersifat tetap. Lokasi Pos SAPA diisi manual —
          satu wilayah boleh punya beberapa lokasi (Huntap, Huntara, Dinas/UPTD
          PPPA, atau lainnya).
        </p>
      </div>

      <KelolaLokasi
        daftar={daftar}
        wilayah={
          (wilayahRes.data ?? []) as {
            id: string;
            provinsi: string;
            kab_kota: string;
          }[]
        }
      />

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-900 mt-5">
        <p className="font-semibold mb-1">Catatan</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Lokasi yang sudah memiliki laporan tidak dapat dihapus — nonaktifkan saja.</li>
          <li>Lokasi nonaktif tidak muncul di pilihan input laporan petugas.</li>
          <li>Koordinat dipakai pada peta sebaran (Fase 3).</li>
        </ul>
      </div>
    </>
  );
}
