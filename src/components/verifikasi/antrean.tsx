"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Badge, Panel, TabelKosong } from "@/components/dashboard/panel";
import { waktuPanjang } from "@/lib/format";
import type { Anomali, AntreanVerifikasi, BarisVerifikasi } from "@/lib/data/verifikasi";
import { bukaKunciLaporan, verifikasiLaporan } from "@/app/verifikasi/actions";

const JENIS_SINGKAT: Record<string, string> = {
  aktivitas_anak: "Aktivitas Anak",
  aktivitas_perempuan: "Aktivitas Perempuan",
  rekap_pengaduan: "Rekap Pengaduan",
  tindak_lanjut_kasus: "Tindak Lanjut Kasus",
  publikasi: "Publikasi",
};

/** Judul ramah baca untuk kode anomali dari view `anomali_laporan`. */
const JUDUL_ANOMALI: Record<string, string> = {
  distribusi_usia: "Distribusi usia",
  subkelompok_perempuan: "Subkelompok perempuan",
  rekap_kategori: "Rincian kategori aduan",
  rekap_nihil: "Status Nihil",
  detail_hilang: "Rincian laporan hilang",
  periode_tumpang_tindih: "Periode tumpang tindih",
};

const WARNA_TINGKAT: Record<Anomali["tingkat"], "rose" | "amber"> = {
  tinggi: "rose",
  sedang: "amber",
};

type Dialog =
  | { jenis: "tutup" }
  | { jenis: "verifikasi"; baris: BarisVerifikasi }
  | { jenis: "bukaKunci"; baris: BarisVerifikasi };

export function AntreanVerifikasi({ antrean }: { antrean: AntreanVerifikasi }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>({ jenis: "tutup" });
  const [catatan, setCatatan] = useState("");
  const [pesan, setPesan] = useState<string | null>(null);
  const [pesanBaik, setPesanBaik] = useState(false);
  const [memuat, setMemuat] = useState(false);

  const menunggu = antrean.baris.filter((b) => b.status === "terkirim");
  const terverifikasi = antrean.baris.filter((b) => b.status === "terverifikasi");

  function buka(jenis: "verifikasi" | "bukaKunci", baris: BarisVerifikasi) {
    setDialog({ jenis, baris });
    setCatatan("");
    setPesan(null);
    setPesanBaik(false);
  }

  function tutup() {
    if (memuat) return;
    setDialog({ jenis: "tutup" });
  }

  async function kirim() {
    if (dialog.jenis === "tutup") return;

    setMemuat(true);
    setPesan(null);
    setPesanBaik(false);

    const hasil =
      dialog.jenis === "verifikasi"
        ? await verifikasiLaporan(dialog.baris.id, catatan)
        : await bukaKunciLaporan(dialog.baris.id, catatan);

    setMemuat(false);

    if (!hasil.sukses) {
      setPesan(hasil.pesan);
      return;
    }

    setDialog({ jenis: "tutup" });
    setPesan(hasil.pesan);
    setPesanBaik(true);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kotak label="Menunggu verifikasi" nilai={antrean.ringkasan.menunggu} aksen="amber" />
        <Kotak label="Sudah terverifikasi" nilai={antrean.ringkasan.terverifikasi} aksen="emerald" />
        <Kotak
          label="Laporan beranomali"
          nilai={antrean.ringkasan.beranomali}
          keterangan="Perlu catatan saat diverifikasi"
          aksen="amber"
        />
        <Kotak
          label="Anomali tingkat tinggi"
          nilai={antrean.ringkasan.anomaliTinggi}
          keterangan="Periksa sebelum menyetujui"
          aksen="rose"
        />
      </div>

      {pesan && dialog.jenis === "tutup" && (
        <p
          role="alert"
          className={`text-sm rounded-xl px-3.5 py-2.5 border ${
            pesanBaik
              ? "text-emerald-800 bg-emerald-50 border-emerald-200"
              : "text-rose-800 bg-rose-50 border-rose-200"
          }`}
        >
          {pesan}
        </p>
      )}

      <Panel
        judul="Menunggu verifikasi"
        keterangan={`${menunggu.length} laporan berstatus terkirim pada periode ini`}
      >
        <Tabel baris={menunggu} aksi="verifikasi" onAksi={buka} />
      </Panel>

      <Panel
        judul="Sudah terverifikasi"
        keterangan="Buka kunci bila petugas perlu memperbaiki datanya"
      >
        <Tabel baris={terverifikasi} aksi="bukaKunci" onAksi={buka} />
      </Panel>

      {dialog.jenis !== "tutup" && (
        <DialogVerifikasi
          dialog={dialog}
          catatan={catatan}
          setCatatan={setCatatan}
          pesan={pesan}
          memuat={memuat}
          kirim={kirim}
          tutup={tutup}
        />
      )}
    </div>
  );
}

