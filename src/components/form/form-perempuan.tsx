"use client";

import { Field, InputAngka, kelasField } from "./field";

export type NilaiPerempuan = {
  jumlah_kegiatan: number;
  nama_kegiatan: string;
  jenis_kegiatan: string;
  total_ikut: number;
  kepala_keluarga: number;
  hamil: number;
  menyusui: number;
  lansia: number;
  disabilitas: number;
  manfaat: string;
};

export function FormPerempuan({
  nilai,
  ubah,
  galat,
  bacaSaja = false,
}: {
  nilai: NilaiPerempuan;
  ubah: <K extends keyof NilaiPerempuan>(k: K, v: NilaiPerempuan[K]) => void;
  galat: Record<string, string>;
  /** Laporan terkirim: tampilkan isinya, jangan biarkan diubah. */
  bacaSaja?: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Jumlah kegiatan perempuan" wajib galat={galat.jumlah_kegiatan}>
          <InputAngka
            nilai={nilai.jumlah_kegiatan}
            ubah={(v) => ubah("jumlah_kegiatan", v)}
            galat={galat.jumlah_kegiatan}
            min={1}
            bacaSaja={bacaSaja}
          />
        </Field>

        <Field label="Total perempuan yang ikut (orang)" wajib galat={galat.total_ikut}>
          <InputAngka
            nilai={nilai.total_ikut}
            ubah={(v) => ubah("total_ikut", v)}
            galat={galat.total_ikut}
            bacaSaja={bacaSaja}
          />
        </Field>
      </div>

      <Field label="Nama kegiatan" wajib galat={galat.nama_kegiatan}>
        <input
          type="text"
          value={nilai.nama_kegiatan}
          onChange={(e) => ubah("nama_kegiatan", e.target.value)}
          placeholder="Contoh: Sekolah Perempuan Mandiri"
          readOnly={bacaSaja}
          className={kelasField(galat.nama_kegiatan, bacaSaja)}
        />
      </Field>

      <Field
        label="Jenis kegiatan"
        bantuan="Contoh: pengajian ibu-ibu, hidroponik, pelatihan usaha"
      >
        <input
          type="text"
          value={nilai.jenis_kegiatan}
          onChange={(e) => ubah("jenis_kegiatan", e.target.value)}
          readOnly={bacaSaja}
          className={kelasField(galat.jenis_kegiatan, bacaSaja)}
        />
      </Field>

      <fieldset className="border-t border-slate-200 pt-4">
        <legend className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
          Kelompok sasaran
        </legend>
        <p className="text-[11px] text-slate-500 mb-3">
          Isi jumlah peserta pada masing-masing kelompok. Tidak boleh melebihi
          total peserta. Satu peserta boleh dihitung di beberapa kelompok — ibu
          hamil dapat sekaligus menyusui.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <Field label="Kepala keluarga" galat={galat.kepala_keluarga}>
            <InputAngka
              nilai={nilai.kepala_keluarga}
              ubah={(v) => ubah("kepala_keluarga", v)}
              galat={galat.kepala_keluarga}
              bacaSaja={bacaSaja}
            />
          </Field>
          <Field label="Hamil" galat={galat.hamil}>
            <InputAngka
              nilai={nilai.hamil}
              ubah={(v) => ubah("hamil", v)}
              galat={galat.hamil}
              bacaSaja={bacaSaja}
            />
          </Field>
          <Field label="Menyusui" galat={galat.menyusui}>
            <InputAngka
              nilai={nilai.menyusui}
              ubah={(v) => ubah("menyusui", v)}
              galat={galat.menyusui}
              bacaSaja={bacaSaja}
            />
          </Field>
          <Field label="Lansia" galat={galat.lansia}>
            <InputAngka
              nilai={nilai.lansia}
              ubah={(v) => ubah("lansia", v)}
              galat={galat.lansia}
              bacaSaja={bacaSaja}
            />
          </Field>
          <Field label="Disabilitas" galat={galat.disabilitas}>
            <InputAngka
              nilai={nilai.disabilitas}
              ubah={(v) => ubah("disabilitas", v)}
              galat={galat.disabilitas}
              bacaSaja={bacaSaja}
            />
          </Field>
        </div>
      </fieldset>

      <Field label="Manfaat yang dirasakan">
        <textarea
          rows={3}
          value={nilai.manfaat}
          onChange={(e) => ubah("manfaat", e.target.value)}
          readOnly={bacaSaja}
          className={kelasField(galat.manfaat, bacaSaja)}
          placeholder="Contoh: Menambah keterampilan wirausaha rumah tangga"
        />
      </Field>
    </div>
  );
}
