import { describe, expect, it } from "vitest";
import { galatPenerimaManfaat, validasi } from "./laporan";

const ANAK_DASAR = {
  jumlah_kegiatan: 1,
  nama_kegiatan: "Ruang Sahabat Anak",
  jenis_kegiatan: ["Bermain Bersama"],
  usia_0_5: 0,
  usia_6_12: 0,
  usia_13_17: 0,
  laki_laki: 0,
  perempuan: 0,
  disabilitas: 0,
  perlu_layanan_lanjutan: 0,
  temuan: "",
  tindak_lanjut: "",
};

describe("galatPenerimaManfaat", () => {
  it("mewajibkan minimal satu penerima manfaat", () => {
    // Kegiatan tanpa peserta membuat rasio penerima manfaat per kegiatan
    // menyesatkan.
    expect(
      galatPenerimaManfaat({
        usia_0_5: 0,
        usia_6_12: 0,
        usia_13_17: 0,
        laki_laki: 0,
        perempuan: 0,
      })
    ).toMatch(/wajib diisi/);
  });

  it("menerima kelompok yang memang kosong selama totalnya terisi", () => {
    // Tidak ada peserta usia 13–17 tahun dan tidak ada penyandang disabilitas
    // adalah keadaan yang sah — kolomnya boleh 0.
    expect(
      galatPenerimaManfaat({
        usia_0_5: 5,
        usia_6_12: 8,
        usia_13_17: 0,
        laki_laki: 6,
        perempuan: 7,
      })
    ).toBeNull();
  });

  it("menolak total usia yang berbeda dengan total jenis kelamin", () => {
    expect(
      galatPenerimaManfaat({
        usia_0_5: 5,
        usia_6_12: 8,
        usia_13_17: 0,
        laki_laki: 6,
        perempuan: 9,
      })
    ).toBe("Total per usia (13) harus sama dengan total per jenis kelamin (15)");
  });

  it("menolak rincian jenis kelamin tanpa rincian usia", () => {
    // Kedua rincian menghitung orang yang sama; kalau yang satu terisi dan
    // yang lain nol, salah satunya pasti belum diisi.
    expect(
      galatPenerimaManfaat({
        usia_0_5: 0,
        usia_6_12: 0,
        usia_13_17: 0,
        laki_laki: 3,
        perempuan: 4,
      })
    ).toMatch(/belum punya rincian usia/);
  });
});

describe("validasi aktivitas_anak", () => {
  it("menolak laporan dengan penerima manfaat kosong", () => {
    const hasil = validasi("aktivitas_anak", ANAK_DASAR);
    expect(hasil.sukses).toBe(false);
    if (!hasil.sukses) {
      // Kunci bagian, bukan nama kolom — formulir menampilkannya di kepala
      // bagian Penerima manfaat.
      expect(hasil.galat.penerima_manfaat).toMatch(/wajib diisi/);
    }
  });

  it("menerima laporan dengan total usia dan jenis kelamin yang cocok", () => {
    const hasil = validasi("aktivitas_anak", {
      ...ANAK_DASAR,
      usia_0_5: 4,
      usia_6_12: 10,
      usia_13_17: 6,
      laki_laki: 9,
      perempuan: 11,
    });
    expect(hasil.sukses).toBe(true);
  });

  it("menolak laporan dengan selisih total", () => {
    const hasil = validasi("aktivitas_anak", {
      ...ANAK_DASAR,
      usia_0_5: 4,
      usia_6_12: 10,
      usia_13_17: 6,
      laki_laki: 9,
      perempuan: 12,
    });
    expect(hasil.sukses).toBe(false);
    if (!hasil.sukses) {
      expect(hasil.galat.penerima_manfaat).toMatch(/harus sama/);
    }
  });

  it("tidak menerapkan aturan penerima manfaat ke jenis laporan lain", () => {
    // Rekap pengaduan boleh Nihil — semua hitungan 0.
    const hasil = validasi("rekap_pengaduan", {
      status_bulan: "Nihil",
      aduan_masuk: 0,
      kekerasan_perempuan: 0,
      kekerasan_anak: 0,
      non_kekerasan_perempuan: 0,
      non_kekerasan_anak: 0,
      sudah_ditindaklanjuti: 0,
      tercatat_simfoni: 0,
      tindak_lanjut_umum: "",
      pihak_terlibat: "",
    });
    expect(hasil.sukses).toBe(true);
  });
});
