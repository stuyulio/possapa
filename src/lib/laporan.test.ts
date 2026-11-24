import { describe, expect, it } from "vitest";
import { modeFormulir, terkunciUntukPetugas } from "./laporan";

describe("terkunciUntukPetugas", () => {
  it("mengunci laporan terkirim yang menunggu verifikasi", () => {
    // Inti perubahan: tanpa ini laporan di antrean /verifikasi masih dapat
    // diubah diam-diam oleh petugas.
    expect(terkunciUntukPetugas("terkirim")).toBe(true);
  });

  it("mengunci laporan terverifikasi", () => {
    expect(terkunciUntukPetugas("terverifikasi")).toBe(true);
  });

  it("tidak mengunci draf dan laporan yang belum ada", () => {
    expect(terkunciUntukPetugas("draf")).toBe(false);
    expect(terkunciUntukPetugas("belum")).toBe(false);
  });

  it("membuka kunci terkirim bila Admin sudah menulis alasan", () => {
    // Inilah satu-satunya jalur perbaikan setelah terkirim: Admin memanggil
    // bukaKunciLaporan, status kembali terkirim, catatan terisi.
    expect(terkunciUntukPetugas("terkirim", "Angka usia tidak cocok")).toBe(false);
  });

  it("menolak catatan kosong sebagai penanda buka kunci", () => {
    // bukaKunciLaporan wajib mengisi catatan; string kosong/spasi tidak boleh
    // diam-diam membuka kunci.
    expect(terkunciUntukPetugas("terkirim", "")).toBe(true);
    expect(terkunciUntukPetugas("terkirim", null)).toBe(true);
  });
});

describe("modeFormulir", () => {
  it("memilih baru untuk laporan yang belum pernah ada", () => {
    expect(modeFormulir("belum")).toBe("baru");
  });

  it("memilih draf saat masih ada draf tersimpan", () => {
    expect(modeFormulir("draf")).toBe("draf");
  });

  it("memilih ulang setelah kunci dibuka, bukan baru", () => {
    // Bedanya penting: "ulang" hanya menawarkan Kirim ulang, "baru" juga
    // menawarkan Simpan draf yang akan membuang alasan perbaikan Admin.
    expect(modeFormulir("terkirim", "Perbaiki jumlah korban")).toBe("ulang");
  });

  it("memilih lihat untuk laporan terkunci", () => {
    expect(modeFormulir("terkirim")).toBe("lihat");
    expect(modeFormulir("terverifikasi")).toBe("lihat");
    expect(modeFormulir("terverifikasi", "Dibuka")).toBe("lihat");
  });
});
