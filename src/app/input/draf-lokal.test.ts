import { describe, expect, it } from "vitest";
import {
  buangJenisDraf,
  gabungDraf,
  MAKS_PERIODE_DRAF,
  normalisasiDraf,
} from "./draf-lokal";

describe("normalisasiDraf", () => {
  it("memindahkan bentuk lama ke ember periode miliknya, bukan periode berjalan", () => {
    const lama = {
      periodeId: "p-oktober",
      data: { aktivitas_anak: { jumlah_kegiatan: 2 } },
    };
    expect(normalisasiDraf(lama)).toEqual({
      "p-oktober": { aktivitas_anak: { jumlah_kegiatan: 2 } },
    });
  });

  it("membaca bentuk baru apa adanya", () => {
    const baru = { perPeriode: { "p-nov": { publikasi: { platform: "X" } } } };
    expect(normalisasiDraf(baru)).toEqual(baru.perPeriode);
  });

  it("bentuk lama tanpa data tidak menjadi ember kosong yang mengaku berisi", () => {
    expect(normalisasiDraf({ periodeId: "p-1" })).toEqual({});
  });

  it("masukan rusak/asing menghasilkan objek kosong, bukan melempar", () => {
    expect(normalisasiDraf(null)).toEqual({});
    expect(normalisasiDraf("bukan json")).toEqual({});
    expect(normalisasiDraf({ periodeId: 5 })).toEqual({});
  });
});

describe("gabungDraf", () => {
  it("tidak menimpa draf periode lain saat periode baru diisi", () => {
    const lama = { "p-oktober": { publikasi: { platform: "IG" } } };
    const hasil = gabungDraf(lama, "p-november", {
      aktivitas_anak: { jumlah_kegiatan: 1 },
    });

    expect(hasil["p-oktober"]).toEqual({ publikasi: { platform: "IG" } });
    expect(hasil["p-november"]).toEqual({
      aktivitas_anak: { jumlah_kegiatan: 1 },
    });
  });

  it("menggabungkan jenis laporan dalam periode yang sama", () => {
    const hasil = gabungDraf(
      { p1: { publikasi: { platform: "IG" } } },
      "p1",
      { aktivitas_anak: { jumlah_kegiatan: 3 } }
    );
    expect(Object.keys(hasil.p1)).toEqual(["publikasi", "aktivitas_anak"]);
  });

  it("membatasi jumlah periode yang disimpan", () => {
    const banyak = Object.fromEntries(
      ["a", "b", "c", "d", "e"].map((k) => [k, { publikasi: { platform: k } }])
    );
    const hasil = gabungDraf(banyak, "baru", { publikasi: {} });

    expect(Object.keys(hasil)).toHaveLength(MAKS_PERIODE_DRAF);
    // Periode yang sedang diisi tidak boleh ikut terbuang.
    expect(hasil.baru).toBeDefined();
    expect(hasil.a).toBeUndefined();
  });

  it("ember periode berjalan bertahan meski ia kunci pertama", () => {
    const hasil = gabungDraf(
      { a: { publikasi: {} }, b: { publikasi: {} }, c: { publikasi: {} }, d: { publikasi: {} } },
      "a",
      { publikasi: { platform: "IG" } }
    );
    expect(Object.keys(hasil)).toHaveLength(MAKS_PERIODE_DRAF);
    expect(hasil.a.publikasi).toEqual({ platform: "IG" });
  });
});

describe("buangJenisDraf", () => {
  it("hanya membuang jenis yang terkirim", () => {
    const hasil = buangJenisDraf(
      { p1: { publikasi: {}, aktivitas_anak: {} } },
      "p1",
      "publikasi"
    );
    expect(hasil.p1).toEqual({ aktivitas_anak: {} });
  });

  it("membuang ember yang menjadi kosong", () => {
    const hasil = buangJenisDraf({ p1: { publikasi: {} } }, "p1", "publikasi");
    expect(hasil).toEqual({});
  });

  it("ember periode lain tidak disentuh", () => {
    const hasil = buangJenisDraf(
      { p1: { publikasi: {} }, p2: { publikasi: {} } },
      "p1",
      "publikasi"
    );
    expect(hasil.p2).toEqual({ publikasi: {} });
  });

  it("periode tanpa draf tidak mengubah apa pun", () => {
    const simpanan = { p1: { publikasi: {} } };
    expect(buangJenisDraf(simpanan, "p-tidak-ada", "publikasi")).toEqual(simpanan);
  });
});
