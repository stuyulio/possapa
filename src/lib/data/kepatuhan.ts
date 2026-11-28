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
  daftarPeriode: {
    id: string;
    label: string;
    tanggal_mulai: string;
    tanggal_selesai: string;
  }[];
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
      .select("id, label, tanggal_mulai, tanggal_selesai")
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
    tanggal_selesai: string;
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
    daftarPeriode: daftarPeriode.map((p) => ({
      id: p.id,
      label: p.label,
      tanggal_mulai: p.tanggal_mulai,
      tanggal_selesai: p.tanggal_selesai,
    })),
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

/**
 * Urutan kekuatan status untuk memilih satu baris wakil dari beberapa baris
 * jenis yang sama. Publikasi adalah satu-satunya jenis yang boleh berbaris
 * lebih dari satu; "belum" ikut di sini hanya agar perbandingannya lengkap.
 */
function urutanStatus(status: string): number {
  return { belum: 0, draf: 1, terkirim: 2, terverifikasi: 3 }[status] ?? -1;
}

export type ChecklistPos = {
  pos_id: string;
  nama_lokasi: string;
  jenis_hunian: string | null;
  jenis_hunian_lainnya: string | null;
  /** Hanya diisi pada daftar lintas wilayah; null saat dipersempit ke satu wilayah. */
  kab_kota: string | null;
  provinsi: string | null;
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
  periode: {
    id: string;
    label: string;
    tanggal_mulai: string;
    tanggal_selesai: string;
  } | null;
  /**
   * Tanggal ikut dibawa supaya halaman dapat menandai periode mana yang
   * sedang berjalan. Label saja tidak cukup — label adalah teks yang
   * dibangun database dan tidak dapat dibandingkan dengan hari ini.
   */
  daftarPeriode: {
    id: string;
    label: string;
    tanggal_mulai: string;
    tanggal_selesai: string;
  }[];
  pos: ChecklistPos[];
  ringkasan: { totalPos: number; lengkap: number; selesai: number };
};

/**
 * Checklist kelengkapan Pos SAPA untuk satu periode.
 *
 * - `wilayahId` berupa uuid  → hanya Pos SAPA di wilayah itu (Petugas).
 * - `wilayahId` null        → seluruh Pos SAPA lintas wilayah (Admin Pusat),
 *                             lengkap dengan nama kab/kota untuk ditampilkan.
 *
 * `sertakanDraf` ikut mengambil laporan berstatus draf. Petugas tidak
 * membutuhkannya (draf pertamanya baru muncul setelah dikirim), tetapi Admin
 * Pusat perlu melihatnya: simpanan yang tertahan karena anomali tetap tersimpan
 * sebagai draf, dan tanpa ini selnya akan tampak "Belum" padahal datanya ada.
 * Hitungan `selesai` tetap hanya terkirim/terverifikasi.
 */
export async function ambilChecklist(
  wilayahId: string | null,
  periodeId?: string,
  opsi?: { sertakanDraf?: boolean }
): Promise<Checklist> {
  const supabase = await createClient();

  const { data: dataPeriode } = await supabase
    .from("periode")
    .select("id, label, tanggal_mulai, tanggal_selesai")
    .order("tanggal_mulai", { ascending: false });

  const daftarPeriode = (dataPeriode ?? []) as {
    id: string;
    label: string;
    tanggal_mulai: string;
    tanggal_selesai: string;
  }[];

  const aktifId =
    periodeId && daftarPeriode.some((p) => p.id === periodeId)
      ? periodeId
      : daftarPeriode[0]?.id;

  // Query dibangun bertahap, bukan dipecah dua fungsi: aturan status di bawah
  // harus tetap satu tempat, dan hanya cakupan wilayah yang berbeda.
  const posQuery = supabase
    .from("pos_sapa")
    .select(
      "id, nama_lokasi, jenis_hunian, jenis_hunian_lainnya, wilayah:wilayah_id ( provinsi, kab_kota )"
    )
    .eq("status_aktif", true)
    .order("nama_lokasi");

  const laporanQuery = supabase
    .from("laporan")
    .select(
      "pos_id, jenis_laporan, status, periode_id, updated_at, catatan_buka_kunci"
    )
    .eq("periode_id", aktifId ?? "");

  const [posRes, laporanRes] = await Promise.all([
    wilayahId ? posQuery.eq("wilayah_id", wilayahId) : posQuery,
    opsi?.sertakanDraf ? laporanQuery : laporanQuery.neq("status", "draf"),
  ]);

  const laporan = (laporanRes.data ?? []) as {
    pos_id: string;
    jenis_laporan: JenisLaporan;
    status: string;
    periode_id: string;
    updated_at: string;
    catatan_buka_kunci: string | null;
  }[];

  const pos = (posRes.data ?? []) as unknown as {
    id: string;
    nama_lokasi: string;
    jenis_hunian: string | null;
    jenis_hunian_lainnya: string | null;
    wilayah: { provinsi: string; kab_kota: string } | null;
  }[];

  const daftar: ChecklistPos[] = pos.map((p) => {
    const milikPos = laporan.filter((l) => l.pos_id === p.id);
    const status = SEMUA_JENIS.map((j) => {
      // Publikasi boleh lebih dari satu baris. `.find()` akan memilih baris
      // acak untuk status checklist — di sini yang diambil status TERKUAT,
      // sama seperti di /input: satu Pos dianggap sudah melapor publikasi bila
      // minimal satu publikasinya terkirim.
      const milikJenis = milikPos.filter((l) => l.jenis_laporan === j);
      const ada =
        j === "publikasi"
          ? milikJenis.sort(
              (a, b) => urutanStatus(b.status) - urutanStatus(a.status)
            )[0]
          : milikJenis[0];
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
      jenis_hunian_lainnya: p.jenis_hunian_lainnya,
      kab_kota: p.wilayah?.kab_kota ?? null,
      provinsi: p.wilayah?.provinsi ?? null,
      status,
      selesai: status.filter(
        (s) => s.status === "terkirim" || s.status === "terverifikasi"
      ).length,
    };
  });

  // Lintas wilayah: urutkan provinsi → kab/kota → lokasi supaya Pos yang
  // berdekatan muncul berdekatan. Di satu wilayah urutannya sudah seragam
  // (satu kab/kota), jadi pengurutan ini tidak mengubah apa pun bagi petugas.
  if (!wilayahId) {
    daftar.sort(
      (a, b) =>
        (a.provinsi ?? "").localeCompare(b.provinsi ?? "") ||
        (a.kab_kota ?? "").localeCompare(b.kab_kota ?? "") ||
        a.nama_lokasi.localeCompare(b.nama_lokasi)
    );
  }

  return {
    periode: daftarPeriode.find((p) => p.id === aktifId) ?? null,
    daftarPeriode: daftarPeriode.map((p) => ({
      id: p.id,
      label: p.label,
      tanggal_mulai: p.tanggal_mulai,
      tanggal_selesai: p.tanggal_selesai,
    })),
    pos: daftar,
    ringkasan: {
      totalPos: daftar.length,
      lengkap: daftar.filter((d) => d.selesai === SEMUA_JENIS.length).length,
      selesai: daftar.reduce((a, d) => a + d.selesai, 0),
    },
  };
}
