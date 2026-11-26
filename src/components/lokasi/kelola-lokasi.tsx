"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, kelasField } from "@/components/form/field";
import { Badge } from "@/components/dashboard/panel";
import {
  JENIS_HUNIAN,
  JENIS_HUNIAN_LAINNYA,
  labelJenisHunian,
  type JenisHunian,
} from "@/lib/lokasi/jenis-hunian";
import type {
  HasilLokasi,
  Lokasi,
  MasukanLokasi,
  WilayahRingkas,
} from "@/lib/lokasi/tipe";

const KOSONG = {
  wilayahId: "",
  namaLokasi: "",
  kodePos: "",
  jenisHunian: "" as JenisHunian | "",
  jenisHunianLainnya: "",
  lat: "",
  lng: "",
  penanggungJawab: "",
  statusAktif: true,
};

type AsalForm = typeof KOSONG;

/**
 * Form kelola lokasi Pos SAPA.
 *
 * Bila `kunciWilayahId` diisi (mode petugas), pemilih kabupaten/kota
 * disembunyikan dan wilayah dikunci pada nilai tersebut.
 * Aksi disuntikkan lewat prop agar admin pusat dan petugas dapat memakai
 * server action masing-masing dengan otorisasi berbeda.
 */
export function KelolaLokasiForm({
  daftar,
  wilayah,
  kunciWilayahId,
  simpanAksi,
  hapusAksi,
  judulKosong = "Belum ada lokasi Pos SAPA. Tambahkan lokasi pertama.",
}: {
  daftar: Lokasi[];
  wilayah: WilayahRingkas[];
  kunciWilayahId?: string;
  simpanAksi: (m: MasukanLokasi) => Promise<HasilLokasi>;
  hapusAksi: (id: string) => Promise<HasilLokasi>;
  judulKosong?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"tutup" | "baru" | "edit">("tutup");
  const [diedit, setDiedit] = useState<Lokasi | null>(null);
  const [form, setForm] = useState<AsalForm>({
    ...KOSONG,
    wilayahId: kunciWilayahId ?? "",
  });
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(false);

  function ubah<K extends keyof AsalForm>(k: K, v: AsalForm[K]) {
    setForm((f) => {
      // Pindah keluar dari "Lainnya" mengosongkan teks bebasnya. Tanpa ini,
      // isian lama tertinggal di state dan ikut terkirim bila petugas kembali
      // memilih "Lainnya" — atau lebih buruk, tersimpan bila server tidak
      // membersihkannya (server memang membersihkan; ini lapisan kedua).
      if (k === "jenisHunian" && v !== JENIS_HUNIAN_LAINNYA) {
        return { ...f, [k]: v, jenisHunianLainnya: "" } as AsalForm;
      }
      return { ...f, [k]: v } as AsalForm;
    });
    setGalat((g) => {
      if (!g[k]) return g;
      const b = { ...g };
      delete b[k as string];
      return b;
    });
  }

  function bukaBaru() {
    setMode("baru");
    setDiedit(null);
    setForm({ ...KOSONG, wilayahId: kunciWilayahId ?? "" });
    setGalat({});
    setPesan(null);
  }

  function bukaEdit(l: Lokasi) {
    setMode("edit");
    setDiedit(l);
    setForm({
      wilayahId: kunciWilayahId ?? l.wilayah_id,
      namaLokasi: l.nama_lokasi,
      kodePos: l.kode_pos ?? "",
      jenisHunian: l.jenis_hunian ?? "",
      jenisHunianLainnya: l.jenis_hunian_lainnya ?? "",
      lat: l.lat?.toString() ?? "",
      lng: l.lng?.toString() ?? "",
      penanggungJawab: l.penanggung_jawab ?? "",
      statusAktif: l.status_aktif,
    });
    setGalat({});
    setPesan(null);
  }

  function tutup() {
    setMode("tutup");
    setDiedit(null);
    setGalat({});
    setPesan(null);
  }

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setMemuat(true);
    setGalat({});
    setPesan(null);

    const hasil = await simpanAksi({
      id: mode === "edit" ? diedit?.id : undefined,
      ...form,
      wilayahId: kunciWilayahId ?? form.wilayahId,
    });

    setMemuat(false);

    if (!hasil.sukses) {
      if (hasil.galat) setGalat(hasil.galat);
      setPesan(hasil.pesan);
      return;
    }

    tutup();
    router.refresh();
  }

  async function hapus(l: Lokasi) {
    if (!confirm(`Hapus lokasi "${l.nama_lokasi}"?`)) return;
    setMemuat(true);
    const hasil = await hapusAksi(l.id);
    setMemuat(false);
    if (!hasil.sukses) setPesan(hasil.pesan);
    else router.refresh();
  }

  // Pada mode petugas, semua lokasi berada di satu wilayah — cukup satu grup.
  const dikelompokkan = kunciWilayahId
    ? (() => {
        const w = wilayah.find((x) => x.id === kunciWilayahId);
        const kelompok = daftar.filter((l) => l.wilayah_id === kunciWilayahId);
        return w && kelompok.length > 0 ? [{ wilayah: w, lokasi: kelompok }] : [];
      })()
    : wilayah
        .map((w) => ({
          wilayah: w,
          lokasi: daftar.filter((l) => l.wilayah_id === w.id),
        }))
        .filter((g) => g.lokasi.length > 0);

  const namaWilayah = kunciWilayahId
    ? wilayah.find((x) => x.id === kunciWilayahId)
    : undefined;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={mode === "baru" ? tutup : bukaBaru}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
        >
          {mode === "baru" ? "Batal" : "+ Tambah lokasi"}
        </button>
      </div>

      {(mode === "baru" || mode === "edit") && (
        <form
          onSubmit={kirim}
          className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4"
        >
          <h3 className="font-display font-bold text-slate-900 text-sm">
            {mode === "edit" ? `Ubah lokasi: ${diedit?.nama_lokasi}` : "Lokasi baru"}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Kabupaten/Kota" wajib galat={galat.wilayahId}>
              {kunciWilayahId ? (
                <div className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700">
                  {namaWilayah
                    ? `${namaWilayah.kab_kota} — ${namaWilayah.provinsi}`
                    : "Wilayah Anda"}
                </div>
              ) : (
                <select
                  value={form.wilayahId}
                  onChange={(e) => ubah("wilayahId", e.target.value)}
                  className={kelasField(galat.wilayahId)}
                >
                  <option value="">Pilih kabupaten/kota…</option>
                  {wilayah.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.kab_kota} — {w.provinsi}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field
              label="Nama lokasi"
              wajib
              galat={galat.namaLokasi}
              bantuan="Contoh: Huntara Kampung Empat"
            >
              <input
                type="text"
                required
                value={form.namaLokasi}
                onChange={(e) => ubah("namaLokasi", e.target.value)}
                className={kelasField(galat.namaLokasi)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Kode pos" galat={galat.kodePos}>
              <input
                type="text"
                value={form.kodePos}
                onChange={(e) => ubah("kodePos", e.target.value)}
                className={kelasField(galat.kodePos)}
              />
            </Field>

            <Field label="Jenis tempat" galat={galat.jenisHunian}>
              <select
                value={form.jenisHunian}
                onChange={(e) =>
                  ubah("jenisHunian", e.target.value as JenisHunian | "")
                }
                className={kelasField(galat.jenisHunian)}
              >
                <option value="">—</option>
                {JENIS_HUNIAN.map((j) => (
                  <option key={j.nilai} value={j.nilai}>
                    {j.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Lintang (lat)" galat={galat.lat} bantuan="Contoh: 4.1234">
              <input
                type="text"
                inputMode="decimal"
                value={form.lat}
                onChange={(e) => ubah("lat", e.target.value)}
                className={kelasField(galat.lat)}
              />
            </Field>

            <Field label="Bujur (lng)" galat={galat.lng} bantuan="Contoh: 97.5678">
              <input
                type="text"
                inputMode="decimal"
                value={form.lng}
                onChange={(e) => ubah("lng", e.target.value)}
                className={kelasField(galat.lng)}
              />
            </Field>
          </div>

          {/* Isian bebas hanya muncul untuk "Lainnya"; jenis lain sudah
              menjelaskan dirinya sendiri. */}
          {form.jenisHunian === JENIS_HUNIAN_LAINNYA && (
            <Field
              label="Sebutkan jenis tempat"
              wajib
              galat={galat.jenisHunianLainnya}
              bantuan="Contoh: Balai Desa, Kantor Camat, Gedung Serbaguna"
            >
              <input
                type="text"
                value={form.jenisHunianLainnya}
                onChange={(e) => ubah("jenisHunianLainnya", e.target.value)}
                className={kelasField(galat.jenisHunianLainnya)}
              />
            </Field>
          )}

          <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            Koordinat diambil manual dari Google Maps: klik kanan titik lokasi →
            klik angka koordinat → tersalin ke clipboard. Isi keduanya atau
            kosongkan keduanya.
          </p>

          <Field label="Penanggung jawab" galat={galat.penanggungJawab}>
            <input
              type="text"
              value={form.penanggungJawab}
              onChange={(e) => ubah("penanggungJawab", e.target.value)}
              className={kelasField(galat.penanggungJawab)}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.statusAktif}
              onChange={(e) => ubah("statusAktif", e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            Lokasi aktif (muncul di pilihan input laporan)
          </label>

          {pesan && (
            <p
              role="alert"
              className="text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"
            >
              {pesan}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={memuat}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold"
            >
              {memuat ? "Menyimpan…" : mode === "edit" ? "Simpan perubahan" : "Tambah lokasi"}
            </button>
            <button
              type="button"
              onClick={tutup}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {pesan && mode === "tutup" && (
        <p
          role="alert"
          className="text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"
        >
          {pesan}
        </p>
      )}

      {dikelompokkan.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-400">
          {judulKosong}
        </div>
      ) : (
        dikelompokkan.map((g) => (
          <section
            key={g.wilayah.id}
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
          >
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
              <h3 className="font-semibold text-slate-900 text-sm">
                {g.wilayah.kab_kota}
                <span className="text-slate-400 font-normal"> · {g.wilayah.provinsi}</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-600">
                  <tr>
                    <th className="text-left font-semibold px-4 py-2">Lokasi</th>
                    <th className="text-left font-semibold px-4 py-2">Jenis tempat</th>
                    <th className="text-left font-semibold px-4 py-2">Koordinat</th>
                    <th className="text-center font-semibold px-4 py-2">Status</th>
                    <th className="text-right font-semibold px-4 py-2">Laporan</th>
                    <th className="text-right font-semibold px-4 py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {g.lokasi.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        {l.nama_lokasi}
                        {l.kode_pos && (
                          <span className="text-xs font-normal text-slate-500">
                            {" "}
                            / {l.kode_pos}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">
                        {labelJenisHunian(
                          l.jenis_hunian,
                          l.jenis_hunian_lainnya
                        ) ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600 font-mono">
                        {l.lat !== null && l.lng !== null
                          ? `${l.lat}, ${l.lng}`
                          : "belum diisi"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge warna={l.status_aktif ? "emerald" : "slate"}>
                          {l.status_aktif ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs">
                        {l.jumlah_laporan}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => bukaEdit(l)}
                          className="text-xs font-semibold text-blue-700 hover:underline mr-3"
                        >
                          Ubah
                        </button>
                        {l.jumlah_laporan === 0 ? (
                          <button
                            type="button"
                            onClick={() => hapus(l)}
                            className="text-xs font-semibold text-rose-700 hover:underline"
                          >
                            Hapus
                          </button>
                        ) : (
                          <span
                            className="text-xs text-slate-300 cursor-not-allowed"
                            title="Lokasi yang punya laporan tidak dapat dihapus"
                          >
                            Hapus
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
