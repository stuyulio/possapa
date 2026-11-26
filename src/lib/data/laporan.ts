import { createClient } from "@/lib/supabase/server";

export type JenisLaporan =
  | "aktivitas_anak"
  | "aktivitas_perempuan"
  | "rekap_pengaduan"
  | "tindak_lanjut_kasus"
  | "publikasi";

export type Anak = {
  laporan_id: string;
  jumlah_kegiatan: number;
  nama_kegiatan: string | null;
  jenis_kegiatan: string[];
  usia_0_5: number;
  usia_6_12: number;
  usia_13_17: number;
  laki_laki: number;
  perempuan: number;
  disabilitas: number;
  perlu_layanan_lanjutan: number;
  temuan: string | null;
  tindak_lanjut: string | null;
};

export type Perempuan = {
  laporan_id: string;
  jumlah_kegiatan: number;
  nama_kegiatan: string | null;
  jenis_kegiatan: string | null;
  total_ikut: number;
  kepala_keluarga: number;
  hamil: number;
  menyusui: number;
  lansia: number;
  disabilitas: number;
  manfaat: string | null;
};

export type Rekap = {
  laporan_id: string;
  status_bulan: string;
  aduan_masuk: number;
  kekerasan_perempuan: number;
  kekerasan_anak: number;
  non_kekerasan_perempuan: number;
  non_kekerasan_anak: number;
  sudah_ditindaklanjuti: number;
  tercatat_simfoni: number;
  tindak_lanjut_umum: string | null;
  pihak_terlibat: string | null;
};

export type Kasus = {
  laporan_id: string;
  kode_kasus: string;
  tanggal_aduan: string;
  kategori: "kekerasan" | "non_kekerasan";
  jenis_kasus: string | null;
  jumlah_korban: number;
  jenis_kelamin: string | null;
  kelompok_usia: string | null;
  disabilitas: boolean;
  kebutuhan_korban: string | null;
  tindak_lanjut: string | null;
  status_penanganan: "dalam_proses" | "dirujuk" | "selesai";
  sudah_simfoni: boolean;
  no_registrasi_simfoni: string | null;
  tanggal_input_simfoni: string | null;
  penginput_simfoni: string | null;
  alasan_belum_simfoni: string | null;
  hambatan: string | null;
};

export type Publikasi = {
  laporan_id: string;
  tanggal_publikasi: string;
  kegiatan: string | null;
  platform: string;
  nama_akun: string | null;
  link_publikasi: string;
  file_publikasi: string | null;
};

export type Laporan = {
  id: string;
  jenis_laporan: JenisLaporan;
  status: "draf" | "terkirim" | "terverifikasi";
  sumber_input: "form_internal" | "google_form";
  link_dokumentasi: string | null;
  submitted_at: string | null;
  pos_sapa: {
    id: string;
    nama_lokasi: string;
    jenis_hunian: string | null;
    wilayah: { provinsi: string; kab_kota: string } | null;
  } | null;
  periode: {
    id: string;
    label: string;
    tanggal_mulai: string;
    tanggal_selesai: string;
  } | null;
  laporan_anak: Anak | null;
  laporan_perempuan: Perempuan | null;
  laporan_rekap_pengaduan: Rekap | null;
  laporan_kasus: Kasus | null;
  laporan_publikasi: Publikasi | null;
};

export type Filter = {
  periode?: string;
  provinsi?: string;
  kabkota?: string;
  lokasi?: string;
};

const SELECT = `
  id, jenis_laporan, status, sumber_input, link_dokumentasi, submitted_at,
  pos_sapa:pos_id (
    id, nama_lokasi, jenis_hunian,
    wilayah:wilayah_id ( provinsi, kab_kota )
  ),
  periode:periode_id ( id, label, tanggal_mulai, tanggal_selesai ),
  laporan_anak (*),
  laporan_perempuan (*),
  laporan_rekap_pengaduan (*),
  laporan_kasus (*),
  laporan_publikasi (*)
`;

/**
 * Ambil semua laporan non-draf, lalu saring di memori.
 * Skala data (≈4.700 baris/tahun) tidak membenarkan agregasi di SQL
 * yang jauh lebih rumit untuk mendukung filter dinamis.
 */
export async function ambilLaporan(filter: Filter = {}): Promise<Laporan[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("laporan")
    .select(SELECT)
    .neq("status", "draf")
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("[ambilLaporan]", error.message);
    return [];
  }

  const semua = (data ?? []) as unknown as Laporan[];

  return semua.filter((l) => {
    if (filter.periode && l.periode?.id !== filter.periode) return false;
    if (filter.provinsi && l.pos_sapa?.wilayah?.provinsi !== filter.provinsi)
      return false;
    if (filter.kabkota && l.pos_sapa?.wilayah?.kab_kota !== filter.kabkota)
      return false;
    if (filter.lokasi && l.pos_sapa?.id !== filter.lokasi) return false;
    return true;
  });
}

export async function ambilMasterData() {
  const supabase = await createClient();

  const [wilayahRes, posRes, periodeRes] = await Promise.all([
    supabase.from("wilayah").select("id, provinsi, kab_kota").order("provinsi"),
    supabase
      .from("pos_sapa")
      .select("id, nama_lokasi, wilayah_id")
      .eq("status_aktif", true)
      .order("nama_lokasi"),
    supabase
      .from("periode")
      .select("id, label, tanggal_mulai")
      .order("tanggal_mulai", { ascending: false }),
  ]);

  return {
    wilayah: wilayahRes.data ?? [],
    pos: posRes.data ?? [],
    periode: periodeRes.data ?? [],
  };
}

/** Terjemahkan searchParams menjadi filter yang tervalidasi. */
export function bacaFilter(
  params: Record<string, string | string[] | undefined>
): Filter {
  const satu = (v: string | string[] | undefined) =>
    typeof v === "string" && v !== "" && v !== "ALL" ? v : undefined;

  return {
    periode: satu(params.periode),
    provinsi: satu(params.provinsi),
    kabkota: satu(params.kabkota),
    lokasi: satu(params.lokasi),
  };
}
