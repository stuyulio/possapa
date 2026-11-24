"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buatAkun, ubahAkun, ubahStatusAkun, type MasukanAkun } from "./actions";
import { Field, kelasField } from "@/components/form/field";
import { Badge } from "@/components/dashboard/panel";

type Peran = "petugas" | "admin_kabkota" | "admin_pusat" | "pimpinan";

export type Akun = {
  id: string;
  nama: string;
  email: string;
  peran: Peran;
  wilayah_id: string | null;
  aktif: boolean;
};

type Wilayah = { id: string; provinsi: string; kab_kota: string };

const LABEL_PERAN: Record<Peran, string> = {
  petugas: "Petugas Kab/Kota",
  admin_kabkota: "Admin Kab/Kota",
  admin_pusat: "Admin Pusat",
  pimpinan: "Pimpinan",
};

const WARNA_PERAN: Record<Peran, "blue" | "rose" | "emerald" | "slate"> = {
  petugas: "blue",
  admin_kabkota: "emerald",
  admin_pusat: "rose",
  pimpinan: "slate",
};

const KOSONG: MasukanAkun = {
  nama: "",
  email: "",
  peran: "petugas",
  wilayahId: "",
  sandi: "",
};

export function KelolaAkun({
  daftar,
  wilayah,
  butuhWilayah,
  adaServiceRole,
}: {
  daftar: Akun[];
  wilayah: Wilayah[];
  butuhWilayah: boolean;
  adaServiceRole: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"tutup" | "baru" | "edit">("tutup");
  const [diedit, setDiedit] = useState<Akun | null>(null);
  const [form, setForm] = useState<MasukanAkun>(KOSONG);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [cari, setCari] = useState("");

  function ubah<K extends keyof MasukanAkun>(k: K, v: MasukanAkun[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setGalat((g) => {
      if (!g[k]) return g;
      const baru = { ...g };
      delete baru[k];
      return baru;
    });
  }

  function bukaBaru() {
    setMode("baru");
    setDiedit(null);
    setForm(KOSONG);
    setGalat({});
    setPesan(null);
  }

  function bukaEdit(a: Akun) {
    setMode("edit");
    setDiedit(a);
    setForm({
      id: a.id,
      nama: a.nama,
      email: a.email,
      peran: a.peran,
      wilayahId: a.wilayah_id ?? "",
      sandi: "",
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

    const hasil =
      mode === "edit" ? await ubahAkun(form) : await buatAkun(form);

    setMemuat(false);

    if (!hasil.sukses) {
      if (hasil.galat) setGalat(hasil.galat);
      setPesan(hasil.pesan);
      return;
    }

    tutup();
    router.refresh();
  }

  async function toggleStatus(a: Akun) {
    setMemuat(true);
    const hasil = await ubahStatusAkun(a.id, !a.aktif);
    setMemuat(false);
    setPesan(hasil.sukses ? hasil.pesan ?? null : hasil.pesan);
    if (hasil.sukses) router.refresh();
  }

  const perluWilayah = form.peran === "petugas" || form.peran === "admin_kabkota";

  const tersaring = daftar.filter((a) => {
    const q = cari.toLowerCase();
    return (
      !q ||
      a.nama.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q)
    );
  });

  const namaWilayah = (id: string | null) => {
    if (!id) return "—";
    const w = wilayah.find((x) => x.id === id);
    return w ? `${w.kab_kota}, ${w.provinsi}` : "—";
  };

  return (
    <div className="space-y-5">
      {!adaServiceRole && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-3 text-sm text-rose-900">
          <p className="font-semibold mb-1">
            Pembuatan akun belum dapat dilakukan
          </p>
          <p>
            <code>SUPABASE_SERVICE_ROLE_KEY</code> belum diisi di{" "}
            <code>.env.local</code>. Tambahkan nilainya dari Supabase Dashboard →
            Project Settings → API → <strong>service_role</strong>, lalu restart
            server.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari nama atau email…"
          className="text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white w-full sm:w-64"
        />
        <button
          type="button"
          onClick={mode === "baru" ? tutup : bukaBaru}
          disabled={!adaServiceRole}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
        >
          {mode === "baru" ? "Batal" : "+ Tambah akun"}
        </button>
      </div>

      {(mode === "baru" || mode === "edit") && (
        <form
          onSubmit={kirim}
          className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4"
        >
          <h3 className="font-display font-bold text-slate-900 text-sm">
            {mode === "edit" ? `Ubah akun: ${diedit?.nama}` : "Akun baru"}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nama lengkap" wajib galat={galat.nama}>
              <input
                type="text"
                required
                value={form.nama}
                onChange={(e) => ubah("nama", e.target.value)}
                className={kelasField(galat.nama)}
                placeholder="Nama petugas"
              />
            </Field>

            <Field
              label="Email"
              wajib
              galat={galat.email}
              bantuan={
                mode === "edit"
                  ? "Email tidak dapat diubah dari sini"
                  : "Dipakai untuk masuk ke aplikasi"
              }
            >
              <input
                type="email"
                required
                disabled={mode === "edit"}
                value={form.email}
                onChange={(e) => ubah("email", e.target.value)}
                className={`${kelasField(galat.email)} ${
                  mode === "edit" ? "bg-slate-100 text-slate-500" : ""
                }`}
                placeholder="nama@kemenpppa.go.id"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Peran" wajib galat={galat.peran}>
              <select
                value={form.peran}
                onChange={(e) => ubah("peran", e.target.value as Peran)}
                className={kelasField(galat.peran)}
              >
                {(Object.keys(LABEL_PERAN) as Peran[]).map((p) => (
                  <option key={p} value={p}>
                    {LABEL_PERAN[p]}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Kabupaten/Kota"
              wajib={perluWilayah}
              galat={galat.wilayahId}
              bantuan={
                butuhWilayah
                  ? undefined
                  : "Hanya untuk peran petugas dan admin kab/kota"
              }
            >
              <select
                value={form.wilayahId ?? ""}
                onChange={(e) => ubah("wilayahId", e.target.value)}
                disabled={!perluWilayah}
                className={`${kelasField(galat.wilayahId)} ${
                  !perluWilayah ? "bg-slate-100 text-slate-400" : ""
                }`}
              >
                <option value="">Pilih kabupaten/kota…</option>
                {wilayah.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.kab_kota} — {w.provinsi}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            label={mode === "edit" ? "Kata sandi baru" : "Kata sandi"}
            wajib={mode === "baru"}
            galat={galat.sandi}
            bantuan={
              mode === "edit"
                ? "Kosongkan bila tidak ingin mengubah kata sandi"
                : "Minimal 8 karakter. Sampaikan kepada pengguna."
            }
          >
            <input
              type="password"
              autoComplete="new-password"
              value={form.sandi ?? ""}
              onChange={(e) => ubah("sandi", e.target.value)}
              className={kelasField(galat.sandi)}
            />
          </Field>

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
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold transition"
            >
              {memuat ? "Menyimpan…" : mode === "edit" ? "Simpan perubahan" : "Buat akun"}
            </button>
            <button
              type="button"
              onClick={tutup}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {pesan && mode === "tutup" && (
        <p
          role="alert"
          className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
        >
          {pesan}
        </p>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left font-semibold px-4 py-2.5">Nama</th>
                <th className="text-left font-semibold px-4 py-2.5">Email</th>
                <th className="text-left font-semibold px-4 py-2.5">Peran</th>
                <th className="text-left font-semibold px-4 py-2.5">Wilayah</th>
                <th className="text-center font-semibold px-4 py-2.5">Status</th>
                <th className="text-right font-semibold px-4 py-2.5">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tersaring.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                    {daftar.length === 0
                      ? "Belum ada akun."
                      : "Tidak ada akun yang cocok dengan pencarian."}
                  </td>
                </tr>
              ) : (
                tersaring.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {a.nama}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{a.email}</td>
                    <td className="px-4 py-3">
                      <Badge warna={WARNA_PERAN[a.peran]}>
                        {LABEL_PERAN[a.peran]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {namaWilayah(a.wilayah_id)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge warna={a.aktif ? "emerald" : "slate"}>
                        {a.aktif ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => bukaEdit(a)}
                        className="text-xs font-semibold text-blue-700 hover:underline mr-3"
                      >
                        Ubah
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStatus(a)}
                        disabled={memuat || !adaServiceRole}
                        className={`text-xs font-semibold hover:underline disabled:opacity-40 ${
                          a.aktif ? "text-rose-700" : "text-emerald-700"
                        }`}
                      >
                        {a.aktif ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
