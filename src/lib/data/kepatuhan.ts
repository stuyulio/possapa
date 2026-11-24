import { createClient } from "@/lib/supabase/server";

export type JenisLaporan =
  | "aktivitas_anak"
  | "aktivitas_perempuan"
  | "rekap_pengaduan"
  | "tindak_lanjut_kasus"
  | "publikasi";

export const SEMUA_JENIS: JenisLaporan[] = [
  "aktivitas_anak",
  "aktivitas_perempuan",
  "rekap_pengaduan",
  "tindak_lanjut_kasus",
  "publikasi",
];

export type StatusSel = "lengkap" | "sebagian" | "belum" | "kosong";

export type BarisKepatuhan = {
  pos_id: string;
  nama_lokasi: string;
  kab_kota: string;
  provinsi: string;
  sel: Record<JenisLaporan, StatusSel>;
  jumlahTerkirim: number;
};

export type MatriksKepatuhan = {
  periode: { id: string; label: string } | null;
  daftarPeriode: { id: string; label: string }[];
  baris: BarisKepatuhan[];
  ringkasan: {
    totalPos: number;
    lengkap: number;
    sebagian: number;
    belum: number;
    persenLengkap: number;
  };
};

export async function ambilMatriks(periodeId?: string): Promise<MatriksKepatuhan> {
  const supabase = await createClient();

  const [periodeRes, posRes, laporanRes] = await Promise.all([
    supabase
      .from("periode")
      .select("id, label, tanggal_mulai")
      .order("tanggal_mulai", { ascending: false }),
    supabase
      .from("pos_sapa")
      .select("id, nama_lokasi, wilayah:wilayah_id ( provinsi, kab_kota )")
      .eq("status_aktif", true)
      .order("nama_lokasi"),
    supabase
      .from("laporan")
      .select("pos_id, periode_id, jenis_laporan, status"),
  ]);

  const daftarPeriode = (periodeRes.data ?? []) as {
    id: string;
    label: string;
    tanggal_mulai: string;
  }[];

  // Default: periode terbaru.
  const aktifId =
    periodeId && daftarPeriode.some((p) => p.id === periodeId)
      ? periodeId
      : daftarPeriode[0]?.id;

  const periodeAktif = daftarPeriode.find((p) => p.id === aktifId) ?? null;

  const pos = (posRes.data ?? []) as unknown as {
    id: string;
    nama_lokasi: string;
    wilayah: { provinsi: string; kab_kota: string } | null;
  }[];

  const laporan = (laporanRes.data ?? []) as {
    pos_id: string;
    periode_id: string;
    jenis_laporan: JenisLaporan;
    status: string;
  }[];

  // Hanya laporan terkirim/terverifikasi yang dihitung; draf tidak.
  const relevan = laporan.filter(
    (l) => l.periode_id === aktifId && l.status !== "draf"
  );

  const baris: BarisKepatuhan[] = pos.map((p) => {
    const milikPos = relevan.filter((l) => l.pos_id === p.id);
    const jenisTerkirim = new Set(milikPos.map((l) => l.jenis_laporan));

    const sel = Object.fromEntries(
      SEMUA_JENIS.map((j) => [j, jenisTerkirim.has(j) ? "lengkap" : "belum"])
    ) as Record<JenisLaporan, StatusSel>;

    const jumlahTerkirim = SEMUA_JENIS.filter((j) => jenisTerkirim.has(j)).length;

    // "sebagian" bila terkirim tetapi belum kelima jenis.
    if (jumlahTerkirim > 0 && jumlahTerkirim < SEMUA_JENIS.length) {
      for (const j of SEMUA_JENIS) {
        if (sel[j] === "belum") sel[j] = "kosong";
      }
    }

    return {
      pos_id: p.id,
      nama_lokasi: p.nama_lokasi,
      kab_kota: p.wilayah?.kab_kota ?? "—",
      provinsi: p.wilayah?.provinsi ?? "—",
      sel,
      jumlahTerkirim,
    };
  });

  const lengkap = baris.filter((b) => b.jumlahTerkirim === SEMUA_JENIS.length).length;
  const belum = baris.filter((b) => b.jumlahTerkirim === 0).length;

  return {
    periode: periodeAktif ? { id: periodeAktif.id, label: periodeAktif.label } : null,
    daftarPeriode: daftarPeriode.map((p) => ({ id: p.id, label: p.label })),
    baris,
    ringkasan: {
      totalPos: baris.length,
      lengkap,
      sebagian: baris.length - lengkap - belum,
      belum,
      persenLengkap: baris.length
        ? Math.round((lengkap / baris.length) * 100)
        : 0,
    },
  };
}

