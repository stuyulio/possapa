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

  // Admin Pusat mengisi laporan seluruh wilayah, jadi ia TIDAK terikat
  // `wilayah_id` dan lokasinya diambil langsung dari parameter URL. Petugas
  // tetap seperti sebelumnya: terikat satu kabupaten/kota dan hanya boleh
  // memilih lokasi di wilayahnya. Peran lain (Admin Kab/Kota, Pimpinan) tidak
  // mengisi laporan — ditolak lebih awal agar tidak jatuh ke galat RLS yang
  // tidak menjelaskan apa pun.
  const adminPusat = profil?.peran === "admin_pusat";

  // Lokasi dan periode adalah identitas laporan, bukan pilihan di halaman ini.
  // Tanpa keduanya tidak ada yang bisa diisi dengan aman, jadi pemilihnya
  // dikembalikan ke halaman daftar milik peran masing-masing — bukan ditebak
  // dengan periode terbaru. Diperiksa setelah peran diketahui supaya Admin
  // Pusat dilempar ke /laporan-saya, halaman yang bukan miliknya.
  if (!posDiminta || !periodeDiminta) {
    redirect(adminPusat ? "/admin/input-laporan" : "/laporan-saya");
  }

  if (!adminPusat && profil?.peran !== "petugas") {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-6">
        <h2 className="font-display font-bold text-slate-900">Akses terbatas</h2>
        <p className="text-sm text-slate-600 mt-2">
          Pengisian laporan tersedia untuk <strong>Petugas Pos SAPA</strong> dan{" "}
          <strong>Admin Pusat</strong>. Peran Anda belum memiliki kewenangan
          mengisi laporan.
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

  if (!adminPusat && !profil?.wilayah_id) {
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

  const wilayahId = profil?.wilayah_id ?? null;

  // Pos untuk Admin Pusat diambil per id, tanpa filter wilayah MAUPUN
  // status_aktif: laporan lama di lokasi yang sudah dinonaktifkan tetap harus
  // dapat dibetulkan lewat tautan yang sudah beredar.
  const posQuery = adminPusat
    ? supabase
        .from("pos_sapa")
        .select("id, nama_lokasi, jenis_hunian, jenis_hunian_lainnya, wilayah_id")
        .eq("id", posDiminta)
    : supabase
        .from("pos_sapa")
        .select("id, nama_lokasi, jenis_hunian, jenis_hunian_lainnya")
        .eq("wilayah_id", wilayahId as string)
        .eq("status_aktif", true)
        .order("nama_lokasi");

  const [posRes, periodeRes] = await Promise.all([
    posQuery,
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

  const daftarPos = (posRes.data ?? []) as unknown as {
    id: string;
    nama_lokasi: string;
    jenis_hunian: string | null;
    jenis_hunian_lainnya: string | null;
    wilayah_id?: string | null;
  }[];

  // Wilayah yang ditampilkan pada panel identitas. Petugas: wilayah
  // penugasannya. Admin Pusat: wilayah milik lokasi yang sedang dibuka —
  // dan hanya bila lokasi itu memang ditemukan.
  const wilayahIdTampil = adminPusat
    ? (daftarPos[0]?.wilayah_id ?? null)
    : wilayahId;

  const wilayahRes = wilayahIdTampil
    ? await supabase
        .from("wilayah")
        .select("id, kab_kota, provinsi")
        .eq("id", wilayahIdTampil)
        .maybeSingle()
    : { data: null };

  // Tujuan kembali SELALU membawa periode yang sedang diisi. Tanpa itu,
  // petugas yang mengisi periode lama dilempar ke /laporan-saya, yang default-nya
  // periode terbaru — ia lalu menekan "Isi" lagi dan mengetik data periode lama
  // ke periode baru. `/admin/input-laporan` punya perilaku default yang sama,
  // jadi keduanya diperlakukan seragam.
  const kembaliHref = adminPusat
    ? `/admin/input-laporan?periode=${periodeDiminta}`
    : `/laporan-saya?periode=${periodeDiminta}`;
  const kembaliLabel = adminPusat ? "Input Laporan" : "Laporan Saya";

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

  if (!adminPusat && daftarPos.length === 0) {
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

  // Parameter URL harus menunjuk lokasi yang benar-benar ada — dan, untuk
  // petugas, lokasi di wilayahnya. RLS sudah menolak penulisan ke luar wilayah;
  // pemeriksaan di sini hanya supaya halaman tidak menampilkan formulir yang
  // pasti gagal saat dikirim.
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
            adminPusat ? (
              <>
                Lokasi pada tautan ini tidak ditemukan — mungkin sudah dihapus.
                Kembali ke daftar lalu pilih lokasinya.
              </>
            ) : (
              <>
                Lokasi pada tautan ini bukan Pos SAPA aktif di wilayah{" "}
                <strong>{wilayahRes.data?.kab_kota}</strong>. Lokasi mungkin sudah
                dinonaktifkan, atau tautannya berasal dari wilayah lain.
              </>
            )
          ) : (
            <>
              Periode pada tautan ini tidak ada — mungkin sudah dihapus atau
              tautannya tidak lengkap.
            </>
          )}
        </p>
        <Link
          href={adminPusat ? "/admin/input-laporan" : "/laporan-saya"}
          className="inline-block mt-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl no-print"
        >
          ← Pilih dari {kembaliLabel}
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
  const nilaiServer = await ambilNilaiTersimpan(
    supabase,
    pos.id,
    periode.id,
    adminPusat
  );

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
          {adminPusat
            ? "Isi satu jenis laporan per penyimpanan. Laporan yang Anda simpan langsung berstatus terverifikasi."
            : "Isi satu jenis laporan per pengiriman. Draf tersimpan otomatis di perangkat ini."}
        </p>
      </div>

      <FormulirInput
        pos={pos}
        wilayahNama={wilayah?.kab_kota ?? "—"}
        provinsiNama={wilayah?.provinsi ?? "—"}
        periode={{ id: periode.id, label: periode.label }}
        jenisAwal={jenisAwal}
        modeAdmin={adminPusat}
        kembaliHref={kembaliHref}
        kembaliLabel={kembaliLabel}
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
    .eq("periode_id", periodeId)
    .order("submitted_at", { ascending: true, nullsFirst: true });

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
    const ada = hasil[baris.jenis_laporan];

    // PUBLIKASI boleh punya beberapa baris dengan status berbeda di tengah
    // proses. Satu status untuk satu kelompok: yang TERKUAT menang, sehingga
    // formulir tidak pernah dibuka dalam mode tulis padahal ada baris yang
    // sudah terkirim dan terkunci.
    if (baris.jenis_laporan === "publikasi" && ada) {
      hasil.publikasi = {
        status: gabungStatus(ada.status, baris.status),
        catatanBukaKunci:
          ada.catatanBukaKunci ?? baris.catatan_buka_kunci ?? null,
      };
      continue;
    }

    hasil[baris.jenis_laporan] = {
      status: baris.status,
      catatanBukaKunci: baris.catatan_buka_kunci,
    };
  }
  return hasil;
}

/** Status terkuat dari dua baris; urutannya mengikuti alur kerja. */
function gabungStatus(a: StatusLaporan, b: StatusLaporan): StatusLaporan {
  const urutan: StatusLaporan[] = [
    "belum",
    "draf",
    "terkirim",
    "terverifikasi",
  ];
  return urutan.indexOf(a) >= urutan.indexOf(b) ? a : b;
}

/**
 * Rincian laporan untuk satu kombinasi lokasi dan periode.
 *
 * Sengaja dipersempit ke satu kombinasi: halaman ini tidak lagi punya pemilih
 * lokasi maupun periode, jadi isian kombinasi lain tidak mungkin ditampilkan
 * dan tidak ada gunanya diambil. Ini juga menjawab kekhawatiran lama tentang
 * periode — angka periode lain tidak dapat lagi masuk ke periode yang sedang
 * dibuka.
 *
 * `termasukTerverifikasi` hanya untuk Admin Pusat: bagi petugas laporan
 * terverifikasi terkunci dan memang tidak boleh dimuat, tetapi Admin Pusat
 * harus dapat memperbaikinya — dan tanpa memuat isinya, formulirnya akan
 * kosong lalu menimpa data dengan nol.
 */
async function ambilNilaiTersimpan(
  supabase: Awaited<ReturnType<typeof createClient>>,
  posId: string,
  periodeId: string,
  termasukTerverifikasi = false
): Promise<NilaiServer> {
  const { data, error } = await supabase
    .from("laporan")
    .select(
      `id, jenis_laporan, pos_id, periode_id, status,
       laporan_anak (*), laporan_perempuan (*), laporan_rekap_pengaduan (*),
       laporan_kasus (*), laporan_publikasi (*)`
    )
    .eq("pos_id", posId)
    .eq("periode_id", periodeId)
    .in(
      "status",
      termasukTerverifikasi ? ["draf", "terkirim", "terverifikasi"] : ["draf", "terkirim"]
    )
    // Urutan WAJIB tetap: publikasi boleh berbaris banyak, dan `idPublikasi`
    // dikirim sejajar urutan kartu. Tanpa ORDER BY, Postgres bebas
    // mengembalikan urutan apa pun, dan pada simpan berikutnya id bisa
    // terpasang ke kartu yang salah. Publikasi impor diurutkan menurut waktu
    // pengisian aslinya, jadi urutan kartu pun mengikuti urutan Google Form.
    .order("submitted_at", { ascending: true, nullsFirst: false });

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

    // PUBLIKASI: satu kombinasi lokasi-periode dapat punya banyak baris, dan
    // kelimanya harus terbaca — bukan hanya yang terakhir. `id` baris induk
    // ikut dibawa supaya formulir dapat memakai ulang baris yang sama saat
    // menyimpan, sehingga status dan jejak auditnya tidak hilang.
    if (jenis === "publikasi") {
      const ada = perPeriode.publikasi as
        | { publikasi: unknown[] }
        | undefined;
      const daftar = ada?.publikasi ?? [];
      daftar.push({ ...isian, id: baris.id as string });
      perPeriode.publikasi = { publikasi: daftar };
      continue;
    }

    perPeriode[jenis] = isian;
  }

  return hasil;
}
