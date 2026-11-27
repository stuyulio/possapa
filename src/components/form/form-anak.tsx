"use client";

import { Field, InputAngka, kelasField } from "./field";
import {
  galatPenerimaManfaat,
  JENIS_KEGIATAN_ANAK,
} from "@/lib/validasi/laporan";
import {
  MAKSIMAL_KEGIATAN,
  potongKegiatan,
  type KegiatanAnak,
} from "@/lib/kegiatan";

export type NilaiAnak = {
  jumlah_kegiatan: number;
  /**
   * Satu kartu per kegiatan. Daftar ini boleh lebih panjang daripada yang
   * ditampilkan selama petugas mengubah kolom jumlah — isian yang sudah
   * diketik tidak boleh hilang hanya karena angkanya sedang kosong. Yang
   * dipakai adalah `slice(0, jumlah_kegiatan)`, dan hanya pada tampilan.
   */
  kegiatan: KegiatanAnak[];
  usia_0_5: number;
  usia_6_12: number;
  usia_13_17: number;
  laki_laki: number;
  perempuan: number;
  disabilitas: number;
  perlu_layanan_lanjutan: number;
  temuan: string;
  tindak_lanjut: string;
  hambatan: string;
};

export function FormAnak({
  nilai,
  ubah,
  galat,
  hapusGalatKegiatan,
  bacaSaja = false,
}: {
  nilai: NilaiAnak;
  ubah: <K extends keyof NilaiAnak>(k: K, v: NilaiAnak[K]) => void;
  galat: Record<string, string>;
  /** Buang galat milik kartu kegiatan ke-i setelah isinya diperbaiki. */
  hapusGalatKegiatan: (i: number) => void;
  /** Laporan terkirim: tampilkan isinya, jangan biarkan diubah. */
  bacaSaja?: boolean;
}) {
  const totalUsia = nilai.usia_0_5 + nilai.usia_6_12 + nilai.usia_13_17;
  const totalGender = nilai.laki_laki + nilai.perempuan;
  // Laporan lama (dibuat sebelum aturan ini) bisa tersimpan dengan selisih.
  // Di tampilan baca-saja tidak ada tombol kirim yang perlu ditahan, jadi
  // peringatannya tidak ditampilkan — selisihnya sendiri sudah muncul sebagai
  // anomali A1 di panel verifikasi/audit.
  const selisih = !bacaSaja && totalUsia !== totalGender;
  const galatBagian = galat.penerima_manfaat;

  // Minimal satu kartu: kolom jumlah yang dikosongkan tidak boleh
  // meninggalkan formulir tanpa kegiatan sama sekali.
  const jumlahTampil = Math.max(1, Number(nilai.jumlah_kegiatan) || 0);
  const kegiatanTampil = potongKegiatan(nilai.kegiatan ?? [], jumlahTampil, () => ({
    nama: "",
    jenis: [],
  }));

  /** Ubah satu kegiatan. Indeks di luar daftar awal diisi kartu kosong dulu. */
  function ubahKegiatan(i: number, perubahan: Partial<KegiatanAnak>) {
    const baru = [...(nilai.kegiatan ?? [])];
    while (baru.length <= i) baru.push({ nama: "", jenis: [] });
    baru[i] = { ...baru[i], ...perubahan };
    ubah("kegiatan", baru);
    // Galat kartu ini sudah tidak berlaku begitu isinya diubah; tanpa ini
    // pesan merah bertahan di samping kolom yang sudah diperbaiki.
    hapusGalatKegiatan(i);
  }

  function toggleJenis(i: number, j: string) {
    const sekarang = kegiatanTampil[i]?.jenis ?? [];
    const ada = sekarang.includes(j);
    ubahKegiatan(i, {
      jenis: ada ? sekarang.filter((x) => x !== j) : [...sekarang, j],
    });
  }

  const galatKegiatan = galat.kegiatan;

  return (
    <div className="space-y-5">
      <Field
        label="Jumlah kegiatan anak"
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

      <fieldset className="border-t border-slate-200 pt-4">
        <legend className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
          Rincian kegiatan
          <span className="text-rose-600 ml-0.5">*</span>
        </legend>
        {galatKegiatan && (
          <p
            role="alert"
            className="text-[11px] text-rose-600 font-semibold mb-2"
          >
            {galatKegiatan}
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
                  placeholder="Contoh: Ruang Sahabat Anak & Edukasi Perlindungan Diri"
                  readOnly={bacaSaja}
                  className={kelasField(galat[`kegiatan.${i}.nama`], bacaSaja)}
                />
              </Field>

              <div className="mt-3">
                <Field
                  label="Jenis kegiatan"
                  wajib
                  galat={galat[`kegiatan.${i}.jenis`]}
                >
                  <div className="flex flex-wrap gap-2">
                    {JENIS_KEGIATAN_ANAK.map((j) => {
                      const aktif = (k.jenis ?? []).includes(j);
                      return (
                        <button
                          key={j}
                          type="button"
                          onClick={() => toggleJenis(i, j)}
                          aria-pressed={aktif}
                          disabled={bacaSaja}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                            aktif
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-slate-600 border-slate-300 hover:border-blue-400"
                          } ${bacaSaja ? "cursor-default opacity-90" : ""}`}
                        >
                          {j}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="border-t border-slate-200 pt-4">
        <legend className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
          Penerima manfaat — total periode ini
          <span className="text-rose-600 ml-0.5">*</span>
        </legend>
        {galatBagian ? (
          <p
            role="alert"
            className="text-[11px] text-rose-600 font-semibold mb-2"
          >
            {galatBagian}
          </p>
        ) : (
          <p className="text-[11px] text-slate-500 mb-2">
            Diisi untuk seluruh kegiatan sekaligus, bukan per kegiatan. Anak
            yang mengikuti dua kegiatan cukup dihitung sekali. Wajib diisi
            minimal satu penerima manfaat. Kolom yang tidak ada pesertanya cukup
            diisi 0; total per usia harus sama dengan total per jenis kelamin.
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Usia 0–5 tahun" galat={galat.usia_0_5}>
            <InputAngka nilai={nilai.usia_0_5} ubah={(v) => ubah("usia_0_5", v)} galat={galat.usia_0_5} bacaSaja={bacaSaja} />
          </Field>
          <Field label="Usia 6–12 tahun" galat={galat.usia_6_12}>
            <InputAngka nilai={nilai.usia_6_12} ubah={(v) => ubah("usia_6_12", v)} galat={galat.usia_6_12} bacaSaja={bacaSaja} />
          </Field>
          <Field label="Usia 13–17 tahun" galat={galat.usia_13_17}>
            <InputAngka nilai={nilai.usia_13_17} ubah={(v) => ubah("usia_13_17", v)} galat={galat.usia_13_17} bacaSaja={bacaSaja} />
          </Field>
          <Field label="Laki-laki" galat={galat.laki_laki}>
            <InputAngka nilai={nilai.laki_laki} ubah={(v) => ubah("laki_laki", v)} galat={galat.laki_laki} bacaSaja={bacaSaja} />
          </Field>
          <Field label="Perempuan" galat={galat.perempuan}>
            <InputAngka nilai={nilai.perempuan} ubah={(v) => ubah("perempuan", v)} galat={galat.perempuan} bacaSaja={bacaSaja} />
          </Field>
          <Field label="Penyandang disabilitas" galat={galat.disabilitas}>
            <InputAngka nilai={nilai.disabilitas} ubah={(v) => ubah("disabilitas", v)} galat={galat.disabilitas} bacaSaja={bacaSaja} />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <span className="text-slate-600">
            Total per usia: <strong className="text-slate-900">{totalUsia}</strong>
          </span>
          <span className="text-slate-600">
            Total per jenis kelamin: <strong className="text-slate-900">{totalGender}</strong>
          </span>
          {selisih && (
            <span role="status" className="font-semibold text-rose-600">
              ✗ Kedua total berbeda — laporan belum dapat dikirim
            </span>
          )}
        </div>
      </fieldset>

      <fieldset className="border-t border-slate-200 pt-4">
        <legend className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
          Temuan & tindak lanjut
        </legend>

        <div className="space-y-4">
          <Field
            label="Jumlah anak yang perlu layanan lanjutan"
            galat={galat.perlu_layanan_lanjutan}
          >
            <InputAngka
              nilai={nilai.perlu_layanan_lanjutan}
              ubah={(v) => ubah("perlu_layanan_lanjutan", v)}
              galat={galat.perlu_layanan_lanjutan}
              bacaSaja={bacaSaja}
            />
          </Field>

          <Field
            label="Temuan anak yang perlu ditindaklanjuti"
            bantuan='Isi "-" bila tidak ada temuan'
          >
            <textarea
              rows={3}
              value={nilai.temuan}
              onChange={(e) => ubah("temuan", e.target.value)}
              readOnly={bacaSaja}
              className={kelasField(galat.temuan, bacaSaja)}
              placeholder="Contoh: 1 anak menunjukkan gejala kecemasan berat…"
            />
          </Field>

          <Field label="Tindak lanjut temuan">
            <textarea
              rows={3}
              value={nilai.tindak_lanjut}
              onChange={(e) => ubah("tindak_lanjut", e.target.value)}
              readOnly={bacaSaja}
              className={kelasField(galat.tindak_lanjut, bacaSaja)}
              placeholder="Contoh: Konseling psikososial dan rujukan ke UPTD PPA…"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="border-t border-slate-200 pt-4">
        <legend className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
          Hambatan/Kendala
        </legend>

        <Field
          label="Hambatan/Kendala"
          bantuan="Kendala yang dihadapi selama kegiatan. Kosongkan bila tidak ada."
        >
          <textarea
            rows={2}
            value={nilai.hambatan}
            onChange={(e) => ubah("hambatan", e.target.value)}
            readOnly={bacaSaja}
            className={kelasField(galat.hambatan, bacaSaja)}
            placeholder="Contoh: Ruang kegiatan terbatas dan dua pos tidak dapat dijangkau saat hujan…"
          />
        </Field>
      </fieldset>
    </div>
  );
}
