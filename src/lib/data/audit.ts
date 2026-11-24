import { createClient } from "@/lib/supabase/server";

export type AksiAudit = "tambah" | "ubah" | "hapus";

export type Perubahan = {
  sebelum?: Record<string, unknown>;
  sesudah?: Record<string, unknown>;
};

export type BarisAudit = {
  id: number;
  entitas: string;
  entitas_id: string;
  aksi: AksiAudit;
  perubahan: Perubahan | null;
  waktu: string;
  aktor: string | null;
  /** Keterangan manusiawi untuk entitas_id — UUID mentah tak berarti bagi admin. */
  label: string | null;
};

export type LogAudit = {
  baris: BarisAudit[];
  ringkasan: { tambah: number; ubah: number; hapus: number; total: number };
  /** Entitas yang muncul pada jendela ini, untuk pilihan filter. */
  daftarEntitas: string[];
  batas: number;
  galat: string | null;
};

const BATAS = 150;

export const LABEL_ENTITAS: Record<string, string> = {
  laporan: "Laporan (induk)",
  laporan_anak: "Rincian aktivitas anak",
  laporan_perempuan: "Rincian aktivitas perempuan",
  laporan_rekap_pengaduan: "Rincian rekap pengaduan",
  laporan_kasus: "Rincian kasus",
  laporan_publikasi: "Rincian publikasi",
  pos_sapa: "Pos SAPA",
  pengguna: "Pengguna",
};

const JENIS_SINGKAT: Record<string, string> = {
  aktivitas_anak: "Aktivitas Anak",
  aktivitas_perempuan: "Aktivitas Perempuan",
  rekap_pengaduan: "Rekap Pengaduan",
  tindak_lanjut_kasus: "Tindak Lanjut Kasus",
  publikasi: "Publikasi",
};

/**
 * Log audit untuk Admin Pusat.
 *
 * Isinya ditulis oleh trigger database (migrasi Fase 4), bukan oleh server
 * action — sehingga perubahan lewat SQL Editor pun terekam. Baris dengan
 * aktor kosong berarti perubahan datang dari luar aplikasi (impor, SQL).
 *
 * `entitas_id` pada tabel detail berisi id laporan induknya, jadi labelnya
 * diselesaikan lewat satu kueri tambahan, bukan satu kueri per baris.
 */
export async function ambilLogAudit(f: {
  entitas?: string;
  aksi?: string;
  cari?: string;
} = {}): Promise<LogAudit> {
  const kosong: LogAudit = {
    baris: [],
    ringkasan: { tambah: 0, ubah: 0, hapus: 0, total: 0 },
    daftarEntitas: [],
    batas: BATAS,
    galat: null,
  };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...kosong, galat: "Sesi berakhir. Silakan masuk kembali." };
  }

  const { data: profil } = await supabase
    .from("pengguna")
    .select("peran")
    .eq("id", user.id)
    .maybeSingle();

  if (profil?.peran !== "admin_pusat") {
    return { ...kosong, galat: "Log audit hanya untuk Admin Pusat." };
  }

  // Daftar entitas diambil terpisah agar pilihan filter tetap lengkap
  // walaupun filter lain sedang aktif.
  const { data: dataEntitas } = await supabase
    .from("audit_log")
    .select("entitas")
    .limit(1000);

  const daftarEntitas = [
    ...new Set((dataEntitas ?? []).map((r) => r.entitas as string)),
  ].sort();

  let kueri = supabase
    .from("audit_log")
    .select("id, entitas, entitas_id, aksi, perubahan, waktu, aktor:aktor_id ( nama )")
    .order("waktu", { ascending: false })
    .limit(BATAS);

  if (f.entitas && f.entitas !== "ALL") kueri = kueri.eq("entitas", f.entitas);
  if (f.aksi && f.aksi !== "ALL") kueri = kueri.eq("aksi", f.aksi);
  if (f.cari) kueri = kueri.ilike("entitas_id", `%${f.cari}%`);

  const { data, error } = await kueri;

  if (error) {
    console.error("[ambilLogAudit]", error.message);
    return { ...kosong, daftarEntitas, galat: `Gagal membaca log: ${error.message}` };
  }

  type Mentah = {
    id: number;
    entitas: string;
    entitas_id: string;
    aksi: AksiAudit;
    perubahan: Perubahan | null;
    waktu: string;
    aktor: { nama: string } | null;
  };

  const mentah = (data ?? []) as unknown as Mentah[];

  const label = await selesaikanLabel(
    supabase,
    mentah.map((r) => ({ entitas: r.entitas, entitas_id: r.entitas_id }))
  );

  const baris: BarisAudit[] = mentah.map((r) => ({
    id: r.id,
    entitas: r.entitas,
    entitas_id: r.entitas_id,
    aksi: r.aksi,
    perubahan: r.perubahan,
    waktu: r.waktu,
    aktor: r.aktor?.nama ?? null,
    label: label.get(`${r.entitas}:${r.entitas_id}`) ?? null,
  }));

  return {
    baris,
    ringkasan: {
      tambah: baris.filter((b) => b.aksi === "tambah").length,
      ubah: baris.filter((b) => b.aksi === "ubah").length,
      hapus: baris.filter((b) => b.aksi === "hapus").length,
      total: baris.length,
    },
    daftarEntitas,
    batas: BATAS,
    galat: null,
  };
}

