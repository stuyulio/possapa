import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FormulirInput, type NilaiServer, type StatusJenis } from "./formulir";
import { LABEL_JENIS, type JenisForm } from "@/lib/validasi/laporan";
import type { StatusLaporan } from "@/lib/laporan";

export const metadata = { title: "Input Laporan — Pos SAPA" };
export const dynamic = "force-dynamic";

export default async function HalamanInput({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const posDiminta = typeof params.pos === "string" ? params.pos : null;
  const periodeDiminta = typeof params.periode === "string" ? params.periode : null;
  const jenisDiminta = typeof params.jenis === "string" ? params.jenis : null;

  // Lokasi dan periode adalah identitas laporan, bukan pilihan di halaman ini.
  // Tanpa keduanya tidak ada yang bisa diisi dengan aman, jadi pemilihnya
  // dikembalikan ke /laporan-saya — bukan ditebak dengan periode terbaru.
  if (!posDiminta || !periodeDiminta) redirect("/laporan-saya");

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
      .select("id, nama_lokasi, jenis_hunian, jenis_hunian_lainnya")
      .eq("wilayah_id", profil.wilayah_id)
      .eq("status_aktif", true)
      .order("nama_lokasi"),
    supabase
      .from("periode")
      .select("id, label, tanggal_mulai")
      .order("tanggal_mulai", { ascending: false }),
  ]);

  const daftarPeriode = (periodeRes.data ?? []) as {
    id: string;
    label: string;
    tanggal_mulai: string;
  }[];

  const daftarPos = (posRes.data ?? []) as {
    id: string;
    nama_lokasi: string;
    jenis_hunian: string | null;
    jenis_hunian_lainnya: string | null;
  }[];

  if (daftarPeriode.length === 0) {
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

  if (daftarPos.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-6">
        <h2 className="font-display font-bold text-slate-900">
          Belum ada lokasi Pos SAPA di wilayah Anda
        </h2>
        <p className="text-sm text-slate-600 mt-2">
          Tambahkan lokasi Pos SAPA (Huntap, Huntara, Dinas/UPTD PPPA, atau
          lainnya) di{" "}
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

  // Parameter URL harus menunjuk lokasi di wilayah petugas dan periode yang
  // benar-benar ada. RLS sudah menolak penulisan ke luar wilayah; pemeriksaan di
  // sini hanya supaya halaman tidak menampilkan formulir yang pasti gagal saat
  // dikirim.
  const pos = daftarPos.find((p) => p.id === posDiminta);
  const periode = daftarPeriode.find((p) => p.id === periodeDiminta);

  if (!pos || !periode) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-6">
        <h2 className="font-display font-bold text-slate-900">
          Kombinasi lokasi dan periode tidak ditemukan
        </h2>
        <p className="text-sm text-slate-600 mt-2">
          {!pos ? (
            <>
              Lokasi pada tautan ini bukan Pos SAPA aktif di wilayah{" "}
              <strong>{wilayahRes.data?.kab_kota}</strong>. Lokasi mungkin sudah
              dinonaktifkan, atau tautannya berasal dari wilayah lain.
            </>
          ) : (
            <>
              Periode pada tautan ini tidak ada — mungkin sudah dihapus atau
              tautannya tidak lengkap.
            </>
          )}
        </p>
        <Link
          href="/laporan-saya"
          className="inline-block mt-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl no-print"
        >
          ← Pilih dari Laporan Saya
        </Link>
      </div>
    );
  }

  const jenisAwal: JenisForm =
    jenisDiminta && jenisDiminta in LABEL_JENIS
      ? (jenisDiminta as JenisForm)
      : "aktivitas_anak";

  // Hanya satu kombinasi yang dibuka, jadi hanya isian kombinasi itulah yang
  // perlu diambil — bukan seluruh lokasi petugas sepanjang waktu.
  const nilaiServer = await ambilNilaiTersimpan(supabase, pos.id, periode.id);

  // Status per jenis untuk kombinasi ini. Kunci laporan berlaku per jenis:
  // satu lokasi dapat punya laporan anak yang sudah terkirim sementara
  // rekap pengaduannya masih draf, jadi mode tidak dapat dihitung sekali
  // untuk seluruh kombinasi.
  const statusPerJenis = await ambilStatusJenis(supabase, pos.id, periode.id);

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
          Isi satu jenis laporan per pengiriman. Draf tersimpan otomatis di
          perangkat ini.
        </p>
      </div>

      <FormulirInput
        pos={pos}
        wilayahNama={wilayah?.kab_kota ?? "—"}
        provinsiNama={wilayah?.provinsi ?? "—"}
        periode={{ id: periode.id, label: periode.label }}
        jenisAwal={jenisAwal}
        nilaiServer={nilaiServer}
        statusPerJenis={statusPerJenis}
      />
    </>
  );
}