function Kotak({
  label,
  nilai,
  keterangan,
  aksen,
}: {
  label: string;
  nilai: number;
  keterangan?: string;
  aksen: "amber" | "emerald" | "rose";
}) {
  const warna = {
    amber: "border-amber-200 bg-amber-50/60",
    emerald: "border-emerald-200 bg-emerald-50/60",
    rose: "border-rose-200 bg-rose-50/60",
  }[aksen];

  return (
    <div className={`rounded-2xl border p-4 ${warna}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </p>
      <p className="font-display text-2xl font-extrabold text-slate-900 mt-1">
        {nilai}
      </p>
      {keterangan && <p className="text-[11px] text-slate-600 mt-0.5">{keterangan}</p>}
    </div>
  );
}

function Tabel({
  baris,
  aksi,
  onAksi,
}: {
  baris: BarisVerifikasi[];
  aksi: "verifikasi" | "bukaKunci";
  onAksi: (jenis: "verifikasi" | "bukaKunci", baris: BarisVerifikasi) => void;
}) {
  if (baris.length === 0) {
    return (
      <table className="w-full text-sm">
        <tbody>
          <TabelKosong
            kolom={4}
            pesan={
              aksi === "verifikasi"
                ? "Tidak ada laporan yang menunggu verifikasi pada periode ini."
                : "Belum ada laporan yang diverifikasi pada periode ini."
            }
          />
        </tbody>
      </table>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-slate-600 border-b border-slate-200">
          <tr>
            <th className="text-left font-semibold py-2.5 pr-4">Lokasi</th>
            <th className="text-left font-semibold py-2.5 pr-4">Jenis laporan</th>
            <th className="text-left font-semibold py-2.5 pr-4">Waktu</th>
            <th className="text-right font-semibold py-2.5">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {baris.map((b) => {
            const waktu =
              b.status === "terverifikasi"
                ? waktuPanjang(b.verified_at)
                : waktuPanjang(b.submitted_at);

            return (
              <tr key={b.id} className="hover:bg-slate-50 align-top">
                <td className="py-3 pr-4">
                  <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                    {b.lokasi?.nama_lokasi ?? "—"}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {b.lokasi ? `${b.lokasi.kab_kota}, ${b.lokasi.provinsi}` : "—"}
                  </div>
                  {b.sumber_input === "google_form" && (
                    <span className="inline-block mt-1 text-[10px] font-semibold text-slate-500">
                      impor Google Form
                    </span>
                  )}
                </td>

                <td className="py-3 pr-4">
                  <div className="text-xs text-slate-700">
                    {JENIS_SINGKAT[b.jenis_laporan] ?? b.jenis_laporan}
                  </div>
                  <AnomaliBadges anomali={b.anomali} />
                  {b.catatan_buka_kunci && (
                    <p className="text-[11px] text-amber-800 mt-1">
                      Kunci pernah dibuka: {b.catatan_buka_kunci}
                    </p>
                  )}
                  {b.catatan_verifikasi && (
                    <p className="text-[11px] text-slate-600 mt-1">
                      Catatan verifikasi: {b.catatan_verifikasi}
                    </p>
                  )}
                </td>

                <td className="py-3 pr-4 text-[11px] text-slate-600 whitespace-nowrap">
                  {waktu ?? "—"}
                </td>

                <td className="py-3 text-right whitespace-nowrap">
                  {b.bolehUbah ? (
                    <button
                      type="button"
                      onClick={() => onAksi(aksi, b)}
                      className={`text-xs font-semibold hover:underline ${
                        aksi === "verifikasi" ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {aksi === "verifikasi" ? "Verifikasi" : "Buka kunci"}
                    </button>
                  ) : (
                    <span
                      className="text-[11px] text-slate-400"
                      title="Lokasi ini di luar wilayah Anda"
                    >
                      di luar wilayah
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AnomaliBadges({ anomali }: { anomali: Anomali[] }) {
  if (anomali.length === 0) {
    return (
      <span className="inline-block mt-1">
        <Badge warna="slate">Konsisten</Badge>
      </span>
    );
  }

  return (
    <div className="mt-1 space-y-1">
      <div className="flex flex-wrap gap-1">
        {anomali.map((a) => (
          <Badge key={a.kode} warna={WARNA_TINGKAT[a.tingkat]}>
            {JUDUL_ANOMALI[a.kode] ?? a.kode}
          </Badge>
        ))}
      </div>
      <ul className="space-y-0.5">
        {anomali.map((a) => (
          <li key={a.kode} className="text-[11px] text-slate-600">
            {a.keterangan}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* =============================================================================
   Dialog verifikasi / buka kunci
   ============================================================================= */

function DialogVerifikasi({
  dialog,
  catatan,
  setCatatan,
  pesan,
  memuat,
  kirim,
  tutup,
}: {
  dialog: Exclude<Dialog, { jenis: "tutup" }>;
  catatan: string;
  setCatatan: (v: string) => void;
  pesan: string | null;
  memuat: boolean;
  kirim: () => void;
  tutup: () => void;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const baris = dialog.baris;
  const verifikasi = dialog.jenis === "verifikasi";
  const wajibCatatan = verifikasi && baris.anomali.length > 0;

  // Buka kunci selalu butuh alasan; verifikasi butuh alasan bila beranomali.
  const butuhCatatan = !verifikasi || wajibCatatan;
  const catatanWajibKosong = butuhCatatan && catatan.trim() === "";

  const tutupRef = useRef(tutup);
  const memuatRef = useRef(memuat);
  tutupRef.current = tutup;
  memuatRef.current = memuat;

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

  useEffect(() => {
    areaRef.current?.focus();
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !memuat) tutup();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-dialog-verifikasi"
        className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 my-auto"
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200">
          <div>
            <h3
              id="judul-dialog-verifikasi"
              className="font-display font-bold text-slate-900"
            >
              {verifikasi ? "Verifikasi laporan" : "Buka kunci laporan"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {baris.lokasi?.nama_lokasi ?? "—"} ·{" "}
              {JENIS_SINGKAT[baris.jenis_laporan] ?? baris.jenis_laporan}
            </p>
          </div>
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

        <div className="px-5 py-4 space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-slate-500">Wilayah</dt>
              <dd className="font-semibold text-slate-900">
                {baris.lokasi ? `${baris.lokasi.kab_kota}, ${baris.lokasi.provinsi}` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Periode</dt>
              <dd className="font-semibold text-slate-900">{baris.periode?.label ?? "—"}</dd>
            </div>
          </dl>

          {baris.anomali.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-3">
              <p className="text-xs font-bold text-amber-900">
                {baris.anomali.length} anomali terdeteksi pada data ini
              </p>
              <ul className="mt-2 space-y-1.5">
                {baris.anomali.map((a) => (
                  <li key={a.kode} className="text-[11px] text-amber-950">
                    <span className="font-semibold">
                      {JUDUL_ANOMALI[a.kode] ?? a.kode}
                    </span>{" "}
                    <span className="uppercase tracking-wide text-[10px]">
                      ({a.tingkat})
                    </span>
                    <br />
                    {a.keterangan}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
              Tidak ada anomali. Angka pada laporan ini konsisten.
            </p>
          )}

          {!verifikasi && (
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
              Membuka kunci mengembalikan status ke <strong>terkirim</strong> agar
              petugas dapat memperbaiki. Petugas melihat alasan di bawah pada
              halaman Laporan Saya.
            </p>
          )}

          <div>
            <label
              htmlFor="catatan-verifikasi"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              {verifikasi ? "Catatan verifikasi" : "Alasan membuka kunci"}
              {butuhCatatan && (
                <span className="text-rose-600" aria-hidden="true">
                  {" "}
                  *
                </span>
              )}
            </label>
            <textarea
              id="catatan-verifikasi"
              ref={areaRef}
              rows={3}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder={
                verifikasi
                  ? wajibCatatan
                    ? "Jelaskan mengapa anomali ini diterima apa adanya…"
                    : "Opsional"
                  : "Apa yang harus diperbaiki petugas?"
              }
              className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {wajibCatatan && (
              <p className="text-[11px] text-slate-500 mt-1">
                Wajib diisi: laporan beranomali tidak boleh diverifikasi tanpa
                alasan tertulis.
              </p>
            )}
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
              type="button"
              onClick={kirim}
              disabled={memuat || catatanWajibKosong}
              className={`px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition ${
                verifikasi
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {memuat
                ? "Memproses…"
                : verifikasi
                  ? "Verifikasi laporan"
                  : "Buka kunci"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
