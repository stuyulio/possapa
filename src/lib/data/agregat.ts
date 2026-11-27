import type { Laporan, Anak, Kasus, Publikasi } from "./laporan";

export const JENIS_ANAK = [
  "Edukasi",
  "Trauma Healing",
  "Kegiatan Fisik",
  "Bermain Bersama",
  "Lainnya",
] as const;

export const PLATFORM = [
  "Instagram",
  "Facebook",
  "Tik Tok",
  "YouTube",
  "Website Resmi",
  "Lainnya",
] as const;

function kelompokPerWilayah(laporan: Laporan[]) {
  const map = new Map<
    string,
    { provinsi: string; kab_kota: string; jumlah: number }
  >();
  for (const l of laporan) {
    const w = l.pos_sapa?.wilayah;
    if (!w) continue;
    const kunci = `${w.provinsi}|${w.kab_kota}`;
    const ada = map.get(kunci);
    if (ada) ada.jumlah++;
    else
      map.set(kunci, {
        provinsi: w.provinsi,
        kab_kota: w.kab_kota,
        jumlah: 1,
      });
  }
  return [...map.values()].sort((a, b) => b.jumlah - a.jumlah);
}

export function agregatAnak(laporan: Laporan[]) {
  const anak = laporan
    .map((l) => l.laporan_anak)
    .filter((a): a is Anak => Boolean(a));

  let usia0_5 = 0, usia6_12 = 0, usia13_17 = 0;
  let laki = 0, perempuan = 0, disabilitas = 0, perluLanjutan = 0;
  let totalKegiatan = 0;
  const jenis = new Map<string, number>();
  const temuan: Array<{
    kab_kota: string;
    lokasi: string;
    temuan: string;
    tindak_lanjut: string | null;
    perlu: number;
  }> = [];

  for (const l of laporan) {
    const a = l.laporan_anak;
    if (!a) continue;
    usia0_5 += a.usia_0_5;
    usia6_12 += a.usia_6_12;
    usia13_17 += a.usia_13_17;
    laki += a.laki_laki;
    perempuan += a.perempuan;
    disabilitas += a.disabilitas;
    perluLanjutan += a.perlu_layanan_lanjutan;
    totalKegiatan += a.jumlah_kegiatan;

    for (const j of a.jenis_kegiatan ?? []) {
      const nama = JENIS_ANAK.includes(j as (typeof JENIS_ANAK)[number])
        ? j
        : "Lainnya";
      jenis.set(nama, (jenis.get(nama) ?? 0) + 1);
    }

    if (
      (a.perlu_layanan_lanjutan ?? 0) > 0 &&
      a.temuan &&
      a.temuan !== "-"
    ) {
      temuan.push({
        kab_kota: l.pos_sapa?.wilayah?.kab_kota ?? "—",
        lokasi: l.pos_sapa?.nama_lokasi ?? "—",
        temuan: a.temuan,
        tindak_lanjut: a.tindak_lanjut,
        perlu: a.perlu_layanan_lanjutan,
      });
    }
  }

  return {
    jumlahLaporan: anak.length,
    totalKegiatan,
    totalAnak: usia0_5 + usia6_12 + usia13_17,
    usia0_5, usia6_12, usia13_17,
    laki, perempuan, disabilitas,
    perluLanjutan,
    jenis: JENIS_ANAK.map((j) => ({ nama: j, jumlah: jenis.get(j) ?? 0 })),
    perWilayah: kelompokPerWilayah(laporan.filter((l) => l.laporan_anak)),
    temuan,
  };
}

export function agregatPerempuan(laporan: Laporan[]) {
  let totalKegiatan = 0, totalIkut = 0, kepalaKeluarga = 0;
  let hamil = 0, menyusui = 0, lansia = 0, disabilitas = 0;
  const jenis = new Map<string, number>();

  for (const l of laporan) {
    const p = l.laporan_perempuan;
    if (!p) continue;
    totalKegiatan += p.jumlah_kegiatan;
    totalIkut += p.total_ikut;
    kepalaKeluarga += p.kepala_keluarga;
    hamil += p.hamil;
    menyusui += p.menyusui;
    lansia += p.lansia;
    disabilitas += p.disabilitas;
    if (p.jenis_kegiatan) {
      const k = p.jenis_kegiatan.trim();
      jenis.set(k, (jenis.get(k) ?? 0) + 1);
    }
  }

  return {
    jumlahLaporan: laporan.filter((l) => l.laporan_perempuan).length,
    totalKegiatan,
    totalIkut,
    kepalaKeluarga,
    hamil,
    menyusui,
    lansia,
    disabilitas,
    jenisTerbanyak: [...jenis.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([nama, jumlah]) => ({ nama, jumlah })),
    perWilayah: kelompokPerWilayah(laporan.filter((l) => l.laporan_perempuan)),
  };
}

