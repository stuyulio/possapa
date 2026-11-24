import { describe, expect, it } from "vitest";
import { cariTumpangTindih, idTerlibat, type RentangPeriode } from "./periode";

const p = (
  id: string,
  mulai: string,
  selesai: string,
  label = id
): RentangPeriode => ({
  id,
  label,
  tanggal_mulai: mulai,
  tanggal_selesai: selesai,
});

describe("cariTumpangTindih", () => {
  it("mengembalikan kosong bila rentang berurutan tanpa irisan", () => {
    const hasil = cariTumpangTindih([
      p("a", "2026-11-01", "2026-11-07"),
      p("b", "2026-11-08", "2026-11-14"),
    ]);
    expect(hasil).toEqual([]);
  });

  it("mendeteksi irisan satu hari di ujung", () => {
    // Kasus persis temuan PRD §6.5: "2026-11" (1–30 Nov) beririsan dengan
    // "5 - 19 November 2026".
    const hasil = cariTumpangTindih([
      p("bulan", "2026-11-01", "2026-11-30"),
      p("pekan", "2026-11-05", "2026-11-19"),
    ]);
    expect(hasil).toHaveLength(1);
    expect(hasil[0].a.id).toBe("bulan");
    expect(hasil[0].b.id).toBe("pekan");
  });

  it("mendeteksi rentang yang tertelan sepenuhnya", () => {
    const hasil = cariTumpangTindih([
      p("luar", "2026-01-01", "2026-12-31"),
      p("dalam", "2026-06-01", "2026-06-30"),
    ]);
    expect(hasil).toHaveLength(1);
  });

  it("tidak menandai rentang identik milik id yang sama", () => {
    // Dua periode beririsan penuh tetap satu pasangan, bukan dua.
    const hasil = cariTumpangTindih([
      p("a", "2026-11-01", "2026-11-07"),
      p("b", "2026-11-01", "2026-11-07"),
    ]);
    expect(hasil).toHaveLength(1);
  });

  it("menghitung setiap pasangan pada rantai yang saling beririsan", () => {
    // Jendela 7 hari bergeser seperti data historis nyata: tiga pasangan.
    const hasil = cariTumpangTindih([
      p("a", "2026-10-23", "2026-10-29"),
      p("b", "2026-10-30", "2026-11-05"),
      p("c", "2026-11-01", "2026-11-07"),
      p("d", "2026-11-08", "2026-11-14"),
    ]);
    expect(hasil).toHaveLength(1);
    expect([hasil[0].a.id, hasil[0].b.id].sort()).toEqual(["b", "c"]);
  });

  it("mengembalikan kosong untuk daftar kosong atau satu periode", () => {
    expect(cariTumpangTindih([])).toEqual([]);
    expect(cariTumpangTindih([p("a", "2026-11-01", "2026-11-07")])).toEqual([]);
  });
});

describe("idTerlibat", () => {
  it("mengumpulkan id unik dari kedua sisi setiap pasangan", () => {
    const id = idTerlibat([
      { a: p("a", "2026-11-01", "2026-11-30"), b: p("b", "2026-11-05", "2026-11-19") },
      { a: p("b", "2026-11-05", "2026-11-19"), b: p("c", "2026-11-10", "2026-11-25") },
    ]);
    expect([...id].sort()).toEqual(["a", "b", "c"]);
  });

  it("mengembalikan himpunan kosong bila tidak ada tumpang tindih", () => {
    expect(idTerlibat([]).size).toBe(0);
  });
});
