import { createClient } from "@/lib/supabase/server";
import type {
  Anak,
  JenisLaporan,
  Kasus,
  Perempuan,
  Publikasi,
  Rekap,
} from "@/lib/data/laporan";

export type TingkatAnomali = "tinggi" | "sedang";

export type Anomali = {
  laporan_id: string;
  kode: string;
  tingkat: TingkatAnomali;
  keterangan: string;
};

export type BarisVerifikasi = {
  id: string;
  jenis_laporan: JenisLaporan;
  status: "terkirim" | "terverifikasi";
  sumber_input: "form_internal" | "google_form";
  submitted_at: string | null;
  verified_at: string | null;
  catatan_verifikasi: string | null;
  catatan_buka_kunci: string | null;
  link_dokumentasi: string | null;
  lokasi: {
    id: string;
    nama_lokasi: string;
    kab_kota: string;
    provinsi: string;
  } | null;
  periode: { id: string; label: string } | null;
  anomali: Anomali[];
  /** Admin Pusat boleh semua; Admin Kab/Kota hanya wilayahnya sendiri. */
  bolehUbah: boolean;
};

export type AntreanVerifikasi = {
  periode: { id: string; label: string } | null;
  daftarPeriode: { id: string; label: string }[];
  baris: BarisVerifikasi[];
  ringkasan: {
    menunggu: number;
    terverifikasi: number;
    beranomali: number;
    anomaliTinggi: number;
  };
  /** null = pengguna berhak; selain itu pesan alasan akses ditolak. */
  galatAkses: string | null;
};

const SELECT = `
  id, jenis_laporan, status, sumber_input, submitted_at, verified_at,
  catatan_verifikasi, catatan_buka_kunci, link_dokumentasi,
  pos_sapa:pos_id (
    id, nama_lokasi, wilayah_id,
    wilayah:wilayah_id ( provinsi, kab_kota )
  ),
  periode:periode_id ( id, label )
`;

/**
 * Antrean verifikasi untuk satu periode.
 *
 * Admin Kab/Kota melihat laporan di wilayahnya, Admin Pusat melihat semua.
 * Pembatasan itu ditegakkan RLS di database; fungsi ini hanya menandai baris
 * mana yang boleh diubah (`bolehUbah`) supaya tombolnya tidak menyesatkan.
 *
 * Anomali dibaca dari view `anomali_laporan` — dihitung saat dibaca, jadi
 * tidak perlu disinkronkan saat data diperbaiki.
 */
