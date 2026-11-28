"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/dashboard/panel";
import { tanggalPendek } from "@/lib/format";
import {
  bacaTautanPublikasi,
  type BentukSematan,
  type JenisTautan,
  type TautanPublikasi,
} from "@/lib/tautan-publikasi";

export type PublikasiGaleri = {
  laporan_id: string;
  tanggal_publikasi: string;
  kegiatan: string | null;
  platform: string;
  nama_akun: string | null;
  link_publikasi: string;
  file_publikasi: string | null;
  kab_kota: string;
  lokasi: string;
};

/** Warna kartu per platform — supaya galeri terbaca sekilas, bukan seragam. */
const GAYA: Record<
  JenisTautan,
  { bidang: string; teks: string; tombol: string }
> = {
  youtube: {
    bidang: "from-rose-500 to-red-700",
    teks: "text-rose-700",
    tombol: "bg-rose-600 hover:bg-rose-700",
  },
  instagram: {
    bidang: "from-fuchsia-500 via-rose-500 to-amber-400",
    teks: "text-fuchsia-700",
    tombol: "bg-fuchsia-600 hover:bg-fuchsia-700",
  },
  facebook: {
    bidang: "from-blue-500 to-indigo-700",
    teks: "text-blue-700",
    tombol: "bg-blue-600 hover:bg-blue-700",
  },
  tiktok: {
    bidang: "from-slate-700 to-slate-900",
    teks: "text-slate-700",
    tombol: "bg-slate-800 hover:bg-slate-900",
  },
  drive: {
    bidang: "from-emerald-500 to-teal-700",
    teks: "text-emerald-700",
    tombol: "bg-emerald-600 hover:bg-emerald-700",
  },
  situs: {
    bidang: "from-slate-600 to-blue-900",
    teks: "text-slate-700",
    tombol: "bg-blue-600 hover:bg-blue-700",
  },
};

const GLIF: Record<Exclude<JenisTautan, "situs">, React.ReactNode> = {
  youtube: (
    <path d="M9 8.5v7l6-3.5-6-3.5Z" fill="currentColor" />
  ),
  instagram: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="15.6" cy="8.4" r="1" fill="currentColor" />
    </>
  ),
  facebook: (
    <path
      d="M13.6 8h1.9V5.4h-2.2c-2 0-3.2 1.2-3.2 3.3V10H7.9v2.6h2.2V19h2.7v-6.4h2.1l.4-2.6h-2.5V9c0-.6.3-1 1-1Z"
      fill="currentColor"
    />
  ),
  tiktok: (
    <path
      d="M14 5h-2.2v9.1a2 2 0 1 1-1.7-2v-2.2A4.2 4.2 0 1 0 14 14V9.4a5 5 0 0 0 3 1V8.2a3.2 3.2 0 0 1-3-3.2Z"
      fill="currentColor"
    />
  ),
  drive: (
    <path
      d="M10 6h4l4 7h-4l-4-7Zm-1.2 2.1L6 13.4l2 3.5h4.4l-3.6-8.8Zm6.4 4.9-1.7 3h5.4l1.7-3h-5.4Z"
      fill="currentColor"
    />
  ),
};

function Glif({ jenis, className }: { jenis: JenisTautan; className?: string }) {
  if (jenis === "situs") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="7" />
        <path d="M5 12h14M12 5c2.5 2.6 2.5 11.4 0 14M12 5c-2.5 2.6-2.5 11.4 0 14" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {GLIF[jenis]}
    </svg>
  );
}

const KELAS_BINGKAI: Record<BentukSematan, string> = {
  video: "aspect-video w-full",
  // Kiriman Instagram berbentuk persegi; bingkainya dibatasi tinggi supaya
  // dialog tidak melampaui layar laptop.
  persegi: "w-full max-w-[420px] aspect-[4/5] mx-auto",
  tegak: "w-full max-w-[360px] aspect-[9/16] max-h-[68vh] mx-auto",
  halaman: "w-full h-[62vh]",
};

