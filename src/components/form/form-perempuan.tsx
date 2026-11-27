"use client";

import { Field, InputAngka, kelasField } from "./field";
import {
  MAKSIMAL_KEGIATAN,
  potongKegiatan,
  type KegiatanPerempuan,
} from "@/lib/kegiatan";

export type NilaiPerempuan = {
  jumlah_kegiatan: number;
  /** Satu kartu per kegiatan; lihat catatan di `NilaiAnak.kegiatan`. */
  kegiatan: KegiatanPerempuan[];
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
  hapusGalatKegiatan,
  bacaSaja = false,
}: {
  nilai: NilaiPerempuan;
  ubah: <K extends keyof NilaiPerempuan>(k: K, v: NilaiPerempuan[K]) => void;
  galat: Record<string, string>;
  /** Buang galat milik kartu kegiatan ke-i setelah isinya diperbaiki. */
  hapusGalatKegiatan: (i: number) => void;
  /** Laporan terkirim: tampilkan isinya, jangan biarkan diubah. */
  bacaSaja?: boolean;
}) {
  const jumlahTampil = Math.max(1, Number(nilai.jumlah_kegiatan) || 0);
  const kegiatanTampil = potongKegiatan(nilai.kegiatan ?? [], jumlahTampil, () => ({
    nama: "",
    jenis: "",
  }));

  function ubahKegiatan(i: number, perubahan: Partial<KegiatanPerempuan>) {
    const baru = [...(nilai.kegiatan ?? [])];
    while (baru.length <= i) baru.push({ nama: "", jenis: "" });
    baru[i] = { ...baru[i], ...perubahan };
    ubah("kegiatan", baru);
    hapusGalatKegiatan(i);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Jumlah kegiatan perempuan"
          wajib
          galat={galat.jumlah_kegiatan}
          bantuan={`Satu kartu kegiatan untuk setiap kegiatan (1–${MAKSIMAL_KEGIATAN}).`}
        >
          <InputAngka
            nilai={nilai.jumlah_kegiatan}
            ubah={(v) => ubah("jumlah_kegiatan", v)}
            galat={galat.jumlah_kegiatan}
            min={1}
            max={MAKSIMAL_KEGIATAN}
            bacaSaja={bacaSaja}
          />
        </Field>

        <Field
          label="Total perempuan yang ikut (orang)"
          wajib
          galat={galat.total_ikut}
        >
          <InputAngka
            nilai={nilai.total_ikut}
            ubah={(v) => ubah("total_ikut", v)}
            galat={galat.total_ikut}
            bacaSaja={bacaSaja}
          />
        </Field>
      </div>

      <fieldset className="border-t border-slate-200 pt-4">
        <legend className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
          Rincian kegiatan
          <span className="text-rose-600 ml-0.5">*</span>
        </legend>
        {galat.kegiatan && (
          <p
            role="alert"
            className="text-[11px] text-rose-600 font-semibold mb-2"
          >
            {galat.kegiatan}
          </p>
        )}

        <div className="space-y-4">
          {kegiatanTampil.map((k, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-3">
                Kegiatan {i + 1}
              </p>

              <Field
                label="Nama kegiatan"
                wajib
                galat={galat[`kegiatan.${i}.nama`]}
              >
                <input
                  type="text"
                  value={k.nama}
                  onChange={(e) => ubahKegiatan(i, { nama: e.target.value })}
                  placeholder="Contoh: Sekolah Perempuan Mandiri"
                  readOnly={bacaSaja}
                  className={kelasField(galat[`kegiatan.${i}.nama`], bacaSaja)}
                />
              </Field>

              <div className="mt-3">
                <Field
                  label="Jenis kegiatan"
                  bantuan="Contoh: pengajian ibu-ibu, hidroponik, pelatihan usaha"
                >
                  <input
                    type="text"
                    value={k.jenis ?? ""}
                    onChange={(e) => ubahKegiatan(i, { jenis: e.target.value })}
                    readOnly={bacaSaja}
                    className={kelasField(
                      galat[`kegiatan.${i}.jenis`],
                      bacaSaja
                    )}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="border-t border-slate-200 pt-4">
        <legend className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
          Kelompok sasaran — total periode ini
        </legend>
        <p className="text-[11px] text-slate-500 mb-3">
          Diisi untuk seluruh kegiatan sekaligus, bukan per kegiatan. Isi jumlah
          peserta pada masing-masing kelompok. Tidak boleh melebihi total
          peserta. Satu peserta boleh dihitung di beberapa kelompok — ibu hamil
          dapat sekaligus menyusui.
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
