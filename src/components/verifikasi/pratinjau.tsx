"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/dashboard/panel";
import { angka, tanggalPanjang, waktuPanjang } from "@/lib/format";
import { LABEL_JENIS } from "@/lib/validasi/laporan";
import { kegiatanTampilAnak, kegiatanTampilPerempuan } from "@/lib/kegiatan";
import type {
  Anomali,
  BarisVerifikasi,
  PratinjauLaporan,
} from "@/lib/data/verifikasi";
import { muatPratinjauLaporan } from "@/app/verifikasi/actions";

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

const STATUS_PENANGANAN: Record<string, string> = {
  dalam_proses: "Dalam proses",
  dirujuk: "Dirujuk",
  selesai: "Selesai",
};

const LABEL_SUMBER: Record<string, string> = {
  form_internal: "Formulir internal",
  google_form: "Impor Google Form",
};

/** Angka dari database bisa null pada baris lama; jangan biarkan NaN tampil. */
const n = (v: number | null | undefined) => angka(Number(v ?? 0));

/**
 * Dialog pratinjau isi laporan pada antrean verifikasi.
 *
 * Klik baris membuka dialog ini; tombol "Verifikasi laporan"/"Buka kunci" di
 * dalamnya meneruskan ke dialog aksi yang sudah ada. Isi laporan baru diambil
 * saat dialog dibuka, jadi antrean tetap ringan dan RLS tetap berjalan di
 * server.
 */
