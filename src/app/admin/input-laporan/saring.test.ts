import { describe, expect, it } from "vitest";
import type { ChecklistPos } from "@/lib/data/kepatuhan";
import { bacaFilter, ringkas, saringPos } from "./saring";

function pos(
  nama: string,
  opsi: Partial<ChecklistPos> & { status?: ChecklistPos["status"] } = {}
): ChecklistPos {
  return {
    pos_id: opsi.pos_id ?? nama.toLowerCase().replace(/\s+/g, "-"),
    nama_lokasi: nama,
    jenis_hunian: opsi.jenis_hunian ?? "huntap",
    jenis_hunian_lainnya: null,
    kab_kota: opsi.kab_kota ?? "Kota A",
    provinsi: opsi.provinsi ?? "Provinsi X",
    status: opsi.status ?? [],
    selesai: opsi.selesai ?? 0,
  };
}

const s = (jenis: string, status: ChecklistPos["status"][number]["status"]) => ({
  jenis: jenis as ChecklistPos["status"][number]["jenis"],
  status,
  diperbarui: null,
  catatanBukaKunci: null,
});

describe("bacaFilter", () => {
  it("mengabaikan nilai kosong dan ALL", () => {
    expect(
      bacaFilter({ provinsi: "", kabkota: "ALL", lokasi: undefined })
    ).toEqual({});
  });

  it("menormalkan kata cari ke huruf kecil dan memangkas spasi", () => {
    expect(bacaFilter({ cari: "  Huntap  " }).cari).toBe("huntap");
  });
});

describe("saringPos", () => {
  const daftar = [
    pos("Huntap Merauke", { provinsi: "Papua Selatan", kab_kota: "Merauke" }),
    pos("Huntara Jayapura", {
      provinsi: "Papua",
      kab_kota: "Jayapura",
      jenis_hunian: "huntara",
    }),
    pos("Dinas PPPA Nabire", {
      provinsi: "Papua Tengah",
      kab_kota: "Nabire",
      jenis_hunian: "dinas_pppa",
    }),
  ];

  it("mengembalikan semua baris tanpa filter", () => {
    expect(saringPos(daftar, {})).toHaveLength(3);
  });

  it("menyaring bertingkat provinsi → kab/kota", () => {
    expect(saringPos(daftar, { provinsi: "Papua" })).toHaveLength(1);
    expect(
      saringPos(daftar, { provinsi: "Papua", kabkota: "Merauke" })
    ).toHaveLength(0);
  });

  it("menyaring jenis tempat", () => {
    expect(saringPos(daftar, { jenis: "huntara" }).map((p) => p.nama_lokasi)).toEqual([
      "Huntara Jayapura",
    ]);
  });

  it("kata cari tidak peka huruf besar/kecil dan mengenai sebagian nama", () => {
    expect(saringPos(daftar, { cari: "dinas" })).toHaveLength(1);
    expect(saringPos(daftar, { cari: "DINAS" })).toHaveLength(1);
    expect(saringPos(daftar, { cari: "jayapura" })).toHaveLength(1);
  });

  it("kata cari hanya menyentuh nama lokasi, bukan provinsi/kabupaten", () => {
    // Wilayah punya dropdown sendiri; kotak cari yang ikut mencocokkan
    // provinsi akan membuat hasilnya sulit diduga saat filter wilayah aktif.
    expect(saringPos(daftar, { cari: "papua" })).toHaveLength(0);
  });

  it("jenis laporan tanpa status hanya meloloskan Pos yang sudah mengisi", () => {
    const denganLaporan = [
      pos("Sudah", { status: [s("publikasi", "terkirim")], selesai: 1 }),
      pos("Belum"),
    ];
    expect(
      saringPos(denganLaporan, { lap: "publikasi" }).map((p) => p.nama_lokasi)
    ).toEqual(["Sudah"]);
  });

  it("jenis laporan + status mencocokkan status persis, termasuk belum", () => {
    const campuran = [
      pos("Draf", { status: [s("publikasi", "draf")] }),
      pos("Kirim", { status: [s("publikasi", "terkirim")] }),
      pos("Kosong"),
    ];
    expect(saringPos(campuran, { lap: "publikasi", status: "draf" })).toHaveLength(1);
    expect(
      saringPos(campuran, { lap: "publikasi", status: "belum" }).map(
        (p) => p.nama_lokasi
      )
    ).toEqual(["Kosong"]);
  });

  it("status tanpa jenis laporan tidak menyaring apa pun (tak bermakna)", () => {
    expect(saringPos(daftar, { status: "belum" })).toHaveLength(3);
  });

  it("filter yang saling bertentangan menghasilkan daftar kosong, bukan galat", () => {
    expect(
      saringPos(daftar, { provinsi: "Papua", jenis: "dinas_pppa" })
    ).toHaveLength(0);
  });
});

describe("ringkas", () => {
  it("target dihitung dari kelima jenis per Pos, bukan dari jenis yang disorot", () => {
    const terpilih = [pos("A", { selesai: 2 }), pos("B", { selesai: 0 })];
    expect(ringkas(terpilih)).toEqual({ jumlahPos: 2, selesai: 2, target: 10 });
  });

  it("daftar kosong menghasilkan nol, bukan NaN", () => {
    expect(ringkas([])).toEqual({ jumlahPos: 0, selesai: 0, target: 0 });
  });
});