export type ChecklistPos = {
  pos_id: string;
  nama_lokasi: string;
  jenis_hunian: string | null;
  status: {
    jenis: JenisLaporan;
    status: "draf" | "terkirim" | "terverifikasi" | "belum";
    diperbarui: string | null;
    /** Diisi Admin saat membuka kunci; dibaca petugas sebagai instruksi perbaikan. */
    catatanBukaKunci: string | null;
  }[];
  selesai: number;
};

export type Checklist = {
  periode: { id: string; label: string } | null;
  daftarPeriode: { id: string; label: string }[];
  pos: ChecklistPos[];
  ringkasan: { totalPos: number; lengkap: number; selesai: number };
};

/**
 * Checklist kelengkapan untuk semua Pos SAPA dalam satu wilayah.
 * Petugas mengelola beberapa lokasi dalam kabupaten/kotanya.
 */
export async function ambilChecklist(
  wilayahId: string,
  periodeId?: string
): Promise<Checklist> {
  const supabase = await createClient();

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

  const [posRes, laporanRes] = await Promise.all([
    supabase
      .from("pos_sapa")
      .select("id, nama_lokasi, jenis_hunian")
      .eq("wilayah_id", wilayahId)
      .eq("status_aktif", true)
      .order("nama_lokasi"),
    supabase
      .from("laporan")
      .select(
        "pos_id, jenis_laporan, status, periode_id, updated_at, catatan_buka_kunci"
      )
      .eq("periode_id", aktifId ?? "")
      .neq("status", "draf"),
  ]);

  const laporan = (laporanRes.data ?? []) as {
    pos_id: string;
    jenis_laporan: JenisLaporan;
    status: string;
    periode_id: string;
    updated_at: string;
    catatan_buka_kunci: string | null;
  }[];

  const pos = (posRes.data ?? []) as {
    id: string;
    nama_lokasi: string;
    jenis_hunian: string | null;
  }[];

  const daftar: ChecklistPos[] = pos.map((p) => {
    const milikPos = laporan.filter((l) => l.pos_id === p.id);
    const status = SEMUA_JENIS.map((j) => {
      const ada = milikPos.find((l) => l.jenis_laporan === j);
      return {
        jenis: j,
        status: (ada?.status ?? "belum") as
          | "draf"
          | "terkirim"
          | "terverifikasi"
          | "belum",
        diperbarui: ada?.updated_at ?? null,
        catatanBukaKunci: ada?.catatan_buka_kunci ?? null,
      };
    });
    return {
      pos_id: p.id,
      nama_lokasi: p.nama_lokasi,
      jenis_hunian: p.jenis_hunian,
      status,
      selesai: status.filter(
        (s) => s.status === "terkirim" || s.status === "terverifikasi"
      ).length,
    };
  });

  return {
    periode: daftarPeriode.find((p) => p.id === aktifId) ?? null,
    daftarPeriode: daftarPeriode.map((p) => ({ id: p.id, label: p.label })),
    pos: daftar,
    ringkasan: {
      totalPos: daftar.length,
      lengkap: daftar.filter((d) => d.selesai === SEMUA_JENIS.length).length,
      selesai: daftar.reduce((a, d) => a + d.selesai, 0),
    },
  };
}