/**
 * Ubah id mentah menjadi keterangan yang bisa dibaca.
 * Satu kueri untuk semua laporan, satu untuk semua Pos SAPA.
 */
async function selesaikanLabel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rujukan: { entitas: string; entitas_id: string }[]
): Promise<Map<string, string>> {
  const peta = new Map<string, string>();

  const ENTITAS_LAPORAN = new Set([
    "laporan",
    "laporan_anak",
    "laporan_perempuan",
    "laporan_rekap_pengaduan",
    "laporan_kasus",
    "laporan_publikasi",
  ]);

  const idLaporan = [
    ...new Set(
      rujukan.filter((r) => ENTITAS_LAPORAN.has(r.entitas)).map((r) => r.entitas_id)
    ),
  ].filter(Boolean);

  const idPos = [
    ...new Set(
      rujukan
        .filter((r) => r.entitas === "pos_sapa")
        .map((r) => r.entitas_id)
    ),
  ].filter(Boolean);

  type BarisLaporan = {
    id: string;
    jenis_laporan: string;
    periode: { label: string } | null;
    pos_sapa: { nama_lokasi: string } | null;
  };

  type BarisPos = {
    id: string;
    nama_lokasi: string;
    wilayah: { kab_kota: string } | null;
  };

  if (idLaporan.length > 0) {
    const { data } = await supabase
      .from("laporan")
      .select(
        "id, jenis_laporan, periode:periode_id ( label ), pos_sapa:pos_id ( nama_lokasi )"
      )
      .in("id", idLaporan);

    for (const l of (data ?? []) as unknown as BarisLaporan[]) {
      const teks = [
        JENIS_SINGKAT[l.jenis_laporan] ?? l.jenis_laporan,
        l.pos_sapa?.nama_lokasi,
        l.periode?.label,
      ]
        .filter(Boolean)
        .join(" · ");
      peta.set(`laporan:${l.id}`, teks);
      // Baris detail memakai id laporan induknya sebagai entitas_id.
      for (const e of ENTITAS_LAPORAN) peta.set(`${e}:${l.id}`, teks);
    }
  }

  if (idPos.length > 0) {
    const { data } = await supabase
      .from("pos_sapa")
      .select("id, nama_lokasi, wilayah:wilayah_id ( kab_kota )")
      .in("id", idPos);

    for (const p of (data ?? []) as unknown as BarisPos[]) {
      peta.set(
        `pos_sapa:${p.id}`,
        p.wilayah ? `${p.nama_lokasi} · ${p.wilayah.kab_kota}` : p.nama_lokasi
      );
    }
  }

  return peta;
}
