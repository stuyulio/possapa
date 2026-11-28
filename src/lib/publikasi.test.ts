import { describe, expect, it } from "vitest";
import { idPublikasiDibuang, petakanIdPublikasi } from "./publikasi";

const SAH = new Set(["a", "b", "c"]);

describe("petakanIdPublikasi", () => {
  it("memetakan id secara posisional", () => {
    expect(petakanIdPublikasi(["a", "b"], SAH, 2)).toEqual(["a", "b"]);
  });

  it("kartu pertama baru tidak menggeser id kartu kedua", () => {
    // Inilah bug yang dijaga: memadatkan daftar setelah menyaring akan
    // menempatkan "b" di indeks 0, lalu isian kartu pertama menimpa baris b.
    const hasil = petakanIdPublikasi(["", "b"], SAH, 2);
    expect(hasil).toEqual([null, "b"]);
    expect(hasil[0]).toBeNull();
  });

  it("id asing menjadi null, bukan menggeser atau membatalkan kiriman", () => {
    expect(petakanIdPublikasi(["a", "id-usang", "c"], SAH, 3)).toEqual([
      "a",
      null,
      "c",
    ]);
  });

  it("kartu yang belum punya id menjadi null", () => {
    expect(petakanIdPublikasi(["a"], SAH, 3)).toEqual(["a", null, null]);
  });

  it("id yang bukan string diabaikan", () => {
    expect(petakanIdPublikasi([null, 5, {}], SAH, 3)).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("kiriman tanpa idPublikasi menghasilkan semua null", () => {
    expect(petakanIdPublikasi(undefined, SAH, 2)).toEqual([null, null]);
  });
});

describe("idPublikasiDibuang", () => {
  it("membuang baris yang tidak dipakai lagi", () => {
    // Kartu yang dihapus: id "b" tidak muncul di kiriman.
    expect(idPublikasiDibuang(["a", "b", "c"], ["a", "c"])).toEqual(["b"]);
  });

  it("tidak membuang apa pun bila semua baris masih dipakai", () => {
    expect(idPublikasiDibuang(["a", "b"], ["a", "b"])).toEqual([]);
  });

  it("id null pada kartu baru tidak dianggap pemakaian", () => {
    expect(idPublikasiDibuang(["a"], [null, null])).toEqual(["a"]);
  });

  it("daftar kosong tetap aman", () => {
    expect(idPublikasiDibuang([], [])).toEqual([]);
  });
});
