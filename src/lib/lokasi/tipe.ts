/** Tipe bersama untuk form Kelola Lokasi Pos SAPA (admin pusat & petugas). */

export type HasilLokasi =
  | { sukses: true }
  | { sukses: false; pesan: string; galat?: Record<string, string> };

export type MasukanLokasi = {
  id?: string;
  /** Diabaikan pada aksi petugas — server memaksa wilayah petugas. */
  wilayahId?: string;
  namaLokasi: string;
  kodePos?: string;
  jenisHunian?: "huntap" | "huntara" | "";
  lat?: string;
  lng?: string;
  penanggungJawab?: string;
  statusAktif: boolean;
};

export type Lokasi = {
  id: string;
  wilayah_id: string;
  nama_lokasi: string;
  kode_pos: string | null;
  jenis_hunian: "huntap" | "huntara" | null;
  lat: number | null;
  lng: number | null;
  penanggung_jawab: string | null;
  status_aktif: boolean;
  jumlah_laporan: number;
};

export type WilayahRingkas = { id: string; provinsi: string; kab_kota: string };
