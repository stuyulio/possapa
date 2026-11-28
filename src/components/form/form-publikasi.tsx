"use client";

import { Field, kelasField } from "./field";
import { MAX_PUBLIKASI, PLATFORM } from "@/lib/validasi/laporan";

/** Satu publikasi. Satu laporan boleh memuat beberapa. */
export type SatuPublikasi = {
  tanggal_publikasi: string;
  kegiatan: string;
  platform: (typeof PLATFORM)[number];
  nama_akun: string;
  link_publikasi: string;
  file_publikasi: string;
};

/**
 * Satu laporan publikasi = satu atau beberapa publikasi.
 *
 * `id` adalah id baris `laporan` lama untuk publikasi yang sudah tersimpan —
 * dipakai server agar baris itu dipakai ulang, bukan dibuat baru. Publikasi
 * yang baru ditambahkan di formulir belum punya `id`.
 *
 * Urutan daftar penting: `idPublikasi` dikirim sejajar dengan urutan ini, dan
 * server memakai ulang baris pada indeks yang sama.
 */
export type PublikasiBerbaris = SatuPublikasi & { id?: string };

export type NilaiPublikasi = {
  publikasi: PublikasiBerbaris[];
};

export function publikasiKosong(): SatuPublikasi {
  return {
    tanggal_publikasi: "",
    kegiatan: "",
    platform: "Instagram",
    nama_akun: "",
    link_publikasi: "",
    file_publikasi: "",
  };
}

export function FormPublikasi({
  nilai,
  ubah,
  galat,
  bacaSaja = false,
}: {
  nilai: NilaiPublikasi;
  ubah: (nilai: NilaiPublikasi) => void;
  galat: Record<string, string>;
  /** Laporan terkirim: tampilkan isinya, jangan biarkan diubah. */
  bacaSaja?: boolean;
}) {
  const daftar = nilai.publikasi ?? [];

  function ubahSatu(i: number, perubahan: Partial<SatuPublikasi>) {
    ubah({
      publikasi: daftar.map((p, idx) =>
        idx === i ? { ...p, ...perubahan } : p
      ),
    });
  }

  function tambah() {
    if (daftar.length >= MAX_PUBLIKASI) return;
    ubah({ publikasi: [...daftar, publikasiKosong()] });
  }

  function hapus(i: number) {
    ubah({ publikasi: daftar.filter((_, idx) => idx !== i) });
  }

  /** Galat milik satu kartu, dengan awalan indeks dari skema validasi. */
  const galatKartu = (i: number, kolom: keyof SatuPublikasi) =>
    galat[`publikasi.${i}.${kolom}`];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Daftar publikasi
          </p>
          <p className="text-[11px] text-slate-500">
            {daftar.length} publikasi
            {daftar.length > 1 ? " — satu baris dihitung satu publikasi" : ""}
          </p>
        </div>
        {!bacaSaja && (
          <button
            type="button"
            onClick={tambah}
            disabled={daftar.length >= MAX_PUBLIKASI}
            className="text-xs font-semibold text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-xl no-print"
          >
            + Tambah publikasi
          </button>
        )}
      </div>

      {galat.publikasi && (
        <p role="alert" className="text-[11px] text-rose-600 font-semibold">
          {galat.publikasi}
        </p>
      )}

      {daftar.map((p, i) => (
        <div
          key={p.id ?? `baru-${i}`}
          className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Publikasi {i + 1}
            </p>
            {/* Publikasi pertama tidak dapat dihapus: laporan publikasi wajib
                berisi minimal satu. Tombolnya disembunyikan, bukan dibuat
                gagal saat diklik. */}
            {!bacaSaja && daftar.length > 1 && (
              <button
                type="button"
                onClick={() => hapus(i)}
                className="text-[11px] font-semibold text-rose-700 hover:underline no-print"
              >
                Hapus
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Tanggal publikasi"
              wajib
              galat={galatKartu(i, "tanggal_publikasi")}
            >
              <input
                type="date"
                value={p.tanggal_publikasi}
                onChange={(e) =>
                  ubahSatu(i, { tanggal_publikasi: e.target.value })
                }
                readOnly={bacaSaja}
                className={kelasField(
                  galatKartu(i, "tanggal_publikasi"),
                  bacaSaja
                )}
              />
            </Field>

            <Field
              label="Platform media sosial"
              wajib
              galat={galatKartu(i, "platform")}
            >
              <select
                value={p.platform}
                onChange={(e) =>
                  ubahSatu(i, {
                    platform: e.target.value as SatuPublikasi["platform"],
                  })
                }
                disabled={bacaSaja}
                className={kelasField(galatKartu(i, "platform"), bacaSaja)}
              >
                {PLATFORM.map((pl) => (
                  <option key={pl} value={pl}>
                    {pl}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-3">
            <Field
              label="Kegiatan yang dipublikasikan"
              wajib
              galat={galatKartu(i, "kegiatan")}
            >
              <input
                type="text"
                value={p.kegiatan}
                onChange={(e) => ubahSatu(i, { kegiatan: e.target.value })}
                readOnly={bacaSaja}
                className={kelasField(galatKartu(i, "kegiatan"), bacaSaja)}
                placeholder="Contoh: Dokumentasi Ruang Sahabat Anak"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            <Field
              label="Nama akun yang mempublikasikan"
              wajib
              galat={galatKartu(i, "nama_akun")}
            >
              <input
                type="text"
                value={p.nama_akun}
                onChange={(e) => ubahSatu(i, { nama_akun: e.target.value })}
                readOnly={bacaSaja}
                className={kelasField(galatKartu(i, "nama_akun"), bacaSaja)}
                placeholder="Contoh: Dinas PPPA Kab. X"
              />
            </Field>

            <Field
              label="Link penyimpanan dokumentasi"
              galat={galatKartu(i, "file_publikasi")}
              bantuan="Opsional. Contoh: Google Drive, Dropbox, OneDrive — URL lengkap, harus diawali https://"
            >
              <input
                type="url"
                value={p.file_publikasi}
                onChange={(e) =>
                  ubahSatu(i, { file_publikasi: e.target.value })
                }
                readOnly={bacaSaja}
                className={kelasField(
                  galatKartu(i, "file_publikasi"),
                  bacaSaja
                )}
                placeholder="https://drive.google.com/..."
              />
            </Field>
          </div>

          <div className="mt-3">
            <Field
              label="Link publikasi media sosial"
              wajib
              galat={galatKartu(i, "link_publikasi")}
              bantuan="URL lengkap, harus diawali https://"
            >
              <input
                type="url"
                value={p.link_publikasi}
                onChange={(e) =>
                  ubahSatu(i, { link_publikasi: e.target.value })
                }
                readOnly={bacaSaja}
                className={kelasField(
                  galatKartu(i, "link_publikasi"),
                  bacaSaja
                )}
                placeholder="https://www.instagram.com/p/..."
              />
            </Field>
          </div>
        </div>
      ))}

      {!bacaSaja && (
        <button
          type="button"
          onClick={tambah}
          disabled={daftar.length >= MAX_PUBLIKASI}
          className="w-full text-xs font-semibold text-blue-700 border border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2.5 rounded-xl no-print"
        >
          + Tambah publikasi
          {daftar.length >= MAX_PUBLIKASI && ` (maksimal ${MAX_PUBLIKASI})`}
        </button>
      )}
    </div>
  );
}
