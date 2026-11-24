"use client";

import { Field, InputAngka, kelasField } from "./field";

export type NilaiRekap = {
  status_bulan: "Ada aduan" | "Nihil";
  aduan_masuk: number;
  kekerasan_perempuan: number;
  kekerasan_anak: number;
  non_kekerasan_perempuan: number;
  non_kekerasan_anak: number;
  sudah_ditindaklanjuti: number;
  tercatat_simfoni: number;
  tindak_lanjut_umum: string;
  pihak_terlibat: string;
};

export function FormRekap({
  nilai,
  ubah,
  galat,
}: {
  nilai: NilaiRekap;
  ubah: <K extends keyof NilaiRekap>(k: K, v: NilaiRekap[K]) => void;
  galat: Record<string, string>;
}) {
  const nihil = nilai.status_bulan === "Nihil";

  const kategori =
    nilai.kekerasan_perempuan +
    nilai.kekerasan_anak +
    nilai.non_kekerasan_perempuan +
    nilai.non_kekerasan_anak;

  const tidakCocok = !nihil && kategori !== nilai.aduan_masuk;

  function ubahStatus(v: "Ada aduan" | "Nihil") {
    ubah("status_bulan", v);
    if (v === "Nihil") {
      ubah("aduan_masuk", 0);
      ubah("kekerasan_perempuan", 0);
      ubah("kekerasan_anak", 0);
      ubah("non_kekerasan_perempuan", 0);
      ubah("non_kekerasan_anak", 0);
      ubah("sudah_ditindaklanjuti", 0);
      ubah("tercatat_simfoni", 0);
    }
  }

  const nonaktif = nihil ? "opacity-50 pointer-events-none" : "";

  return (
    <div className="space-y-5">
      <Field label="Status pelaporan aduan bulan ini" wajib galat={galat.status_bulan}>
        <div className="flex gap-2">
          {(["Ada aduan", "Nihil"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ubahStatus(s)}
              aria-pressed={nilai.status_bulan === s}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                nilai.status_bulan === s
                  ? s === "Nihil"
                    ? "bg-slate-700 text-white border-slate-700"
                    : "bg-rose-600 text-white border-rose-600"
                  : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </Field>

      {nihil && (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
          Status <strong>Nihil</strong> berarti tidak ada aduan pada periode ini.
          Seluruh hitungan dikunci ke 0.
        </p>
      )}

      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-4 ${nonaktif}`}>
        <Field label="Jumlah aduan masuk" galat={galat.aduan_masuk}>
          <InputAngka nilai={nilai.aduan_masuk} ubah={(v) => ubah("aduan_masuk", v)} galat={galat.aduan_masuk} />
        </Field>
        <Field label="Kekerasan — perempuan" galat={galat.kekerasan_perempuan}>
          <InputAngka nilai={nilai.kekerasan_perempuan} ubah={(v) => ubah("kekerasan_perempuan", v)} galat={galat.kekerasan_perempuan} />
        </Field>
        <Field label="Kekerasan — anak" galat={galat.kekerasan_anak}>
          <InputAngka nilai={nilai.kekerasan_anak} ubah={(v) => ubah("kekerasan_anak", v)} galat={galat.kekerasan_anak} />
        </Field>
        <Field label="Non-kekerasan — perempuan" galat={galat.non_kekerasan_perempuan}>
          <InputAngka nilai={nilai.non_kekerasan_perempuan} ubah={(v) => ubah("non_kekerasan_perempuan", v)} galat={galat.non_kekerasan_perempuan} />
        </Field>
        <Field label="Non-kekerasan — anak" galat={galat.non_kekerasan_anak}>
          <InputAngka nilai={nilai.non_kekerasan_anak} ubah={(v) => ubah("non_kekerasan_anak", v)} galat={galat.non_kekerasan_anak} />
        </Field>
      </div>

      {!nihil && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <span className="text-slate-600">
            Jumlah kategori: <strong className="text-slate-900">{kategori}</strong>
          </span>
          <span className="text-slate-600">
            Aduan masuk: <strong className="text-slate-900">{nilai.aduan_masuk}</strong>
          </span>
          {tidakCocok && (
            <span role="status" className="font-semibold text-rose-700">
              ⚠ Jumlah kategori harus sama dengan aduan masuk
            </span>
          )}
        </div>
      )}

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${nonaktif}`}>
        <Field label="Sudah ditindaklanjuti" galat={galat.sudah_ditindaklanjuti}>
          <InputAngka nilai={nilai.sudah_ditindaklanjuti} ubah={(v) => ubah("sudah_ditindaklanjuti", v)} galat={galat.sudah_ditindaklanjuti} />
        </Field>
        <Field label="Tercatat di SIMFONI PPA" galat={galat.tercatat_simfoni}>
          <InputAngka nilai={nilai.tercatat_simfoni} ubah={(v) => ubah("tercatat_simfoni", v)} galat={galat.tercatat_simfoni} />
        </Field>
      </div>

      <div className={`space-y-4 ${nonaktif}`}>
        <Field label="Tindak lanjut penanganan kasus secara umum">
          <textarea
            rows={2}
            value={nilai.tindak_lanjut_umum}
            onChange={(e) => ubah("tindak_lanjut_umum", e.target.value)}
            className={kelasField(galat.tindak_lanjut_umum)}
            placeholder="Contoh: Sudah ditangani bersama UPTD PPA"
          />
        </Field>

        <Field label="Pihak yang terlibat">
          <input
            type="text"
            value={nilai.pihak_terlibat}
            onChange={(e) => ubah("pihak_terlibat", e.target.value)}
            className={kelasField(galat.pihak_terlibat)}
            placeholder="Contoh: Dinas PPPA, UPTD PPA, Kepolisian"
          />
        </Field>
      </div>
    </div>
  );
}