export function agregatPengaduan(laporan: Laporan[]) {
  let aduanMasuk = 0, kekPerempuan = 0, kekAnak = 0;
  let nonKekPerempuan = 0, nonKekAnak = 0;
  let ditindaklanjuti = 0, simfoni = 0;
  let laporanNihil = 0, laporanAdaAduan = 0;

  for (const l of laporan) {
    const r = l.laporan_rekap_pengaduan;
    if (!r) continue;
    aduanMasuk += r.aduan_masuk;
    kekPerempuan += r.kekerasan_perempuan;
    kekAnak += r.kekerasan_anak;
    nonKekPerempuan += r.non_kekerasan_perempuan;
    nonKekAnak += r.non_kekerasan_anak;
    ditindaklanjuti += r.sudah_ditindaklanjuti;
    simfoni += r.tercatat_simfoni;
    if (r.status_bulan === "Nihil") laporanNihil++;
    else laporanAdaAduan++;
  }

  return {
    jumlahLaporan: laporan.filter((l) => l.laporan_rekap_pengaduan).length,
    aduanMasuk, kekPerempuan, kekAnak,
    nonKekPerempuan, nonKekAnak,
    ditindaklanjuti, simfoni,
    laporanNihil, laporanAdaAduan,
    rincian: laporan
      .filter((l) => l.laporan_rekap_pengaduan)
      .map((l) => ({
        kab_kota: l.pos_sapa?.wilayah?.kab_kota ?? "—",
        provinsi: l.pos_sapa?.wilayah?.provinsi ?? "—",
        lokasi: l.pos_sapa?.nama_lokasi ?? "—",
        periode: l.periode?.label ?? "—",
        ...l.laporan_rekap_pengaduan!,
      })),
  };
}

export function agregatKasus(laporan: Laporan[]) {
  const kasus = laporan
    .map((l) => l.laporan_kasus)
    .filter((k): k is Kasus => Boolean(k));

  const perKategori = { kekerasan: 0, non_kekerasan: 0 };
  const perStatus = { dalam_proses: 0, dirujuk: 0, selesai: 0 };
  let korban = 0;

  for (const k of kasus) {
    perKategori[k.kategori]++;
    perStatus[k.status_penanganan]++;
    korban += k.jumlah_korban;
  }

  return {
    jumlahKasus: kasus.length,
    korban,
    perKategori,
    perStatus,
    rincian: laporan
      .filter((l) => l.laporan_kasus)
      .map((l) => ({
        kab_kota: l.pos_sapa?.wilayah?.kab_kota ?? "—",
        lokasi: l.pos_sapa?.nama_lokasi ?? "—",
        ...l.laporan_kasus!,
      }))
      .sort((a, b) => (a.tanggal_aduan < b.tanggal_aduan ? 1 : -1)),
  };
}

export function agregatPublikasi(laporan: Laporan[]) {
  const pub = laporan
    .map((l) => l.laporan_publikasi)
    .filter((p): p is Publikasi => Boolean(p));

  const platform = new Map<string, number>();
  const akun = new Map<string, number>();

  for (const p of pub) {
    const nama = PLATFORM.includes(p.platform as (typeof PLATFORM)[number])
      ? p.platform
      : "Lainnya";
    platform.set(nama, (platform.get(nama) ?? 0) + 1);
    if (p.nama_akun)
      akun.set(p.nama_akun, (akun.get(p.nama_akun) ?? 0) + 1);
  }

  return {
    jumlahPublikasi: pub.length,
    platform: PLATFORM.map((nama) => ({ nama, jumlah: platform.get(nama) ?? 0 })),
    akunTerbanyak: [...akun.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([nama, jumlah]) => ({ nama, jumlah })),
    daftar: laporan
      .filter((l) => l.laporan_publikasi)
      .map((l) => ({
        kab_kota: l.pos_sapa?.wilayah?.kab_kota ?? "—",
        lokasi: l.pos_sapa?.nama_lokasi ?? "—",
        ...l.laporan_publikasi!,
      }))
      .sort((a, b) => (a.tanggal_publikasi < b.tanggal_publikasi ? 1 : -1)),
  };
}

export function kelengkapanDokumentasi(laporan: Laporan[]) {
  const total = laporan.length;
  const ada = laporan.filter(
    (l) => l.link_dokumentasi && l.link_dokumentasi.trim() !== ""
  ).length;
  return { total, ada, persen: total ? Math.round((ada / total) * 100) : 0 };
}
