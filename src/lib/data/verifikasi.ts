import { createClient } from "@/lib/supabase/server";
import type { JenisLaporan } from "@/lib/data/laporan";

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
  catatan_verifikasi, catatan_buka_kunci,
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
