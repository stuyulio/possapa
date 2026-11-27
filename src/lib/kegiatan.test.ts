import { describe, expect, it } from "vitest";
import {
  gabungJenisAnak,
  gabungJenisPerempuan,
  kegiatanTampilAnak,
  kegiatanTampilPerempuan,
  potongKegiatan,
  rapikanKegiatanAnak,
  rapikanKegiatanPerempuan,
  ringkasNama,
} from "./kegiatan";

describe("rapikanKegiatanAnak", () => {
  it("memakai rincian yang tersimpan", () => {
    const hasil = rapikanKegiatanAnak({
      jumlah_kegiatan: 2,
      kegiatan: [
        { nama: "A", jenis: ["Edukasi"] },
        { nama: "B", jenis: ["Lainnya"] },
      ],
    });
    expect(hasil).toEqual([
      { nama: "A", jenis: ["Edukasi"] },
      { nama: "B", jenis: ["Lainnya"] },
    ]);
  });

  it("membaca laporan lama sebagai satu kegiatan dari kolom ringkasan", () => {
    // Baris sebelum 27 Nov 2026 dan hasil impor Google Form tidak punya
    // `kegiatan`; nama lamanya tidak boleh hilang.
    const hasil = rapikanKegiatanAnak({
      jumlah_kegiatan: 4,
      nama_kegiatan: "Ruang Sahabat Anak",
      jenis_kegiatan: ["Edukasi", "Bermain Bersama"],
    });
    expect(hasil[0]).toEqual({
      nama: "Ruang Sahabat Anak",
      jenis: ["Edukasi", "Bermain Bersama"],
    });
    // Tiga kartu kosong menyusul supaya jumlahnya sama dengan angka.
    expect(hasil).toHaveLength(4);
    expect(hasil.slice(1).every((k) => k.nama === "")).toBe(true);
  });

  it("mengisi kartu kosong sampai sebanyak jumlah kegiatan", () => {
    const hasil = rapikanKegiatanAnak({
      jumlah_kegiatan: 3,
      kegiatan: [{ nama: "A", jenis: ["Edukasi"] }],
    });
    expect(hasil).toHaveLength(3);
  });

  it("tidak menyembunyikan rincian yang lebih panjang daripada angkanya", () => {
    // Bentuk yang tidak konsisten tetap ditampilkan utuh; memotongnya akan
    // membuang isian yang pernah disimpan.
    const hasil = rapikanKegiatanAnak({
      jumlah_kegiatan: 1,
      kegiatan: [{ nama: "A", jenis: [] }, { nama: "B", jenis: [] }],
    });
    expect(hasil).toHaveLength(2);
  });

  it("bertahan pada bentuk kegiatan yang tak terduga", () => {
    const hasil = rapikanKegiatanAnak({
      jumlah_kegiatan: 1,
      kegiatan: "bukan larik",
    });
    expect(hasil).toHaveLength(1);
    expect(hasil[0]).toEqual({ nama: "", jenis: [] });
  });
});

describe("rapikanKegiatanPerempuan", () => {
  it("memakai jenis sebagai teks, bukan larik", () => {
    const hasil = rapikanKegiatanPerempuan({
      jumlah_kegiatan: 1,
      kegiatan: [{ nama: "Sekolah Perempuan", jenis: "Pelatihan usaha" }],
    });
    expect(hasil[0]).toEqual({
      nama: "Sekolah Perempuan",
      jenis: "Pelatihan usaha",
    });
  });

  it("membaca jenis berbentuk larik dari data lama", () => {
    const hasil = rapikanKegiatanPerempuan({
      jumlah_kegiatan: 1,
      kegiatan: [{ nama: "A", jenis: ["Pengajian", "Hidroponik"] }],
    });
    expect(hasil[0].jenis).toBe("Pengajian, Hidroponik");
  });
});

describe("potongKegiatan", () => {
  it("memotong kelebihan dan mengisi kekurangan", () => {
    const hasil = potongKegiatan(
      [{ nama: "A" }, { nama: "B" }, { nama: "C" }],
      2,
      () => ({ nama: "" })
    );
    expect(hasil).toEqual([{ nama: "A" }, { nama: "B" }]);
  });

  it("selalu menyisakan minimal satu kegiatan", () => {
    // Kolom jumlah yang dikosongkan bernilai 0; formulir tidak boleh kosong
    // tanpa satu pun kartu.
    const hasil = potongKegiatan([], 0, () => ({ nama: "" }));
    expect(hasil).toHaveLength(1);
  });
});

describe("ringkasan untuk kolom lama", () => {
  it("menggabungkan nama jadi satu teks", () => {
    expect(ringkasNama([{ nama: "A" }, { nama: "B" }, { nama: " " }])).toBe(
      "A; B"
    );
  });

  it("menggabungkan jenis anak tanpa duplikat", () => {
    expect(
      gabungJenisAnak([
        { nama: "A", jenis: ["Edukasi", "Lainnya"] },
        { nama: "B", jenis: ["Lainnya"] },
      ])
    ).toEqual(["Edukasi", "Lainnya"]);
  });

  it("menggabungkan jenis perempuan dengan pemisah titik koma", () => {
    expect(
      gabungJenisPerempuan([
        { nama: "A", jenis: "Pengajian" },
        { nama: "B", jenis: "Hidroponik, pelatihan usaha" },
        { nama: "C", jenis: "Pengajian" },
      ])
    ).toBe("Pengajian; Hidroponik, pelatihan usaha");
  });
});

describe("kegiatanTampil*", () => {
  it("tidak menampilkan baris pengisi kosong", () => {
    const hasil = kegiatanTampilAnak(
      null,
      "Ruang Sahabat Anak",
      ["Edukasi"]
    );
    expect(hasil).toHaveLength(1);
    expect(hasil[0].nama).toBe("Ruang Sahabat Anak");
  });

  it("menampilkan semua kegiatan bernama", () => {
    const hasil = kegiatanTampilPerempuan(
      [
        { nama: "A", jenis: "x" },
        { nama: "B", jenis: "y" },
      ],
      null,
      null
    );
    expect(hasil.map((k) => k.nama)).toEqual(["A", "B"]);
  });
});