/** Hubungan jenis laporan dengan tabel rinciannya. */
const DETAIL: { jenis: JenisForm; kunci: string }[] = [
  { jenis: "aktivitas_anak", kunci: "laporan_anak" },
  { jenis: "aktivitas_perempuan", kunci: "laporan_perempuan" },
  { jenis: "rekap_pengaduan", kunci: "laporan_rekap_pengaduan" },
  { jenis: "tindak_lanjut_kasus", kunci: "laporan_kasus" },
  { jenis: "publikasi", kunci: "laporan_publikasi" },
];

/**
 * Status dan penanda buka kunci untuk setiap jenis pada satu kombinasi.
 *
 * Jenis yang belum pernah dibuat tidak muncul di hasil; pemanggil memperlakukan
 * yang tidak ada sebagai "belum".
 */
async function ambilStatusJenis(
  supabase: Awaited<ReturnType<typeof createClient>>,
  posId: string,
  periodeId: string
): Promise<Partial<Record<JenisForm, StatusJenis>>> {
  const { data, error } = await supabase
    .from("laporan")
    .select("jenis_laporan, status, catatan_buka_kunci")
    .eq("pos_id", posId)
    .eq("periode_id", periodeId);

  if (error) {
    console.error("[ambilStatusJenis]", error.message);
    return {};
  }

  const hasil: Partial<Record<JenisForm, StatusJenis>> = {};
  for (const baris of (data ?? []) as {
    jenis_laporan: JenisForm;
    status: StatusLaporan;
    catatan_buka_kunci: string | null;
  }[]) {
    hasil[baris.jenis_laporan] = {
      status: baris.status,
      catatanBukaKunci: baris.catatan_buka_kunci,
    };
  }
  return hasil;
}

/**
 * Rincian laporan yang masih dapat diubah petugas untuk satu kombinasi lokasi
 * dan periode.
 *
 * Sengaja dipersempit ke satu kombinasi: halaman ini tidak lagi punya pemilih
 * lokasi maupun periode, jadi isian kombinasi lain tidak mungkin ditampilkan
 * dan tidak ada gunanya diambil. Ini juga menjawab kekhawatiran lama tentang
 * periode — angka periode lain tidak dapat lagi masuk ke periode yang sedang
 * dibuka. Hanya status draf dan terkirim; laporan terverifikasi terkunci RLS.
 */
async function ambilNilaiTersimpan(
  supabase: Awaited<ReturnType<typeof createClient>>,
  posId: string,
  periodeId: string
): Promise<NilaiServer> {
  const { data, error } = await supabase
    .from("laporan")
    .select(
      `jenis_laporan, pos_id, periode_id,
       laporan_anak (*), laporan_perempuan (*), laporan_rekap_pengaduan (*),
       laporan_kasus (*), laporan_publikasi (*)`
    )
    .eq("pos_id", posId)
    .eq("periode_id", periodeId)
    .in("status", ["draf", "terkirim"]);

  if (error) {
    console.error("[ambilNilaiTersimpan]", error.message);
    return {};
  }

  const hasil: NilaiServer = {};

  for (const baris of (data ?? []) as unknown as Record<string, unknown>[]) {
    const jenis = baris.jenis_laporan as JenisForm;

    const kunci = DETAIL.find((d) => d.jenis === jenis)?.kunci;
    if (!kunci) continue;

    const detail = baris[kunci] as Record<string, unknown> | null;
    if (!detail) continue;

    // laporan_id bukan bagian dari isian formulir.
    const isian = { ...detail };
    delete isian.laporan_id;

    const perPos = (hasil[posId] ??= {});
    const perPeriode = (perPos[periodeId] ??= {});
    perPeriode[jenis] = isian;
  }

  return hasil;
}
