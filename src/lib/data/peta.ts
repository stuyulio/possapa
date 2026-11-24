import { createClient } from "@/lib/supabase/server";

/**
 * Data peta sebaran Pos SAPA (PRD §5.2, Fase 3).
 *
 * Satu titik = satu Pos SAPA. Status visual diturunkan dari kelengkapan
 * laporan pada periode aktif — bukan dari kolom tersimpan, supaya selalu
 * konsisten dengan Monitoring Pelaporan.
 */

export type StatusPeta = "melapor_lengkap" | "melapor_sebagian" | "belum_melapor" | "tanpa_koordinat";

export type TitikPeta = {
  id: string;
  nama_lokasi: string;
  kode_pos: string | null;
  jenis_hunian: string | null;
  status_aktif: boolean;
  lat: number | null;
  lng: number | null;
  provinsi: string;
  kab_kota: string;
  status: StatusPeta;
  jenisTerkirim: number;
  periodeTerakhir: string | null;
  penerimaManfaat: number;
};

export type PetaData = {
  periode: { id: string; label: string } | null;
  daftarPeriode: { id: string; label: string }[];
  titik: TitikPeta[];
  ringkasan: {
    total: number;
    lengkap: number;
    sebagian: number;
    belum: number;
    tanpaKoordinat: number;
  };
};

const JUMLAH_JENIS = 5;

export async function ambilPeta(periodeId?: string): Promise<PetaData> {
  const supabase = await createClient();

  const [periodeRes, posRes, laporanRes] = await Promise.all([
    supabase
      .from("periode")
      .select("id, label, tanggal_mulai")
      .order("tanggal_mulai", { ascending: false }),
    supabase
      .from("pos_sapa")
      .select(
        "id, nama_lokasi, kode_pos, jenis_hunian, status_aktif, lat, lng, " +
          "wilayah:wilayah_id ( provinsi, kab_kota )"
      )
      .order("nama_lokasi"),
    supabase
      .from("laporan")
      .select("pos_id, periode_id, jenis_laporan, status, laporan_anak ( usia_0_5, usia_6_12, usia_13_17 ), laporan_perempuan ( total_ikut )")
      .neq("status", "draf"),
  ]);

  const daftarPeriode = (periodeRes.data ?? []) as {
    id: string;
    label: string;
    tanggal_mulai: string;
  }[];

  const aktifId =
    periodeId && daftarPeriode.some((p) => p.id === periodeId)
      ? periodeId
      : daftarPeriode[0]?.id;

  const periodeAktif = daftarPeriode.find((p) => p.id === aktifId) ?? null;

  const pos = (posRes.data ?? []) as unknown as {
    id: string;
    nama_lokasi: string;
    kode_pos: string | null;
    jenis_hunian: string | null;
    status_aktif: boolean;
    lat: number | null;
    lng: number | null;
    wilayah: { provinsi: string; kab_kota: string } | null;
  }[];

  const laporan = (laporanRes.data ?? []) as unknown as {
    pos_id: string;
    periode_id: string;
    jenis_laporan: string;
    status: string;
    laporan_anak: { usia_0_5: number; usia_6_12: number; usia_13_17: number } | null;
    laporan_perempuan: { total_ikut: number } | null;
  }[];

  // Kelompokkan per pos untuk menghitung status dan penerima manfaat.
  const perPos = new Map<string, typeof laporan>();
  for (const l of laporan) {
    const ada = perPos.get(l.pos_id);
    if (ada) ada.push(l);
    else perPos.set(l.pos_id, [l]);
  }

  const titik: TitikPeta[] = pos.map((p) => {
    const milik = perPos.get(p.id) ?? [];
    const periodeIni = milik.filter((l) => l.periode_id === aktifId);
    const jenisUnik = new Set(periodeIni.map((l) => l.jenis_laporan));

    let status: StatusPeta;
    if (p.lat === null || p.lng === null) status = "tanpa_koordinat";
    else if (jenisUnik.size === 0) status = "belum_melapor";
    else if (jenisUnik.size >= JUMLAH_JENIS) status = "melapor_lengkap";
    else status = "melapor_sebagian";

    // Penerima manfaat: akumulasi seluruh laporan non-draf yang ada.
    let penerima = 0;
    for (const l of milik) {
      if (l.laporan_anak) {
        penerima +=
          l.laporan_anak.usia_0_5 +
          l.laporan_anak.usia_6_12 +
          l.laporan_anak.usia_13_17;
      }
      if (l.laporan_perempuan) penerima += l.laporan_perempuan.total_ikut;
    }

    // Periode terakhir yang punya laporan untuk pos ini (daftarPeriode sudah
    // terurut dari yang terbaru, jadi elemen pertama adalah yang paling akhir).
    const terakhir = daftarPeriode.find((pr) =>
      milik.some((l) => l.periode_id === pr.id)
    );
    const periodeTerakhir = terakhir?.label ?? null;

    return {
      id: p.id,
      nama_lokasi: p.nama_lokasi,
      kode_pos: p.kode_pos,
      jenis_hunian: p.jenis_hunian,
      status_aktif: p.status_aktif,
      lat: p.lat,
      lng: p.lng,
      provinsi: p.wilayah?.provinsi ?? "—",
      kab_kota: p.wilayah?.kab_kota ?? "—",
      status,
      jenisTerkirim: jenisUnik.size,
      periodeTerakhir,
      penerimaManfaat: penerima,
    };
  });

  const hitung = (s: StatusPeta) => titik.filter((t) => t.status === s).length;

  return {
    periode: periodeAktif ? { id: periodeAktif.id, label: periodeAktif.label } : null,
    daftarPeriode: daftarPeriode.map((p) => ({ id: p.id, label: p.label })),
    titik,
    ringkasan: {
      total: titik.length,
      lengkap: hitung("melapor_lengkap"),
      sebagian: hitung("melapor_sebagian"),
      belum: hitung("belum_melapor"),
      tanpaKoordinat: hitung("tanpa_koordinat"),
    },
  };
}
