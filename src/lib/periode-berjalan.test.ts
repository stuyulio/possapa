import { describe, expect, it } from "vitest";
import {
  peringatanPeriode,
  ringkasPeriodeBerjalan,
  statusPeriode,
  tanggalJakarta,
} from "./periode-berjalan";

const p = (id: string, mulai: string, selesai: string) => ({
  id,
  label: `${mulai} s/d ${selesai}`,
  tanggal_mulai: mulai,
  tanggal_selesai: selesai,
});

describe("tanggalJakarta", () => {
  it("memakai tanggal WIB, bukan UTC", () => {
    // 2026-11-28T17:30Z = 29 November 00.30 WIB.
    expect(tanggalJakarta(new Date("2026-11-28T17:30:00Z"))).toBe("2026-11-29");
  });

  it("tidak memajukan tanggal saat WIB masih sore", () => {
    // 2026-11-28T10:00Z = 17.00 WIB, tanggal sama.
    expect(tanggalJakarta(new Date("2026-11-28T10:00:00Z"))).toBe("2026-11-28");
  });

  it("dini hari UTC yang masih tanggal lama di WIB dibaca benar", () => {
    // 2026-11-28T23:00Z = 29 November 06.00 WIB.
    expect(tanggalJakarta(new Date("2026-11-28T23:00:00Z"))).toBe("2026-11-29");
    // 2026-11-29T16:00Z = 29 November 23.00 WIB — masih tanggal yang sama.
    expect(tanggalJakarta(new Date("2026-11-29T16:00:00Z"))).toBe("2026-11-29");
  });
});

describe("statusPeriode", () => {
  const periode = p("w6", "2026-11-27", "2026-12-03");

  it("berjalan pada hari pertama, termasuk batasnya", () => {
    expect(statusPeriode(periode, "2026-11-27")).toBe("berjalan");
  });

  it("berjalan pada hari terakhir, termasuk batasnya", () => {
    expect(statusPeriode(periode, "2026-12-03")).toBe("berjalan");
  });

  it("lewat sehari setelah selesai", () => {
    expect(statusPeriode(periode, "2026-12-04")).toBe("lewat");
  });

  it("belum sehari sebelum mulai", () => {
    expect(statusPeriode(periode, "2026-11-26")).toBe("belum");
  });
});

describe("ringkasPeriodeBerjalan", () => {
  const daftar = [
    p("w5", "2026-11-20", "2026-11-26"),
    p("w6", "2026-11-27", "2026-12-03"),
    p("w7", "2026-12-04", "2026-12-10"),
  ];

  it("menemukan periode berjalan dan status setiap periode", () => {
    const hasil = ringkasPeriodeBerjalan(daftar, "2026-11-28");
    expect(hasil.berjalan?.id).toBe("w6");
    expect(hasil.status.get("w5")).toBe("lewat");
    expect(hasil.status.get("w7")).toBe("belum");
  });

  it("jeda antarperiode menghasilkan berjalan = null, bukan galat", () => {
    const hasil = ringkasPeriodeBerjalan(daftar, "2026-12-03T23:59:00".slice(0, 10));
    expect(hasil.berjalan?.id).toBe("w6");
  });

  it("tanggal di luar semua rentang", () => {
    expect(ringkasPeriodeBerjalan(daftar, "2027-01-01").berjalan).toBeNull();
  });
});

describe("peringatanPeriode", () => {
  const berjalan = p("w6", "2026-11-27", "2026-12-03");
  const hariIni = "2026-11-28";

  it("tidak bersuara saat periode yang dibuka adalah periode berjalan", () => {
    expect(peringatanPeriode(berjalan, berjalan, hariIni)).toBeNull();
  });

  it("tidak bersuara saat tidak ada periode berjalan (jeda antarperiode)", () => {
    expect(peringatanPeriode(p("w5", "2026-11-20", "2026-11-26"), null, hariIni)).toBeNull();
  });

  it("memperingatkan periode yang sudah berakhir", () => {
    const hasil = peringatanPeriode(p("w5", "2026-11-20", "2026-11-26"), berjalan, hariIni);
    expect(hasil?.jenis).toBe("lewat");
    expect(hasil?.teks).toContain("sudah berakhir");
  });

  it("memperingatkan periode yang belum dimulai", () => {
    const hasil = peringatanPeriode(p("w7", "2026-12-04", "2026-12-10"), berjalan, hariIni);
    expect(hasil?.jenis).toBe("belum");
    expect(hasil?.teks).toContain("belum dimulai");
  });

  it("menyebut label periode berjalan agar tidak perlu dicari sendiri", () => {
    const hasil = peringatanPeriode(p("w5", "2026-11-20", "2026-11-26"), berjalan, hariIni);
    expect(hasil?.teks).toContain(berjalan.label);
  });
});
