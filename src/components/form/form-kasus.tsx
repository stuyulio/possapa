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
  sudah_simfoni: boolean;
  no_registrasi_simfoni: string;
  tanggal_input_simfoni: string;
  penginput_simfoni: string;
  alasan_belum_simfoni: string;
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
}: {
  nilai: NilaiKasus;
  ubah: <K extends keyof NilaiKasus>(k: K, v: NilaiKasus[K]) => void;
  galat: Record<string, string>;
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
            className={kelasField(galat.kode_kasus)}
            placeholder="ACH-01"
          />
        </Field>

        <Field label="Tanggal aduan" wajib galat={galat.tanggal_aduan}>
          <input
            type="date"
            value={nilai.tanggal_aduan}
            onChange={(e) => ubah("tanggal_aduan", e.target.value)}
            className={kelasField(galat.tanggal_aduan)}
          />
        </Field>

        <Field label="Kategori kasus" wajib galat={galat.kategori}>
          <select
            value={nilai.kategori}
            onChange={(e) =>
              ubah("kategori", e.target.value as NilaiKasus["kategori"])
            }
            className={kelasField(galat.kategori)}
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
          className={kelasField(galat.jenis_kasus)}
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
            />
          </Field>

          <Field label="Jenis kelamin" galat={galat.jenis_kelamin}>
            <select
              value={nilai.jenis_kelamin}
              onChange={(e) => ubah("jenis_kelamin", e.target.value)}
              className={kelasField(galat.jenis_kelamin)}
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
              className={kelasField(galat.kelompok_usia)}
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
            className={kelasField(galat.kebutuhan_korban)}
            placeholder="Contoh: Pendampingan psikologis, visum, rumah aman"
          />
        </Field>

        <Field label="Bentuk tindak lanjut">
          <textarea
            rows={2}
            value={nilai.tindak_lanjut}
            onChange={(e) => ubah("tindak_lanjut", e.target.value)}
            className={kelasField(galat.tindak_lanjut)}
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
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                nilai.status_penanganan === s.nilai
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-600 border-slate-300 hover:border-emerald-400"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Field>

      <fieldset className="border-t border-slate-200 pt-4">
        <legend className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
          Pencatatan SIMFONI PPA
        </legend>

        <label className="flex items-center gap-2 text-sm text-slate-700 mb-3">
          <input
            type="checkbox"
            checked={nilai.sudah_simfoni}
            onChange={(e) => ubah("sudah_simfoni", e.target.checked)}
            className="w-4 h-4 rounded border-slate-300"
          />
          Sudah dicatat di SIMFONI PPA
        </label>

        {nilai.sudah_simfoni ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="No. registrasi SIMFONI" wajib galat={galat.no_registrasi_simfoni}>
              <input
                type="text"
                value={nilai.no_registrasi_simfoni}
                onChange={(e) => ubah("no_registrasi_simfoni", e.target.value)}
                className={kelasField(galat.no_registrasi_simfoni)}
                placeholder="SIM-2026-0001-0001"
              />
            </Field>
            <Field label="Tanggal input" wajib galat={galat.tanggal_input_simfoni}>
              <input
                type="date"
                value={nilai.tanggal_input_simfoni}
                onChange={(e) => ubah("tanggal_input_simfoni", e.target.value)}
                className={kelasField(galat.tanggal_input_simfoni)}
              />
            </Field>
            <Field label="Penginput" wajib galat={galat.penginput_simfoni}>
              <input
                type="text"
                value={nilai.penginput_simfoni}
                onChange={(e) => ubah("penginput_simfoni", e.target.value)}
                className={kelasField(galat.penginput_simfoni)}
                placeholder="Petugas UPTD PPA"
              />
            </Field>
          </div>
        ) : (
          <Field
            label="Alasan belum masuk SIMFONI"
            wajib
            galat={galat.alasan_belum_simfoni}
          >
            <textarea
              rows={2}
              value={nilai.alasan_belum_simfoni}
              onChange={(e) => ubah("alasan_belum_simfoni", e.target.value)}
              className={kelasField(galat.alasan_belum_simfoni)}
              placeholder="Contoh: Menunggu kelengkapan berkas"
            />
          </Field>
        )}

        <div className="mt-4">
          <Field label="Hambatan penanganan" bantuan="Maksimal satu kalimat">
            <textarea
              rows={2}
              value={nilai.hambatan}
              onChange={(e) => ubah("hambatan", e.target.value)}
              className={kelasField(galat.hambatan)}
            />
          </Field>
        </div>
      </fieldset>
    </div>
  );
}