/**
 * Bingkai isi tautan publikasi.
 *
 * Tiga keadaan, dan ketiganya disengaja:
 *  - YouTube: thumbnail dulu. Bingkai video baru dipasang setelah diklik —
 *    memuat pemutar YouTube untuk semua kartu akan jauh lebih berat, dan
 *    thumbnail sudah cukup untuk mengenali videonya.
 *  - Platform lain: iframe langsung ke endpoint sematan resminya.
 *  - Tanpa bentuk sematan: tidak ada yang bisa ditampilkan; ajakan membuka
 *    tab baru ditampilkan di tempat bingkai.
 */
function Bingkai({ tautan }: { tautan: TautanPublikasi }) {
  const [putar, setPutar] = useState(false);
  const gaya = GAYA[tautan.jenis];

  if (!tautan.sematan || !tautan.halaman) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
        <p className="text-sm font-semibold text-slate-700">
          Pratinjau tidak tersedia untuk tautan ini
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Tautan dianggap tidak sah atau tidak dikenali. Buka langsung di tab
          baru untuk memeriksanya.
        </p>
      </div>
    );
  }

  if (tautan.jenis === "youtube" && tautan.id) {
    if (!putar) {
      return (
        <button
          type="button"
          onClick={() => setPutar(true)}
          aria-label="Putar pratinjau video"
          className="group relative block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${tautan.id}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="aspect-video w-full object-cover opacity-90 transition group-hover:opacity-100"
          />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-rose-600/95 text-white shadow-lg transition group-hover:scale-105">
              <Glif jenis="youtube" className="h-7 w-7" />
            </span>
          </span>
        </button>
      );
    }
    return (
      <iframe
        src={`${tautan.sematan}?autoplay=1&rel=0`}
        title={tautan.label}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="aspect-video w-full rounded-xl border border-slate-200 bg-black"
      />
    );
  }

  return (
    <div className="space-y-2">
      <div
        className={`overflow-hidden rounded-xl border border-slate-200 bg-white ${KELAS_BINGKAI[tautan.bentuk]}`}
      >
        <iframe
          src={tautan.sematan}
          title={`Pratinjau ${tautan.label}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allow="autoplay; encrypted-media; picture-in-picture; clipboard-write; fullscreen"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
      {/* Tidak ada cara mendeteksi pencegahan iframe dari sisi klien: peramban
          menampilkan halaman kosong tanpa memicu galat. Karena itu keterangan
          ini tetap ditampilkan untuk semua situs, bukan hanya saat kosong. */}
      <p className={`text-[11px] ${gaya.teks}`}>
        Sebagian situs menolak ditampilkan di bingkai; bila area di atas kosong,
        gunakan tombol <strong>Buka publikasi</strong>.
      </p>
    </div>
  );
}

/**
 * Dialog pratinjau satu publikasi.
 *
 * Dipasang lewat portal supaya `position: fixed` tidak terperangkap oleh
 * induk ber-`transform` di dashboard, dan menutup lewat Esc, klik latar, atau
 * tombol tutup.
 */
function Dialog({
  publikasi,
  tutup,
}: {
  publikasi: PublikasiGaleri;
  tutup: () => void;
}) {
  const tautan = bacaTautanPublikasi(publikasi.link_publikasi);
  const dokumen = bacaTautanPublikasi(publikasi.file_publikasi);
  const gaya = GAYA[tautan.jenis];
  const tutupRef = useRef(tutup);
  tutupRef.current = tutup;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") tutupRef.current();
    }
    document.addEventListener("keydown", onKey);

    const overflowAwal = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflowAwal;
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) tutup();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-pratinjau-publikasi"
        className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-200 my-auto"
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge warna="slate">{publikasi.platform}</Badge>
              <span className="text-[11px] font-semibold text-slate-500">
                {tanggalPendek(publikasi.tanggal_publikasi)}
              </span>
            </div>
            <h3
              id="judul-pratinjau-publikasi"
              className="mt-1 font-display font-bold text-slate-900 leading-snug"
            >
              {publikasi.kegiatan ?? "Publikasi kegiatan"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {publikasi.nama_akun ? `${publikasi.nama_akun} · ` : ""}
              {publikasi.kab_kota} — {publikasi.lokasi}
            </p>
          </div>
          <button
            type="button"
            onClick={tutup}
            aria-label="Tutup"
            className="-mr-1 -mt-1 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
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

        <div className="px-4 sm:px-5 py-4">
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
            <Glif jenis={tautan.jenis} className="h-4 w-4 shrink-0" />
            <span className="truncate font-mono">
              {tautan.domain || publikasi.link_publikasi}
            </span>
          </div>

          <Bingkai tautan={tautan} />
        </div>

        <div className="px-4 sm:px-5 py-3 border-t border-slate-200 flex flex-wrap items-center gap-2">
          {tautan.halaman && (
            <a
              href={tautan.halaman}
              target="_blank"
              rel="noopener noreferrer"
              className={`px-3 py-1.5 rounded-xl text-white text-xs font-semibold transition ${gaya.tombol}`}
            >
              Buka publikasi di tab baru
            </a>
          )}
          {/* Dokumentasi opsional dan laporan lama bisa berisi nama berkas,
              bukan tautan — hanya tampilkan bila memang URL https. */}
          {publikasi.file_publikasi?.startsWith("https://") && (
            <a
              href={publikasi.file_publikasi}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
            >
              Buka dokumentasi
            </a>
          )}
          {dokumen.jenis === "drive" && (
            <span className="text-[11px] text-slate-400">
              Berkas Drive harus dibagikan publik agar dapat dibuka.
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Kartu galeri: bidang pratinjau + ringkasan, lalu tombol Pratinjau.
 *
 * Bidang pratinjau adalah tombolnya sendiri — di layar galeri, gambar
 * biasanya yang diklik lebih dulu, bukan tombol di bawahnya.
 */
export function KartuPublikasi({ publikasi }: { publikasi: PublikasiGaleri }) {
  const [buka, setBuka] = useState(false);
  const tautan = bacaTautanPublikasi(publikasi.link_publikasi);
  const gaya = GAYA[tautan.jenis];

  return (
    <article className="bg-slate-50/70 border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between">
      <div>
        <button
          type="button"
          onClick={() => setBuka(true)}
          aria-label={`Pratinjau publikasi: ${publikasi.kegiatan ?? publikasi.platform}`}
          className="group relative block h-36 w-full overflow-hidden text-left no-print"
        >
          {tautan.jenis === "youtube" && tautan.id ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://i.ytimg.com/vi/${tautan.id}/mqdefault.jpg`}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition group-hover:scale-[1.03]"
            />
          ) : (
            <div
              className={`flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br ${gaya.bidang}`}
            >
              <Glif jenis={tautan.jenis} className="h-8 w-8 text-white/90" />
              <span className="px-3 text-center text-[11px] font-semibold text-white/90">
                {tautan.domain || publikasi.platform}
              </span>
            </div>
          )}
          <span className="absolute inset-0 flex items-end justify-end p-2">
            <span className="rounded-full bg-slate-900/70 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
              Pratinjau
            </span>
          </span>
        </button>

        <div className="p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <Badge warna="slate">{publikasi.platform}</Badge>
            <span className="text-[11px] font-semibold text-slate-500">
              {tanggalPendek(publikasi.tanggal_publikasi)}
            </span>
          </div>
          <h3 className="font-semibold text-slate-900 text-sm leading-snug">
            {publikasi.kegiatan ?? "—"}
          </h3>
          <div className="text-xs text-slate-600 mt-2 space-y-0.5">
            <div>
              <strong>Akun:</strong> {publikasi.nama_akun ?? "—"}
            </div>
            <div>
              {publikasi.kab_kota} — {publikasi.lokasi}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 flex items-center flex-wrap gap-2">
        {/* Cetak: pratinjau adalah iframe, tidak berguna di kertas — tetapi
            tautan tercetak tetap berguna, jadi hanya tombol ini yang hilang. */}
        <button
          type="button"
          onClick={() => setBuka(true)}
          className={`no-print px-3 py-1.5 rounded-xl text-white text-xs font-semibold transition ${gaya.tombol}`}
        >
          Pratinjau
        </button>
        <a
          href={publikasi.link_publikasi}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
        >
          Buka publikasi
        </a>
        {publikasi.file_publikasi?.startsWith("https://") && (
          <a
            href={publikasi.file_publikasi}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
          >
            Dokumentasi
          </a>
        )}
      </div>

      {buka && (
        <Dialog publikasi={publikasi} tutup={() => setBuka(false)} />
      )}
    </article>
  );
}
