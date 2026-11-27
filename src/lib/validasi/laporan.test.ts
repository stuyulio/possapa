import { describe, expect, it } from "vitest";
import { galatPenerimaManfaat, validasi } from "./laporan";

const ANAK_DASAR = {
  jumlah_kegiatan: 1,
  kegiatan: [{ nama: "Ruang Sahabat Anak", jenis: ["Bermain Bersama"] }],
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

const PEREMPUAN_DASAR = {
  jumlah_kegiatan: 1,
  kegiatan: [{ nama: "Sekolah Perempuan Mandiri", jenis: "Pelatihan usaha" }],
  nama_kegiatan: "Sekolah Perempuan Mandiri",
  jenis_kegiatan: "Pelatihan usaha",
  total_ikut: 10,
  kepala_keluarga: 4,
  hamil: 2,
  menyusui: 3,
  lansia: 1,
  disabilitas: 1,
  manfaat: "",
};

describe("skemaPerempuan — hamil dan menyusui dipisah", () => {
  it("menerima angka yang saling tumpang tindih", () => {
    // Seorang perempuan dapat hamil sekaligus menyusui, jadi 2 + 3 = 5
    // peserta bukan berarti total harus 5; total tetap 10.
    const hasil = validasi("aktivitas_perempuan", PEREMPUAN_DASAR);
    expect(hasil.sukses).toBe(true);
  });

  it("menolak peserta hamil yang melebihi total", () => {
    const hasil = validasi("aktivitas_perempuan", {
      ...PEREMPUAN_DASAR,
      hamil: 11,
    });
    expect(hasil.sukses).toBe(false);
    if (!hasil.sukses) {
      expect(hasil.galat.hamil).toMatch(/melebihi total/);
    }
  });

  it("menolak peserta menyusui yang melebihi total", () => {
    const hasil = validasi("aktivitas_perempuan", {
      ...PEREMPUAN_DASAR,
      menyusui: 11,
    });
    expect(hasil.sukses).toBe(false);
    if (!hasil.sukses) {
      expect(hasil.galat.menyusui).toMatch(/melebihi total/);
    }
  });

  it("menolak isian berbentuk lama yang masih memakai hamil_menyusui", () => {
    // Bentuk isian pra-pemisahan tidak boleh lolos diam-diam: kolom gabungan
    // tidak dikenal, dan hamil/menyusui yang wajib menjadi kosong.
    const hasil = validasi("aktivitas_perempuan", {
      jumlah_kegiatan: 1,
      kegiatan: [{ nama: "Sekolah Perempuan Mandiri", jenis: "Pelatihan usaha" }],
      nama_kegiatan: "Sekolah Perempuan Mandiri",
      jenis_kegiatan: "Pelatihan usaha",
      total_ikut: 10,
      kepala_keluarga: 4,
      hamil_menyusui: 5,
      lansia: 1,
      disabilitas: 1,
      manfaat: "",
    });
    expect(hasil.sukses).toBe(false);
    if (!hasil.sukses) {
      expect(hasil.galat.hamil).toBeDefined();
      expect(hasil.galat.menyusui).toBeDefined();
    }
  });
});

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

describe("rincian kegiatan per jumlah kegiatan", () => {
  const ANAK_DUMMY = {
    ...ANAK_DASAR,
    usia_0_5: 4,
    usia_6_12: 10,
    usia_13_17: 6,
    laki_laki: 9,
    perempuan: 11,
  };

  it("menerima tiga kegiatan dengan nama dan jenis masing-masing", () => {
    const hasil = validasi("aktivitas_anak", {
      ...ANAK_DUMMY,
      jumlah_kegiatan: 3,
      kegiatan: [
        { nama: "Ruang Sahabat Anak", jenis: ["Edukasi"] },
        { nama: "Trauma Healing", jenis: ["Trauma Healing"] },
        { nama: "Bermain Bersama", jenis: ["Bermain Bersama"] },
      ],
    });
    expect(hasil.sukses).toBe(true);
  });

  it("menolak jumlah yang tidak sama dengan banyak kartu kegiatan", () => {
    // Angka jumlah kegiatan ikut dijumlahkan di dashboard; bila tidak cocok
    // dengan rinciannya, angka dan rincian menceritakan hal yang berbeda.
    const hasil = validasi("aktivitas_anak", {
      ...ANAK_DUMMY,
      jumlah_kegiatan: 3,
      kegiatan: [{ nama: "Ruang Sahabat Anak", jenis: ["Edukasi"] }],
    });
    expect(hasil.sukses).toBe(false);
    if (!hasil.sukses) {
      expect(hasil.galat.kegiatan).toMatch(/tidak sama/);
    }
  });

  it("menolak kegiatan tanpa nama", () => {
    const hasil = validasi("aktivitas_perempuan", {
      ...PEREMPUAN_DASAR,
      jumlah_kegiatan: 2,
      kegiatan: [
        { nama: "Sekolah Perempuan Mandiri", jenis: "Pelatihan usaha" },
        { nama: "   ", jenis: "Pengajian" },
      ],
    });
    expect(hasil.sukses).toBe(false);
    if (!hasil.sukses) {
      expect(hasil.galat["kegiatan.1.nama"]).toBeDefined();
    }
  });

  it("menolak kegiatan anak yang belum punya jenis", () => {
    // Jenis kegiatan tetap wajib, sekarang per kegiatan.
    const hasil = validasi("aktivitas_anak", {
      ...ANAK_DUMMY,
      jumlah_kegiatan: 1,
      kegiatan: [{ nama: "Ruang Sahabat Anak", jenis: [] }],
    });
    expect(hasil.sukses).toBe(false);
    if (!hasil.sukses) {
      expect(hasil.galat["kegiatan.0.jenis"]).toMatch(/minimal satu/);
    }
  });

  it("menolak laporan tanpa kartu kegiatan", () => {
    const hasil = validasi("aktivitas_anak", {
      ...ANAK_DUMMY,
      jumlah_kegiatan: 1,
      kegiatan: [],
    });
    expect(hasil.sukses).toBe(false);
  });
});

describe("skemaPublikasi — link penyimpanan dokumentasi", () => {
  const PUBLIKASI_DASAR = {
    tanggal_publikasi: "2026-11-12",
    kegiatan: "Dokumentasi Ruang Sahabat Anak",
    platform: "Instagram",
    nama_akun: "Dinas PPPA Kab. X",
    link_publikasi: "https://www.instagram.com/p/abc123/",
    file_publikasi: "",
  };

  it("menerima tautan penyimpanan https", () => {
    const hasil = validasi("publikasi", {
      ...PUBLIKASI_DASAR,
      file_publikasi: "https://drive.google.com/drive/folders/xyz",
    });
    expect(hasil.sukses).toBe(true);
  });

  it("menerima kolom penyimpanan yang dikosongkan", () => {
    // Opsional: kegiatan yang dokumentasinya belum diarsipkan tetap sah.
    const hasil = validasi("publikasi", PUBLIKASI_DASAR);
    expect(hasil.sukses).toBe(true);
    if (hasil.sukses) {
      expect((hasil.data as { file_publikasi?: string }).file_publikasi)
        .toBeUndefined();
    }
  });

  it("menolak tautan penyimpanan yang bukan https", () => {
    const hasil = validasi("publikasi", {
      ...PUBLIKASI_DASAR,
      file_publikasi: "https://drive.google.com/x http://dropbox.com/y",
    });
    expect(hasil.sukses).toBe(false);
  });

  it("menolak nama berkas lepas sebagai pengganti tautan", () => {
    // Data Google Form lama bisa berisi nama berkas; kiriman baru harus tautan.
    const hasil = validasi("publikasi", {
      ...PUBLIKASI_DASAR,
      file_publikasi: "dokumentasi-kegiatan.jpg",
    });
    expect(hasil.sukses).toBe(false);
    if (!hasil.sukses) {
      expect(hasil.galat.file_publikasi).toMatch(/https/);
    }
  });
});