export async function ambilAntreanVerifikasi(
  periodeId?: string
): Promise<AntreanVerifikasi> {
  const kosong: AntreanVerifikasi = {
    periode: null,
    daftarPeriode: [],
    baris: [],
    ringkasan: { menunggu: 0, terverifikasi: 0, beranomali: 0, anomaliTinggi: 0 },
    galatAkses: null,
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...kosong, galatAkses: "Sesi berakhir. Silakan masuk kembali." };
  }

  const { data: profil } = await supabase
    .from("pengguna")
    .select("peran, wilayah_id")
    .eq("id", user.id)
    .maybeSingle();

  const peran = profil?.peran ?? null;

  // Pimpinan hanya membaca; petugas memverifikasi lewat alur laporannya
  // sendiri — keduanya tidak punya kewenangan di sini.
  if (peran !== "admin_kabkota" && peran !== "admin_pusat") {
    return {
      ...kosong,
      galatAkses: "Verifikasi hanya untuk Admin Kab/Kota dan Admin Pusat.",
    };
  }

  const adminPusat = peran === "admin_pusat";
  const wilayahSaya = profil?.wilayah_id ?? null;

  const { data: dataPeriode } = await supabase
    .from("periode")
    .select("id, label, tanggal_mulai")
    .order("tanggal_mulai", { ascending: false });

  const daftarPeriode = (dataPeriode ?? []) as {
    id: string;
    label: string;
    tanggal_mulai: string;
  }[];

  const aktifId =
    periodeId && daftarPeriode.some((p) => p.id === periodeId)
      ? periodeId
      : daftarPeriode[0]?.id;

  if (!aktifId) {
    return { ...kosong, daftarPeriode: [] };
  }

  const [laporanRes, anomaliRes] = await Promise.all([
    supabase
      .from("laporan")
      .select(SELECT)
      .eq("periode_id", aktifId)
      .in("status", ["terkirim", "terverifikasi"])
      .order("submitted_at", { ascending: true }),
    supabase
      .from("anomali_laporan")
      .select("laporan_id, kode, tingkat, keterangan")
      .eq("periode_id", aktifId),
  ]);

  if (laporanRes.error) {
    console.error("[ambilAntreanVerifikasi]", laporanRes.error.message);
  }
  if (anomaliRes.error) {
    console.error("[ambilAntreanVerifikasi:anomali]", anomaliRes.error.message);
  }

  const anomaliPerLaporan = new Map<string, Anomali[]>();
  for (const a of (anomaliRes.data ?? []) as Anomali[]) {
    const ada = anomaliPerLaporan.get(a.laporan_id);
    if (ada) ada.push(a);
    else anomaliPerLaporan.set(a.laporan_id, [a]);
  }

  type Mentah = {
    id: string;
    jenis_laporan: JenisLaporan;
    status: "terkirim" | "terverifikasi";
    sumber_input: "form_internal" | "google_form";
    submitted_at: string | null;
    verified_at: string | null;
    catatan_verifikasi: string | null;
    catatan_buka_kunci: string | null;
    link_dokumentasi: string | null;
    pos_sapa: {
      id: string;
      nama_lokasi: string;
      wilayah_id: string | null;
      wilayah: { provinsi: string; kab_kota: string } | null;
    } | null;
    periode: { id: string; label: string } | null;
  };

  const baris: BarisVerifikasi[] = ((laporanRes.data ?? []) as unknown as Mentah[]).map(
    (l) => ({
      id: l.id,
      jenis_laporan: l.jenis_laporan,
      status: l.status,
      sumber_input: l.sumber_input,
      submitted_at: l.submitted_at,
      verified_at: l.verified_at,
      catatan_verifikasi: l.catatan_verifikasi,
      catatan_buka_kunci: l.catatan_buka_kunci,
      link_dokumentasi: l.link_dokumentasi,
      lokasi: l.pos_sapa
        ? {
            id: l.pos_sapa.id,
            nama_lokasi: l.pos_sapa.nama_lokasi,
            kab_kota: l.pos_sapa.wilayah?.kab_kota ?? "—",
            provinsi: l.pos_sapa.wilayah?.provinsi ?? "—",
          }
        : null,
      periode: l.periode,
      anomali: anomaliPerLaporan.get(l.id) ?? [],
      bolehUbah:
        adminPusat ||
        (peran === "admin_kabkota" &&
          wilayahSaya !== null &&
          l.pos_sapa?.wilayah_id === wilayahSaya),
    })
  );

  const beranomali = baris.filter((b) => b.anomali.length > 0);
  const periodeAktif = daftarPeriode.find((p) => p.id === aktifId) ?? null;

  return {
    periode: periodeAktif ? { id: periodeAktif.id, label: periodeAktif.label } : null,
    daftarPeriode: daftarPeriode.map((p) => ({ id: p.id, label: p.label })),
    baris,
    ringkasan: {
      menunggu: baris.filter((b) => b.status === "terkirim").length,
      terverifikasi: baris.filter((b) => b.status === "terverifikasi").length,
      beranomali: beranomali.length,
      anomaliTinggi: beranomali.filter((b) =>
        b.anomali.some((a) => a.tingkat === "tinggi")
      ).length,
    },
    galatAkses: null,
  };
}

/** Rincian satu laporan untuk dialog pratinjau. */
export type PratinjauLaporan = {
  id: string;
  jenis_laporan: JenisLaporan;
  status: "terkirim" | "terverifikasi";
  sumber_input: "form_internal" | "google_form";
  submitted_at: string | null;
  verified_at: string | null;
  catatan_verifikasi: string | null;
  catatan_buka_kunci: string | null;
  link_dokumentasi: string | null;
  lokasi: {
    id: string;
    nama_lokasi: string;
    jenis_hunian: string | null;
    jenis_hunian_lainnya: string | null;
    kab_kota: string;
    provinsi: string;
  } | null;
  periode: { id: string; label: string } | null;
  /** Baris tabel rincian sesuai `jenis_laporan`; null bila datanya hilang. */
  rincian:
    | { jenis: "aktivitas_anak"; data: Anak }
    | { jenis: "aktivitas_perempuan"; data: Perempuan }
    | { jenis: "rekap_pengaduan"; data: Rekap }
    | { jenis: "tindak_lanjut_kasus"; data: Kasus }
    | { jenis: "publikasi"; data: Publikasi }
    | null;
};

/** Kunci tabel rincian untuk tiap jenis laporan. */
const KUNCI_RINCIAN: Record<JenisLaporan, string> = {
  aktivitas_anak: "laporan_anak",
  aktivitas_perempuan: "laporan_perempuan",
  rekap_pengaduan: "laporan_rekap_pengaduan",
  tindak_lanjut_kasus: "laporan_kasus",
  publikasi: "laporan_publikasi",
};

/**
 * Rincian satu laporan untuk pratinjau saat baris diklik.
 *
 * Hanya laporan berstatus terkirim/terverifikasi yang dikembalikan: draf
 * belum pernah masuk antrean verifikasi, jadi tidak boleh terbaca lewat jalur
 * ini. Hak baca tetap ditentukan RLS — pemeriksaan peran di sini hanya agar
 * pengguna tahu alasannya, bukan agar kebijakan database bisa dilewati.
 */