export function DialogPratinjau({
  baris,
  aksi,
  onAksi,
  tutup,
}: {
  baris: BarisVerifikasi;
  aksi: "verifikasi" | "bukaKunci";
  onAksi: (jenis: "verifikasi" | "bukaKunci", baris: BarisVerifikasi) => void;
  tutup: () => void;
}) {
  const [pratinjau, setPratinjau] = useState<PratinjauLaporan | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(true);
  const tutupRef = useRef(tutup);
  tutupRef.current = tutup;

  useEffect(() => {
    let dibatalkan = false;

    muatPratinjauLaporan(baris.id).then((hasil) => {
      if (dibatalkan) return;
      if (hasil.sukses) setPratinjau(hasil.data);
      else setGalat(hasil.pesan);
      setMemuat(false);
    });

    return () => {
      dibatalkan = true;
    };
  }, [baris.id]);

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

  const data = pratinjau;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) tutup();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-pratinjau"
        className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 my-auto"
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                id="judul-pratinjau"
                className="font-display font-bold text-slate-900"
              >
                Pratinjau laporan
              </h3>
              <Badge warna={baris.status === "terverifikasi" ? "emerald" : "blue"}>
                {baris.status === "terverifikasi" ? "Terverifikasi" : "Menunggu verifikasi"}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {baris.lokasi?.nama_lokasi ?? "—"} ·{" "}
              {LABEL_JENIS[baris.jenis_laporan] ?? baris.jenis_laporan}
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

        <div className="px-5 py-4 space-y-4">
          {/* Identitas laporan: cukup untuk mencocokkan baris yang sedang
              diperiksa dengan isinya, tanpa memuat ulang data baris. */}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <dt className="text-slate-500">Wilayah</dt>
              <dd className="font-semibold text-slate-900">
                {baris.lokasi?.kab_kota ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Periode</dt>
              <dd className="font-semibold text-slate-900">
                {baris.periode?.label ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Dikirim</dt>
              <dd className="font-semibold text-slate-900">
                {waktuPanjang(baris.submitted_at) ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Sumber</dt>
              <dd className="font-semibold text-slate-900">
                {LABEL_SUMBER[baris.sumber_input] ?? baris.sumber_input}
              </dd>
            </div>
          </dl>

          {baris.anomali.length > 0 && <KotakAnomali anomali={baris.anomali} />}

          {baris.catatan_buka_kunci && (
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
              <strong>Kunci pernah dibuka:</strong> {baris.catatan_buka_kunci}
            </p>
          )}

          {baris.catatan_verifikasi && (
            <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
              <strong>Catatan verifikasi:</strong> {baris.catatan_verifikasi}
            </p>
          )}

          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
              Isi laporan
            </h4>

            {memuat && (
              <p className="text-sm text-slate-500 py-6 text-center" role="status">
                Memuat rincian laporan…
              </p>
            )}

            {galat && (
              <p
                role="alert"
                className="text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5"
              >
                {galat}
              </p>
            )}

            {data && !data.rincian && (
              <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
                Laporan ini tercatat, tetapi data rinciannya tidak ditemukan di
                database.
              </p>
            )}

            {data?.rincian && <Rincian rincian={data.rincian} />}
          </div>

          {data?.link_dokumentasi && (
            <p className="text-xs">
              <a
                href={data.link_dokumentasi}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-700 hover:underline break-all"
              >
                Buka dokumentasi kegiatan ↗
              </a>
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={tutup}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition"
            >
              Tutup
            </button>
            {baris.bolehUbah ? (
              <button
                type="button"
                onClick={() => onAksi(aksi, baris)}
                className={`px-4 py-2 rounded-xl text-white text-sm font-semibold transition ${
                  aksi === "verifikasi"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {aksi === "verifikasi" ? "Verifikasi laporan →" : "Buka kunci →"}
              </button>
            ) : (
              <span className="text-[11px] text-slate-400 self-center">
                Lokasi ini di luar wilayah Anda
              </span>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function KotakAnomali({ anomali }: { anomali: Anomali[] }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-3">
      <p className="text-xs font-bold text-amber-900">
        {anomali.length} anomali terdeteksi pada data ini
      </p>
      <ul className="mt-2 space-y-1.5">
        {anomali.map((a) => (
          <li key={a.kode} className="text-[11px] text-amber-950">
            <span className="font-semibold">{JUDUL_ANOMALI[a.kode] ?? a.kode}</span>{" "}
            <span className="uppercase tracking-wide text-[10px]">({a.tingkat})</span>
            <br />
            {a.keterangan}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* =============================================================================
   Isi rincian per jenis laporan
   Label dan susunan mengikuti formulir input supaya verifikator membaca angka
   yang sama dengan yang diisi petugas.
   ============================================================================= */

type Rincian = NonNullable<PratinjauLaporan["rincian"]>;

function Rincian({ rincian }: { rincian: Rincian }) {
  switch (rincian.jenis) {
    case "aktivitas_anak":
      return <IsiAnak d={rincian.data} />;
    case "aktivitas_perempuan":
      return <IsiPerempuan d={rincian.data} />;
    case "rekap_pengaduan":
      return <IsiRekap d={rincian.data} />;
    case "tindak_lanjut_kasus":
      return <IsiKasus d={rincian.data} />;
    case "publikasi":
      return <IsiPublikasi d={rincian.data} />;
  }
}

function Bagian({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 first:mt-0">
      <h5 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
        {judul}
      </h5>
      {children}
    </section>
  );
}

function Sebaran({
  item,
  kolom = 3,
}: {
  item: { label: string; nilai: React.ReactNode }[];
  kolom?: 2 | 3 | 4 | 5;
}) {
  const grid = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-4",
    5: "sm:grid-cols-5",
  }[kolom];

  return (
    <dl className={`grid grid-cols-2 ${grid} gap-3`}>
      {item.map((i) => (
        <div key={i.label}>
          <dt className="text-[11px] text-slate-500">{i.label}</dt>
          <dd className="text-sm font-semibold text-slate-900">{i.nilai}</dd>
        </div>
      ))}
    </dl>
  );
}

function TeksPanjang({ label, isi }: { label: string; isi: string | null }) {
  if (!isi || isi.trim() === "") return null;
  return (
    <div className="mt-3">
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800 whitespace-pre-wrap break-words">
        {isi}
      </dd>
    </div>
  );
}

function Total({ item }: { item: { label: string; nilai: number }[] }) {
  return (
    <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-600">
      {item.map((i) => (
        <span key={i.label}>
          {i.label}: <strong className="text-slate-900">{n(i.nilai)}</strong>
        </span>
      ))}
    </p>
  );
}

/**
 * Daftar kegiatan pada pratinjau verifikasi.
 *
 * Daftarnya sudah dirapikan sebelum sampai ke sini (`kegiatanTampilAnak` /
 * `kegiatanTampilPerempuan`): laporan lama yang belum punya `kegiatan` tampil
 * sebagai satu kegiatan dari kolom ringkasannya, bukan hilang.
 */
function RincianKegiatan({ daftar }: { daftar: { nama: string; jenis: string }[] }) {
  if (daftar.length === 0) {
    return (
      <div className="mt-3">
        <dt className="text-[11px] text-slate-500">Kegiatan</dt>
        <dd className="text-sm text-slate-400">Belum ada rincian kegiatan</dd>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <dt className="text-[11px] text-slate-500">Kegiatan</dt>
      <dd className="mt-1 space-y-1">
        {daftar.map((k, i) => (
          <div key={i} className="text-sm text-slate-800">
            <span className="font-semibold">
              {daftar.length > 1 ? `${i + 1}. ` : ""}
              {k.nama}
            </span>
            {k.jenis && (
              <span className="text-slate-500"> — {k.jenis}</span>
            )}
          </div>
        ))}
      </dd>
    </div>
  );
}

function IsiAnak({ d }: { d: Extract<Rincian, { jenis: "aktivitas_anak" }>["data"] }) {
  return (
    <div>
      <Sebaran item={[{ label: "Jumlah kegiatan", nilai: n(d.jumlah_kegiatan) }]} />

      <dl>
        <RincianKegiatan
          daftar={kegiatanTampilAnak(
            d.kegiatan,
            d.nama_kegiatan,
            d.jenis_kegiatan ?? []
          ).map((k) => ({ nama: k.nama, jenis: k.jenis.join(", ") }))}
        />
      </dl>

      <Bagian judul="Penerima manfaat (total periode)">
        <Sebaran
          item={[
            { label: "Usia 0–5 tahun", nilai: n(d.usia_0_5) },
            { label: "Usia 6–12 tahun", nilai: n(d.usia_6_12) },
            { label: "Usia 13–17 tahun", nilai: n(d.usia_13_17) },
            { label: "Laki-laki", nilai: n(d.laki_laki) },
            { label: "Perempuan", nilai: n(d.perempuan) },
            { label: "Penyandang disabilitas", nilai: n(d.disabilitas) },
          ]}
        />
        <Total
          item={[
            {
              label: "Total per usia",
              nilai: Number(d.usia_0_5 ?? 0) + Number(d.usia_6_12 ?? 0) + Number(d.usia_13_17 ?? 0),
            },
            { label: "Total per jenis kelamin", nilai: Number(d.laki_laki ?? 0) + Number(d.perempuan ?? 0) },
          ]}
        />
      </Bagian>

      <Bagian judul="Temuan & tindak lanjut">
        <Sebaran
          item={[
            {
              label: "Perlu layanan lanjutan",
              nilai: n(d.perlu_layanan_lanjutan),
            },
          ]}
        />
        <dl>
          <TeksPanjang label="Temuan yang perlu ditindaklanjuti" isi={d.temuan} />
          <TeksPanjang label="Tindak lanjut temuan" isi={d.tindak_lanjut} />
        </dl>
      </Bagian>

      <Bagian judul="Hambatan/Kendala">
        <dl>
          <TeksPanjang label="Hambatan/Kendala" isi={d.hambatan} />
        </dl>
      </Bagian>
    </div>
  );
}

function IsiPerempuan({
  d,
}: {
  d: Extract<Rincian, { jenis: "aktivitas_perempuan" }>["data"];
}) {
  return (
    <div>
      <Sebaran
        item={[
          { label: "Jumlah kegiatan", nilai: n(d.jumlah_kegiatan) },
          { label: "Total peserta", nilai: n(d.total_ikut) },
        ]}
      />

      <dl>
        <RincianKegiatan
          daftar={kegiatanTampilPerempuan(
            d.kegiatan,
            d.nama_kegiatan,
            d.jenis_kegiatan
          ).map((k) => ({ nama: k.nama, jenis: k.jenis }))}
        />
      </dl>

      <Bagian judul="Kelompok sasaran (total periode)">
        <Sebaran
          kolom={5}
          item={[
            { label: "Kepala keluarga", nilai: n(d.kepala_keluarga) },
            { label: "Hamil", nilai: n(d.hamil) },
            { label: "Menyusui", nilai: n(d.menyusui) },
            { label: "Lansia", nilai: n(d.lansia) },
            { label: "Disabilitas", nilai: n(d.disabilitas) },
          ]}
        />
      </Bagian>

      <dl>
        <TeksPanjang label="Manfaat yang dirasakan" isi={d.manfaat} />
      </dl>

      <Bagian judul="Hambatan/Kendala">
        <dl>
          <TeksPanjang label="Hambatan/Kendala" isi={d.hambatan} />
        </dl>
      </Bagian>
    </div>
  );
}

function IsiRekap({ d }: { d: Extract<Rincian, { jenis: "rekap_pengaduan" }>["data"] }) {
  const nihil = d.status_bulan === "Nihil";
  const kategori =
    d.kekerasan_perempuan +
    d.kekerasan_anak +
    d.non_kekerasan_perempuan +
    d.non_kekerasan_anak;

  return (
    <div>
      <Sebaran
        item={[
          { label: "Status pelaporan", nilai: d.status_bulan },
          { label: "Aduan masuk", nilai: n(d.aduan_masuk) },
          { label: "Sudah ditindaklanjuti", nilai: n(d.sudah_ditindaklanjuti) },
          { label: "Tercatat di SIMFONI PPA", nilai: n(d.tercatat_simfoni) },
        ]}
      />

      {!nihil && (
        <Bagian judul="Rincian kategori aduan">
          <Sebaran
            item={[
              { label: "Kekerasan — perempuan", nilai: n(d.kekerasan_perempuan) },
              { label: "Kekerasan — anak", nilai: n(d.kekerasan_anak) },
              {
                label: "Non-kekerasan — perempuan",
                nilai: n(d.non_kekerasan_perempuan),
              },
              { label: "Non-kekerasan — anak", nilai: n(d.non_kekerasan_anak) },
            ]}
          />
          <Total
            item={[
              { label: "Jumlah kategori", nilai: kategori },
              { label: "Aduan masuk", nilai: d.aduan_masuk },
            ]}
          />
        </Bagian>
      )}

      <dl>
        <TeksPanjang
          label="Tindak lanjut penanganan kasus secara umum"
          isi={d.tindak_lanjut_umum}
        />
        <TeksPanjang label="Pihak yang terlibat" isi={d.pihak_terlibat} />
      </dl>
    </div>
  );
}

function IsiKasus({ d }: { d: Extract<Rincian, { jenis: "tindak_lanjut_kasus" }>["data"] }) {
  return (
    <div>
      <Sebaran
        item={[
          { label: "Kode kasus", nilai: d.kode_kasus || "—" },
          { label: "Tanggal aduan", nilai: tanggalPanjang(d.tanggal_aduan) },
          {
            label: "Kategori",
            nilai: d.kategori === "kekerasan" ? "Kekerasan" : "Non-kekerasan",
          },
          { label: "Jenis kasus", nilai: d.jenis_kasus || "—" },
        ]}
      />

      <Bagian judul="Profil korban / pelapor">
        <Sebaran
          kolom={4}
          item={[
            { label: "Jumlah korban", nilai: n(d.jumlah_korban) },
            { label: "Jenis kelamin", nilai: d.jenis_kelamin || "—" },
            { label: "Kelompok usia", nilai: d.kelompok_usia || "—" },
            { label: "Penyandang disabilitas", nilai: d.disabilitas ? "Ya" : "Tidak" },
          ]}
        />
        <dl>
          <TeksPanjang label="Kebutuhan korban" isi={d.kebutuhan_korban} />
          <TeksPanjang label="Bentuk tindak lanjut" isi={d.tindak_lanjut} />
        </dl>
      </Bagian>

      <Bagian judul="Penanganan">
        <Sebaran
          item={[
            {
              label: "Status penanganan",
              nilai: STATUS_PENANGANAN[d.status_penanganan] ?? d.status_penanganan,
            },
          ]}
        />
        <dl>
          <TeksPanjang label="Hambatan/kendala penanganan" isi={d.hambatan} />
        </dl>
      </Bagian>
    </div>
  );
}

function IsiPublikasi({
  d,
}: {
  d: Extract<Rincian, { jenis: "publikasi" }>["data"];
}) {
  return (
    <div>
      <Sebaran
        item={[
          { label: "Tanggal publikasi", nilai: tanggalPanjang(d.tanggal_publikasi) },
          { label: "Platform", nilai: d.platform || "—" },
          { label: "Nama akun", nilai: d.nama_akun || "—" },
          { label: "Kegiatan", nilai: d.kegiatan || "—" },
        ]}
      />

      <div className="mt-4 space-y-2 text-xs">
        <p>
          <span className="text-slate-500">Link publikasi media sosial: </span>
          {d.link_publikasi ? (
            <a
              href={d.link_publikasi}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-blue-700 hover:underline break-all"
            >
              {d.link_publikasi}
            </a>
          ) : (
            <span className="text-slate-500">—</span>
          )}
        </p>
        <p>
          <span className="text-slate-500">Link penyimpanan dokumentasi: </span>
          {d.file_publikasi ? (
            <a
              href={d.file_publikasi}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-blue-700 hover:underline break-all"
            >
              {d.file_publikasi}
            </a>
          ) : (
            <span className="text-slate-500">tidak diisi</span>
          )}
        </p>
      </div>
    </div>
  );
}
