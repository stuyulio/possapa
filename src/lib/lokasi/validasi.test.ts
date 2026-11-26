import { describe, expect, it } from "vitest";
import { validasiMasukanLokasi } from "./validasi";
import { labelJenisHunian } from "./jenis-hunian";

const DASAR = { namaLokasi: "Pos SAPA Uji", statusAktif: true };

describe("validasiMasukanLokasi — jenis hunian", () => {
  it("menerima jenis hunian baru tanpa isian bebas", () => {
    for (const jenis of ["huntap", "huntara", "dinas_pppa", "uptd_pppa"] as const) {
      const { galat, nilai } = validasiMasukanLokasi({
        ...DASAR,
        jenisHunian: jenis,
      });
      expect(galat).toEqual({});
      expect(nilai.jenis_hunian).toBe(jenis);
      expect(nilai.jenis_hunian_lainnya).toBeNull();
    }
  });

  it("menyimpan isian bebas untuk Lainnya", () => {
    const { galat, nilai } = validasiMasukanLokasi({
      ...DASAR,
      jenisHunian: "lainnya",
      jenisHunianLainnya: "  Balai Desa  ",
    });
    expect(galat).toEqual({});
    expect(nilai.jenis_hunian).toBe("lainnya");
    expect(nilai.jenis_hunian_lainnya).toBe("Balai Desa");
  });

  it("menolak Lainnya tanpa keterangan", () => {
    // "Lainnya" tanpa penjelasan tidak memberi tahu apa pun kepada pembaca
    // dan tidak dapat dipakai memfilter data.
    for (const isi of ["", "   ", undefined]) {
      const { galat } = validasiMasukanLokasi({
        ...DASAR,
        jenisHunian: "lainnya",
        jenisHunianLainnya: isi,
      });
      expect(galat.jenisHunianLainnya).toMatch(/Sebutkan jenis hunian/);
    }
  });

  it("mengosongkan isian bebas bila jenisnya bukan Lainnya", () => {
    // Sisa ketikan dari pilihan sebelumnya tidak boleh ikut tersimpan.
    const { nilai } = validasiMasukanLokasi({
      ...DASAR,
      jenisHunian: "huntap",
      jenisHunianLainnya: "Balai Desa",
    });
    expect(nilai.jenis_hunian_lainnya).toBeNull();
  });

  it("menolak jenis hunian yang tidak dikenal", () => {
    const { galat } = validasiMasukanLokasi({
      ...DASAR,
      jenisHunian: "rumah_sakit" as never,
    });
    expect(galat.jenisHunian).toMatch(/salah satu jenis hunian/);
  });

  it("menerima jenis hunian kosong", () => {
    const { galat, nilai } = validasiMasukanLokasi(DASAR);
    expect(galat).toEqual({});
    expect(nilai.jenis_hunian).toBeNull();
    expect(nilai.jenis_hunian_lainnya).toBeNull();
  });
});

describe("labelJenisHunian", () => {
  it("memberi label yang dibaca manusia", () => {
    expect(labelJenisHunian("dinas_pppa")).toBe("Dinas PPPA");
    expect(labelJenisHunian("uptd_pppa")).toBe("UPTD PPPA");
    expect(labelJenisHunian("huntap")).toBe("Huntap");
  });

  it("menampilkan teks bebas untuk Lainnya, bukan kata 'Lainnya'", () => {
    expect(labelJenisHunian("lainnya", "Balai Desa")).toBe("Balai Desa");
  });

  it("kembali ke 'Lainnya' bila teks bebasnya kosong", () => {
    // Bisa terjadi pada data lama yang dibuat sebelum constraint ditegakkan.
    expect(labelJenisHunian("lainnya", "")).toBe("Lainnya");
    expect(labelJenisHunian("lainnya", null)).toBe("Lainnya");
  });

  it("mengembalikan null bila jenis belum diisi", () => {
    expect(labelJenisHunian(null)).toBeNull();
    expect(labelJenisHunian(undefined)).toBeNull();
  });
});
