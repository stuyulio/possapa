"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { simpanPeriode, hapusPeriode } from "./actions";
import { Field, kelasField } from "@/components/form/field";
import { tanggalPanjang } from "@/lib/format";
import { cariTumpangTindih, idTerlibat } from "@/lib/periode";

export type Periode = {
  id: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  label: string;
  jumlah_laporan: number;
};

export function DaftarPeriode({ daftar }: { daftar: Periode[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"tutup" | "baru" | "edit">("tutup");
  const [diedit, setDiedit] = useState<Periode | null>(null);
  const [mulai, setMulai] = useState("");
  const [selesai, setSelesai] = useState("");
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [konfirmasiHapus, setKonfirmasiHapus] = useState<Periode | null>(null);

  function bukaBaru() {
    const hariIni = new Date();
    const awal = new Date(hariIni.getFullYear(), hariIni.getMonth(), 1);
    const akhir = new Date(hariIni.getFullYear(), hariIni.getMonth() + 1, 0);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    setMode("baru");
    setDiedit(null);
    setMulai(iso(awal));
    setSelesai(iso(akhir));
    setGalat({});
    setPesan(null);
  }

  function bukaEdit(p: Periode) {
    setMode("edit");
    setDiedit(p);
    setMulai(p.tanggal_mulai);
    setSelesai(p.tanggal_selesai);
    setGalat({});
    setPesan(null);
  }

  function tutup() {
    setMode("tutup");
    setDiedit(null);
    setGalat({});
    setPesan(null);
    setKonfirmasiHapus(null);
  }

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setMemuat(true);
    setGalat({});
    setPesan(null);

    const hasil = await simpanPeriode({
      id: mode === "edit" ? diedit?.id : undefined,
      tanggalMulai: mulai,
      tanggalSelesai: selesai,
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

  async function konfirmasi(p: Periode) {
    setMemuat(true);
    const hasil = await hapusPeriode(p.id);
    setMemuat(false);
    setKonfirmasiHapus(null);

    if (!hasil.sukses) {
      setPesan(hasil.pesan);
      return;
    }
    router.refresh();
  }

  const pratinjau =
    mulai && selesai && mulai <= selesai
      ? `${tanggalPanjang(mulai)} – ${tanggalPanjang(selesai)}`
      : null;

  // PRD §6.4: periode tidak boleh tumpang tindih. Diperingatkan, bukan
  // diblokir — data historis dari Google Form memang tumpang tindih (§6.5),
  // dan memblokir perubahan akan membuat master data yang ada tak dapat
  // dirapikan sama sekali.
  const tumpangTindih = useMemo(() => cariTumpangTindih(daftar), [daftar]);
  const idBermasalah = useMemo(() => idTerlibat(tumpangTindih), [tumpangTindih]);

  // Peringatan untuk rentang yang sedang diketik.
  const bentrokDengan = useMemo(() => {
    if (!mulai || !selesai || mulai > selesai) return [];
    return daftar.filter(
      (p) =>
        p.id !== diedit?.id &&
        p.tanggal_mulai <= selesai &&
        mulai <= p.tanggal_selesai
    );
  }, [daftar, mulai, selesai, diedit]);

  return (
    <div className="space-y-5">
      {tumpangTindih.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
          <p className="font-semibold">
            {tumpangTindih.length} pasangan periode tumpang tindih
          </p>
          <p className="mt-1">
            {idBermasalah.size} periode beririsan dengan periode lain. Laporan
            pada periode yang beririsan akan terhitung dua kali dalam tren dan
            perbandingan. Perbaiki tanggalnya melalui tombol Ubah.
          </p>
          <ul className="mt-2 space-y-0.5 text-xs">
            {tumpangTindih.slice(0, 8).map((t) => (
              <li key={`${t.a.id}-${t.b.id}`}>
                <strong>{t.a.label}</strong> ({t.a.tanggal_mulai} s/d{" "}
                {t.a.tanggal_selesai}) beririsan dengan{" "}
                <strong>{t.b.label}</strong> ({t.b.tanggal_mulai} s/d{" "}
                {t.b.tanggal_selesai})
              </li>
            ))}
            {tumpangTindih.length > 8 && (
              <li className="text-amber-800">
                …dan {tumpangTindih.length - 8} pasangan lainnya.
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={mode === "baru" ? tutup : bukaBaru}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
        >
          {mode === "baru" ? "Batal" : "+ Tambah periode"}
        </button>
      </div>

      {(mode === "baru" || mode === "edit") && (
        <form
          onSubmit={kirim}
          className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4"
        >
          <h3 className="font-display font-bold text-slate-900 text-sm">
            {mode === "edit" ? "Ubah periode" : "Periode baru"}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Tanggal mulai" wajib galat={galat.tanggalMulai}>
              <input
                type="date"
                required
                value={mulai}
                onChange={(e) => setMulai(e.target.value)}
                className={kelasField(galat.tanggalMulai)}
              />
            </Field>

            <Field label="Tanggal selesai" wajib galat={galat.tanggalSelesai}>
              <input
                type="date"
                required
                value={selesai}
                onChange={(e) => setSelesai(e.target.value)}
                className={kelasField(galat.tanggalSelesai)}
              />
            </Field>
          </div>

          {pratinjau && (
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              Label yang akan tampil: <strong>{pratinjau}</strong>
            </p>
          )}

          {bentrokDengan.length > 0 && (
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Rentang ini beririsan dengan {bentrokDengan.length} periode (
              {bentrokDengan.map((p) => p.label).join(", ")}). Disimpan tetap
              boleh, tetapi sebaiknya rentangnya dirapikan.
            </p>
          )}

          {diedit && diedit.jumlah_laporan > 0 && (
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Periode ini sudah dipakai <strong>{diedit.jumlah_laporan}</strong>{" "}
              laporan. Mengubah tanggal tidak memindahkan laporan — hanya mengubah
              label periode.
            </p>
          )}

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
              {memuat ? "Menyimpan…" : mode === "edit" ? "Simpan perubahan" : "Tambah periode"}
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
          className="text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"
        >
          {pesan}
        </p>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left font-semibold px-4 py-2.5">Periode</th>
                <th className="text-left font-semibold px-4 py-2.5">Tanggal</th>
                <th className="text-right font-semibold px-4 py-2.5">Laporan</th>
                <th className="text-right font-semibold px-4 py-2.5">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {daftar.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-slate-400">
                    Belum ada periode. Tambahkan periode pertama.
                  </td>
                </tr>
              ) : (
                daftar.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {p.label}
                      {idBermasalah.has(p.id) && (
                        <span
                          className="ml-2 align-middle inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200"
                          title="Rentang tanggal beririsan dengan periode lain"
                        >
                          tumpang tindih
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {p.tanggal_mulai} s/d {p.tanggal_selesai}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.jumlah_laporan > 0 ? (
                        <span className="font-semibold text-slate-900">
                          {p.jumlah_laporan}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => bukaEdit(p)}
                        className="text-xs font-semibold text-blue-700 hover:underline mr-3"
                      >
                        Ubah
                      </button>
                      {p.jumlah_laporan === 0 ? (
                        <button
                          type="button"
                          onClick={() => setKonfirmasiHapus(p)}
                          className="text-xs font-semibold text-rose-700 hover:underline"
                        >
                          Hapus
                        </button>
                      ) : (
                        <span
                          className="text-xs text-slate-300 cursor-not-allowed"
                          title="Periode yang sudah dipakai laporan tidak dapat dihapus"
                        >
                          Hapus
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {konfirmasiHapus && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5">
            <h3 className="font-display font-bold text-slate-900">
              Hapus periode?
            </h3>
            <p className="text-sm text-slate-600 mt-2">
              Periode <strong>{konfirmasiHapus.label}</strong> akan dihapus
              permanen. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => konfirmasi(konfirmasiHapus)}
                disabled={memuat}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold"
              >
                {memuat ? "Menghapus…" : "Hapus"}
              </button>
              <button
                type="button"
                onClick={() => setKonfirmasiHapus(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
