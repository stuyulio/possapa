"use client";

import { Field, InputAngka, kelasField } from "./field";

export type NilaiKasus = {
  kode_kasus: string;
  tanggal_aduan: string;
  kategori: "kekerasan" | "non_kekerasan";
  jenis_kasus: string;
  jumlah_korban: number;
  jenis_kelamin: string;
  kelompok_usia: string;
  disabilitas: boolean;
  kebutuhan_korban: string;
  tindak_lanjut: string;
  status_penanganan: "dalam_proses" | "dirujuk" | "selesai";
  hambatan: string;
};

const PILIHAN_STATUS = [
  { nilai: "dalam_proses", label: "Dalam proses" },
  { nilai: "dirujuk", label: "Dirujuk" },
  { nilai: "selesai", label: "Selesai" },
] as const;

export function FormKasus({
  nilai,
  ubah,
  galat,
  bacaSaja = false,
}: {
  nilai: NilaiKasus;
  ubah: <K extends keyof NilaiKasus>(k: K, v: NilaiKasus[K]) => void;
  galat: Record<string, string>;
  /** Laporan terkirim: tampilkan isinya, jangan biarkan diubah. */
  bacaSaja?: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-900">
        Jangan mencantumkan nama atau identitas korban. Gunakan hanya kode kasus.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Kode kasus" wajib galat={galat.kode_kasus} bantuan="Contoh: ACH-01">
          <input
            type="text"
            value={nilai.kode_kasus}
            onChange={(e) => ubah("kode_kasus", e.target.value)}
            readOnly
            className={kelasField(galat.kode_kasus, true)}
            placeholder="ACH-01"
          />
        </Field>

        <Field label="Tanggal aduan" wajib galat={galat.tanggal_aduan}>
          <input
            type="date"
            value={nilai.tanggal_aduan}
            onChange={(e) => ubah("tanggal_aduan", e.target.value)}
            readOnly={bacaSaja}
            className={kelasField(galat.tanggal_aduan, bacaSaja)}
          />
        </Field>

        <Field label="Kategori kasus" wajib galat={galat.kategori}>
          <select
            value={nilai.kategori}
            onChange={(e) =>
              ubah("kategori", e.target.value as NilaiKasus["kategori"])
            }
            disabled={bacaSaja}
            className={kelasField(galat.kategori, bacaSaja)}
          >
            <option value="kekerasan">Kekerasan</option>
            <option value="non_kekerasan">Non-kekerasan</option>
          </select>
        </Field>
      </div>

      <Field label="Jenis kasus" wajib galat={galat.jenis_kasus}>
        <input
          type="text"
          value={nilai.jenis_kasus}
          onChange={(e) => ubah("jenis_kasus", e.target.value)}
          readOnly={bacaSaja}
          className={kelasField(galat.jenis_kasus, bacaSaja)}
          placeholder="Contoh: Kekerasan psikis, KDRT, penelantaran"
        />
      </Field>

      <fieldset className="border-t border-slate-200 pt-4">
        <legend className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
          Profil korban / pelapor
        </legend>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Jumlah korban" galat={galat.jumlah_korban}>
            <InputAngka
              nilai={nilai.jumlah_korban}
              ubah={(v) => ubah("jumlah_korban", v)}
              galat={galat.jumlah_korban}
              min={1}
              bacaSaja={bacaSaja}
            />
          </Field>

          <Field label="Jenis kelamin" galat={galat.jenis_kelamin}>
            <select
              value={nilai.jenis_kelamin}
              onChange={(e) => ubah("jenis_kelamin", e.target.value)}
              disabled={bacaSaja}
              className={kelasField(galat.jenis_kelamin, bacaSaja)}
            >
              <option value="">Pilih…</option>
              <option value="Perempuan">Perempuan</option>
              <option value="Laki-Laki">Laki-laki</option>
            </select>
          </Field>

          <Field label="Kelompok usia" galat={galat.kelompok_usia}>
            <select
              value={nilai.kelompok_usia}
              onChange={(e) => ubah("kelompok_usia", e.target.value)}
              disabled={bacaSaja}
              className={kelasField(galat.kelompok_usia, bacaSaja)}
            >
              <option value="">Pilih…</option>
              <option value="Anak (0-17 Tahun)">Anak (0–17 tahun)</option>
              <option value="Dewasa (18+ Tahun)">Dewasa (18+ tahun)</option>
            </select>
          </Field>

          <Field label="Penyandang disabilitas">
            <label className="flex items-center gap-2 h-[38px] text-sm text-slate-700">
              <input
                type="checkbox"
                checked={nilai.disabilitas}
                onChange={(e) => ubah("disabilitas", e.target.checked)}
                disabled={bacaSaja}
                className="w-4 h-4 rounded border-slate-300"
              />
              Ya
            </label>
          </Field>
        </div>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Kebutuhan korban">
          <textarea
            rows={2}
            value={nilai.kebutuhan_korban}
            onChange={(e) => ubah("kebutuhan_korban", e.target.value)}
            readOnly={bacaSaja}
            className={kelasField(galat.kebutuhan_korban, bacaSaja)}
            placeholder="Contoh: Pendampingan psikologis, visum, rumah aman"
          />
        </Field>

        <Field label="Bentuk tindak lanjut">
          <textarea
            rows={2}
            value={nilai.tindak_lanjut}
            onChange={(e) => ubah("tindak_lanjut", e.target.value)}
            readOnly={bacaSaja}
            className={kelasField(galat.tindak_lanjut, bacaSaja)}
            placeholder="Contoh: Rujukan UPTD PPA, koordinasi kepolisian"
          />
        </Field>
      </div>

      <Field label="Status penanganan" wajib galat={galat.status_penanganan}>
        <div className="flex flex-wrap gap-2">
          {PILIHAN_STATUS.map((s) => (
            <button
              key={s.nilai}
              type="button"
              onClick={() => ubah("status_penanganan", s.nilai)}
              aria-pressed={nilai.status_penanganan === s.nilai}
              disabled={bacaSaja}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                nilai.status_penanganan === s.nilai
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-600 border-slate-300 hover:border-emerald-400"
              } ${bacaSaja ? "cursor-default" : ""}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Field>

      <fieldset className="border-t border-slate-200 pt-4">
        <legend className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
          Hambatan Penanganan
        </legend>

        <Field label="Hambatan/Kendala penanganan" bantuan="Maksimal satu kalimat">
          <textarea
            rows={2}
            value={nilai.hambatan}
            onChange={(e) => ubah("hambatan", e.target.value)}
            readOnly={bacaSaja}
            className={kelasField(galat.hambatan, bacaSaja)}
          />
        </Field>
      </fieldset>
    </div>
  );
}
