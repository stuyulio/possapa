"use client";

import { Field, kelasField } from "./field";
import { PLATFORM } from "@/lib/validasi/laporan";

export type NilaiPublikasi = {
  tanggal_publikasi: string;
  kegiatan: string;
  platform: (typeof PLATFORM)[number];
  nama_akun: string;
  link_publikasi: string;
  file_publikasi: string;
};

export function FormPublikasi({
  nilai,
  ubah,
  galat,
}: {
  nilai: NilaiPublikasi;
  ubah: <K extends keyof NilaiPublikasi>(k: K, v: NilaiPublikasi[K]) => void;
  galat: Record<string, string>;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Tanggal publikasi" wajib galat={galat.tanggal_publikasi}>
          <input
            type="date"
            value={nilai.tanggal_publikasi}
            onChange={(e) => ubah("tanggal_publikasi", e.target.value)}
            className={kelasField(galat.tanggal_publikasi)}
          />
        </Field>

        <Field label="Platform media sosial" wajib galat={galat.platform}>
          <select
            value={nilai.platform}
            onChange={(e) =>
              ubah("platform", e.target.value as NilaiPublikasi["platform"])
            }
            className={kelasField(galat.platform)}
          >
            {PLATFORM.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Kegiatan yang dipublikasikan" wajib galat={galat.kegiatan}>
        <input
          type="text"
          value={nilai.kegiatan}
          onChange={(e) => ubah("kegiatan", e.target.value)}
          className={kelasField(galat.kegiatan)}
          placeholder="Contoh: Dokumentasi Ruang Sahabat Anak"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nama akun yang mempublikasikan" wajib galat={galat.nama_akun}>
          <input
            type="text"
            value={nilai.nama_akun}
            onChange={(e) => ubah("nama_akun", e.target.value)}
            className={kelasField(galat.nama_akun)}
            placeholder="Contoh: Dinas PPPA Kab. X"
          />
        </Field>

        <Field label="File publikasi" bantuan="Opsional">
          <input
            type="text"
            value={nilai.file_publikasi}
            onChange={(e) => ubah("file_publikasi", e.target.value)}
            className={kelasField(galat.file_publikasi)}
            placeholder="Nama berkas atau tautan"
          />
        </Field>
      </div>

      <Field
        label="Link publikasi"
        wajib
        galat={galat.link_publikasi}
        bantuan="URL lengkap, harus diawali https://"
      >
        <input
          type="url"
          value={nilai.link_publikasi}
          onChange={(e) => ubah("link_publikasi", e.target.value)}
          className={kelasField(galat.link_publikasi)}
          placeholder="https://www.instagram.com/p/..."
        />
      </Field>
    </div>
  );
}