export async function ambilPratinjauLaporan(
  laporanId: string
): Promise<{ data: PratinjauLaporan | null; pesan: string | null }> {
  if (!laporanId) return { data: null, pesan: "ID laporan tidak valid." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { data: null, pesan: "Sesi berakhir. Silakan masuk kembali." };

  const { data: profil } = await supabase
    .from("pengguna")
    .select("peran")
    .eq("id", user.id)
    .maybeSingle();

  if (profil?.peran !== "admin_kabkota" && profil?.peran !== "admin_pusat") {
    return {
      data: null,
      pesan: "Pratinjau hanya tersedia untuk Admin Kab/Kota dan Admin Pusat.",
    };
  }

  // Kelima tabel rincian diambil sekaligus: satu laporan hanya punya satu
  // baris rincian, tetapi memilih tabelnya di SQL berarti lima bentuk query.
  const { data, error } = await supabase
    .from("laporan")
    .select(
      `id, jenis_laporan, status, sumber_input, submitted_at, verified_at,
       catatan_verifikasi, catatan_buka_kunci, link_dokumentasi,
       pos_sapa:pos_id (
         id, nama_lokasi, jenis_hunian, jenis_hunian_lainnya,
         wilayah:wilayah_id ( provinsi, kab_kota )
       ),
       periode:periode_id ( id, label ),
       laporan_anak (*), laporan_perempuan (*), laporan_rekap_pengaduan (*),
       laporan_kasus (*), laporan_publikasi (*)`
    )
    .eq("id", laporanId)
    .in("status", ["terkirim", "terverifikasi"])
    .maybeSingle();

  if (error) {
    console.error("[ambilPratinjauLaporan]", error.message);
    return { data: null, pesan: "Rincian laporan gagal dimuat." };
  }

  if (!data) {
    return {
      data: null,
      pesan: "Laporan tidak ditemukan, belum dikirim, atau berada di luar wilayah Anda.",
    };
  }

  const mentah = data as unknown as Record<string, unknown> & MentahPratinjau;

  const rincian = (() => {
    const isi = mentah[KUNCI_RINCIAN[mentah.jenis_laporan]] as unknown;
    if (!isi) return null;
    switch (mentah.jenis_laporan) {
      case "aktivitas_anak":
        return { jenis: "aktivitas_anak" as const, data: isi as Anak };
      case "aktivitas_perempuan":
        return { jenis: "aktivitas_perempuan" as const, data: isi as Perempuan };
      case "rekap_pengaduan":
        return { jenis: "rekap_pengaduan" as const, data: isi as Rekap };
      case "tindak_lanjut_kasus":
        return { jenis: "tindak_lanjut_kasus" as const, data: isi as Kasus };
      case "publikasi":
        return { jenis: "publikasi" as const, data: isi as Publikasi };
      default:
        return null;
    }
  })();

  return {
    data: {
      id: mentah.id,
      jenis_laporan: mentah.jenis_laporan,
      status: mentah.status,
      sumber_input: mentah.sumber_input,
      submitted_at: mentah.submitted_at,
      verified_at: mentah.verified_at,
      catatan_verifikasi: mentah.catatan_verifikasi,
      catatan_buka_kunci: mentah.catatan_buka_kunci,
      link_dokumentasi: mentah.link_dokumentasi,
      lokasi: mentah.pos_sapa
        ? {
            id: mentah.pos_sapa.id,
            nama_lokasi: mentah.pos_sapa.nama_lokasi,
            jenis_hunian: mentah.pos_sapa.jenis_hunian,
            jenis_hunian_lainnya: mentah.pos_sapa.jenis_hunian_lainnya,
            kab_kota: mentah.pos_sapa.wilayah?.kab_kota ?? "—",
            provinsi: mentah.pos_sapa.wilayah?.provinsi ?? "—",
          }
        : null,
      periode: mentah.periode,
      rincian,
    },
    pesan: null,
  };
}

type MentahPratinjau = {
  id: string;
  jenis_laporan: JenisLaporan;
  status: "terkirim" | "terverifikasi";
  sumber_input: "form_internal" | "google_form";
  submitted_at: string | null;
  verified_at: string | null;
  catatan_verifikasi: string | null;
  catatan_buka_kunci: string | null;
  link_dokumentasi: string | null;
  pos_sapa: {
    id: string;
    nama_lokasi: string;
    jenis_hunian: string | null;
    jenis_hunian_lainnya: string | null;
    wilayah: { provinsi: string; kab_kota: string } | null;
  } | null;
  periode: { id: string; label: string } | null;
};

/**
 * Anomali satu laporan. Dipakai server action untuk memutuskan apakah catatan
 * wajib — keputusan ini tidak boleh bergantung pada data dari klien.
 */
export async function ambilAnomaliLaporan(laporanId: string): Promise<Anomali[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("anomali_laporan")
    .select("laporan_id, kode, tingkat, keterangan")
    .eq("laporan_id", laporanId);

  if (error) {
    console.error("[ambilAnomaliLaporan]", error.message);
    return [];
  }
  return (data ?? []) as Anomali[];
}
