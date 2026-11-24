"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [pesanBaik, setPesanBaik] = useState(false);
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
    setPesanBaik(false);
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
    setPesanBaik(false);
  }

  function tutup() {
    setMode("tutup");
    setDiedit(null);
    setGalat({});
    setPesanBaik(false);
  }

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setMemuat(true);
    setGalat({});
    setPesan(null);
    setPesanBaik(false);

    const hasil =
      mode === "edit" ? await ubahAkun(form) : await buatAkun(form);

    setMemuat(false);

    if (!hasil.sukses) {
      if (hasil.galat) setGalat(hasil.galat);
      setPesan(hasil.pesan);
      return;
    }

    // Tutup dialog tetapi pertahankan pesan sukses agar terlihat pengguna.
    setMode("tutup");
    setDiedit(null);
    setGalat({});
    setPesan(hasil.pesan ?? "Tersimpan.");
    setPesanBaik(true);
    router.refresh();
  }

  async function toggleStatus(a: Akun) {
    setMemuat(true);
    const hasil = await ubahStatusAkun(a.id, !a.aktif);
    setMemuat(false);
    setPesan(hasil.sukses ? hasil.pesan ?? null : hasil.pesan);
    setPesanBaik(hasil.sukses);
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
          onClick={bukaBaru}
          disabled={!adaServiceRole}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
        >
          + Tambah akun
        </button>
      </div>

      {pesan && mode === "tutup" && (
        <p
          role="alert"
          className={`text-sm rounded-xl px-3 py-2 border ${
            pesanBaik
              ? "text-emerald-800 bg-emerald-50 border-emerald-200"
              : "text-slate-800 bg-slate-50 border-slate-200"
          }`}
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

      {mode !== "tutup" && (
        <DialogAkun
          mode={mode}
          diedit={diedit}
          form={form}
          galat={galat}
          pesan={pesan}
          memuat={memuat}
          perluWilayah={perluWilayah}
          butuhWilayah={butuhWilayah}
          wilayah={wilayah}
          ubah={ubah}
          kirim={kirim}
          tutup={tutup}
        />
      )}
    </div>
  );
}

/* =============================================================================
   Dialog akun — modal di atas halaman, bukan formulir di atas tabel.
   ============================================================================= */

function DialogAkun({
  mode,
  diedit,
  form,
  galat,
  pesan,
  memuat,
  perluWilayah,
  butuhWilayah,
  wilayah,
  ubah,
  kirim,
  tutup,
}: {
  mode: "baru" | "edit";
  diedit: Akun | null;
  form: MasukanAkun;
  galat: Record<string, string>;
  pesan: string | null;
  memuat: boolean;
  perluWilayah: boolean;
  butuhWilayah: boolean;
  wilayah: Wilayah[];
  ubah: <K extends keyof MasukanAkun>(k: K, v: MasukanAkun[K]) => void;
  kirim: (e: React.FormEvent) => void;
  tutup: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Konfirmasi sandi hanya hidup di dialog; tidak dikirim ke server.
  const [sandiKonfirmasi, setSandiKonfirmasi] = useState("");
  const [galatKonfirmasi, setGalatKonfirmasi] = useState<string | null>(null);
  const [tampilSandi, setTampilSandi] = useState(false);

  function kirimDialog(e: React.FormEvent) {
    e.preventDefault();
    if (form.sandi && form.sandi !== sandiKonfirmasi) {
      setGalatKonfirmasi("Konfirmasi kata sandi tidak cocok");
      return;
    }
    setGalatKonfirmasi(null);
    kirim(e);
  }

  // Simpan referensi terbaru agar efek di bawah tidak dipasang ulang tiap render.
  const tutupRef = useRef(tutup);
  const memuatRef = useRef(memuat);
  tutupRef.current = tutup;
  memuatRef.current = memuat;

  // Escape menutup dialog; kunci gulir halaman di belakangnya.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !memuatRef.current) tutupRef.current();
    }
    document.addEventListener("keydown", onKey);

    const overflowAwal = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflowAwal;
    };
  }, []);

  // Fokuskan isian pertama saat dialog terbuka.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const judul = mode === "edit" ? `Ubah akun: ${diedit?.nama ?? ""}` : "Akun baru";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
      onMouseDown={(e) => {
        // Klik pada latar (bukan isi panel) menutup dialog.
        if (e.target === e.currentTarget && !memuat) tutup();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-dialog-akun"
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 my-auto"
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200">
          <h3
            id="judul-dialog-akun"
            className="font-display font-bold text-slate-900"
          >
            {judul}
          </h3>
          <button
            type="button"
            onClick={tutup}
            disabled={memuat}
            aria-label="Tutup"
            className="-mr-1 -mt-1 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={kirimDialog} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nama lengkap" wajib galat={galat.nama}>
              <input
                ref={inputRef}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label={mode === "edit" ? "Kata sandi baru" : "Kata sandi"}
              wajib={mode === "baru"}
              galat={galat.sandi}
              bantuan={
                mode === "edit"
                  ? "Kosongkan bila tidak ingin mengubah"
                  : "Minimal 8 karakter"
              }
            >
              <div className="relative">
                <input
                  type={tampilSandi ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.sandi ?? ""}
                  onChange={(e) => {
                    ubah("sandi", e.target.value);
                    setGalatKonfirmasi(null);
                  }}
                  className={`${kelasField(galat.sandi)} pr-10`}
                />
                <TombolMata
                  tampil={tampilSandi}
                  onClick={() => setTampilSandi((v) => !v)}
                />
              </div>
            </Field>

            <Field
              label="Ulangi kata sandi"
              wajib={mode === "baru"}
              galat={galatKonfirmasi ?? undefined}
              bantuan={
                mode === "edit" ? "Isi bila mengganti kata sandi" : undefined
              }
            >
              <div className="relative">
                <input
                  type={tampilSandi ? "text" : "password"}
                  autoComplete="new-password"
                  value={sandiKonfirmasi}
                  onChange={(e) => {
                    setSandiKonfirmasi(e.target.value);
                    setGalatKonfirmasi(null);
                  }}
                  className={`${kelasField(galatKonfirmasi ?? undefined)} pr-10`}
                />
                <TombolMata
                  tampil={tampilSandi}
                  onClick={() => setTampilSandi((v) => !v)}
                />
              </div>
            </Field>
          </div>

          {pesan && (
            <p
              role="alert"
              className="text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"
            >
              {pesan}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={tutup}
              disabled={memuat}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 text-sm font-semibold transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={memuat}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold transition"
            >
              {memuat
                ? "Menyimpan…"
                : mode === "edit"
                  ? "Simpan perubahan"
                  : "Buat akun"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/* Tombol mata untuk menampilkan/menyembunyikan sandi. */
function TombolMata({
  tampil,
  onClick,
}: {
  tampil: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={tampil ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
      aria-pressed={tampil}
      title={tampil ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-r-xl"
    >
      {tampil ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A9.5 9.5 0 0112 5c5 0 9 4.5 9 7 0 .8-.6 1.9-1.6 3M6.2 6.7C4.2 8.2 3 10.2 3 12c0 2.5 4 7 9 7 1.3 0 2.5-.3 3.6-.8"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      )}
    </button>
  );
}
