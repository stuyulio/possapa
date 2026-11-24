import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FormulirInput } from "./formulir";
import type { JenisForm } from "@/lib/validasi/laporan";

export const metadata = { title: "Input Laporan — Pos SAPA" };
export const dynamic = "force-dynamic";

export default async function HalamanInput({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const jenisAwal = typeof params.jenis === "string" ? params.jenis : undefined;
  const posAwal = typeof params.pos === "string" ? params.pos : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profil } = user
    ? await supabase
        .from("pengguna")
        .select("wilayah_id, peran")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  if (!profil?.wilayah_id) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-6">
        <h2 className="font-display font-bold text-slate-900">
          Akun belum terhubung ke kabupaten/kota
        </h2>
        <p className="text-sm text-slate-600 mt-2">
          Formulir input tersedia untuk peran <strong>petugas</strong> yang sudah
          ditugaskan ke satu kabupaten/kota. Hubungi Admin Pusat untuk penugasan.
        </p>
        <Link
          href="/laporan-saya"
          className="inline-block mt-4 text-sm font-semibold text-blue-700 hover:underline"
        >
          ← Kembali
        </Link>
      </div>
    );
  }

  const [wilayahRes, posRes, periodeRes] = await Promise.all([
    supabase
      .from("wilayah")
      .select("kab_kota, provinsi")
      .eq("id", profil.wilayah_id)
      .maybeSingle(),
    supabase
      .from("pos_sapa")
      .select("id, nama_lokasi, jenis_hunian")
      .eq("wilayah_id", profil.wilayah_id)
      .eq("status_aktif", true)
      .order("nama_lokasi"),
    supabase
      .from("periode")
      .select("id, label, tanggal_mulai")
      .order("tanggal_mulai", { ascending: false }),
  ]);

  const periode = (periodeRes.data ?? []) as {
    id: string;
    label: string;
    tanggal_mulai: string;
  }[];

  const pos = (posRes.data ?? []) as {
    id: string;
    nama_lokasi: string;
    jenis_hunian: string | null;
  }[];

  if (periode.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-6">
        <h2 className="font-display font-bold text-slate-900">
          Belum ada periode pelaporan
        </h2>
        <p className="text-sm text-slate-600 mt-2">
          Admin Pusat perlu membuat data periode terlebih dahulu sebelum laporan
          dapat diinput.
        </p>
      </div>
    );
  }

  if (pos.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-6">
        <h2 className="font-display font-bold text-slate-900">
          Belum ada lokasi Pos SAPA di wilayah Anda
        </h2>
        <p className="text-sm text-slate-600 mt-2">
          Tambahkan lokasi Pos SAPA (Huntap/Huntara) di{" "}
          <strong>{wilayahRes.data?.kab_kota}</strong> terlebih dahulu, lalu
          laporan dapat diinput.
        </p>
        <Link
          href="/lokasi-saya"
          className="inline-block mt-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl no-print"
        >
          + Tambah lokasi Pos SAPA
        </Link>
      </div>
    );
  }

  const wilayah = wilayahRes.data as unknown as {
    kab_kota: string;
    provinsi: string;
  } | null;

  return (
    <>
      <div className="mb-4">
        <h2 className="font-display text-xl font-extrabold text-slate-900">
          Input Laporan Berkala
        </h2>
        <p className="text-sm text-slate-500">
          Pilih lokasi Pos SAPA, lalu isi satu jenis laporan per pengiriman. Draf
          tersimpan otomatis di perangkat ini.
        </p>
      </div>

      <FormulirInput
        daftarPos={pos}
        wilayahNama={wilayah?.kab_kota ?? "—"}
        provinsiNama={wilayah?.provinsi ?? "—"}
        posAwal={posAwal ?? pos[0].id}
        periode={periode.map((p) => ({ id: p.id, label: p.label }))}
        periodeTerpilih={periode[0].id}
        jenisAwal={jenisAwal as JenisForm | undefined}
      />
    </>
  );
}
