"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type Pos = {
  id: string;
  nama_lokasi: string;
  provinsi: string | null;
  kab_kota: string | null;
  jenis_hunian: string | null;
};

type Pilihan = { nilai: string; label: string };

/**
 * Bar filter halaman Input Laporan Admin Pusat.
 *
 * Setiap perubahan langsung ditulis ke query string lalu halaman disaring di
 * server (lihat `page.tsx`). State di URL — bukan di memori komponen — supaya
 * hasil saringan dapat di-refresh, di-bookmark, dan dibagikan ke Admin lain
 * tanpa kehilangan pilihannya.
 *
 * Pilihan turunan (kab/kota) dihitung dari `pos` yang sudah tersaring
 * provinsi, dan direset ketika induknya berubah. Tanpa reset, Admin bisa
 * terjebak melihat daftar kosong: provinsi diganti tetapi kab/kota lama yang
 * tidak ada di provinsi baru tetap terpasang.
 */
export function FilterInput({
  pos,
  periode,
  jenisTempat,
  jenisLaporan,
  statusLaporan,
}: {
  pos: Pos[];
  periode: Pilihan[];
  jenisTempat: Pilihan[];
  jenisLaporan: Pilihan[];
  statusLaporan: Pilihan[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [memuat, mulai] = useTransition();

  const provinsiTerpilih = searchParams.get("provinsi") ?? "";
  const kabTerpilih = searchParams.get("kabkota") ?? "";

  const daftarProvinsi = [
    ...new Set(pos.map((p) => p.provinsi).filter((v): v is string => Boolean(v))),
  ].sort((a, b) => a.localeCompare(b));

  const daftarKab = [
    ...new Set(
      pos
        .filter((p) => !provinsiTerpilih || p.provinsi === provinsiTerpilih)
        .map((p) => p.kab_kota)
        .filter((v): v is string => Boolean(v))
    ),
  ].sort((a, b) => a.localeCompare(b));

  const daftarLokasi = pos
    .filter((p) => !provinsiTerpilih || p.provinsi === provinsiTerpilih)
    .filter((p) => !kabTerpilih || p.kab_kota === kabTerpilih)
    .sort((a, b) => a.nama_lokasi.localeCompare(b.nama_lokasi));

  function ubah(kunci: string, nilai: string) {
    const params = new URLSearchParams(window.location.search);
    if (nilai) params.set(kunci, nilai);
    else params.delete(kunci);

    // Turunan direset saat induknya berubah.
    if (kunci === "provinsi") {
      params.delete("kabkota");
      params.delete("lokasi");
    }
    if (kunci === "kabkota") params.delete("lokasi");

    mulai(() => router.push(`${pathname}?${params.toString()}`));
  }

  // Kotak cari memakai masukan terkendali agar ketikan tidak hilang saat
  // halaman server selesai dimuat ulang. URL diperbarui setelah 350 ms tanpa
  // ketikan — menekan Enter tidak diperlukan, tetapi tetap ditangani.
  const [teksCari, setTeksCari] = useState(searchParams.get("cari") ?? "");
  // Diisi saat Reset: timer cari yang masih berjalan harus berhenti, kalau
  // tidak ia akan menulis ulang filter lama (lihat komentar di bawah).
  const lewatiCari = useRef(false);

  useEffect(() => {
    if (lewatiCari.current) {
      lewatiCari.current = false;
      return;
    }

    const t = setTimeout(() => {
      const nilai = teksCari.trim();
      // Dibaca dari URL saat ini, BUKAN dari `searchParams` yang tertangkap
      // saat efek dipasang: bila Admin mengganti filter lain di dalam jeda
      // 350 ms, salinan lama akan menghapus pilihan barunya.
      const params = new URLSearchParams(window.location.search);
      if ((params.get("cari") ?? "") === nilai) return;

      if (nilai) params.set("cari", nilai);
      else params.delete("cari");
      mulai(() => router.push(`${pathname}?${params.toString()}`));
    }, 350);
    return () => clearTimeout(t);
  }, [teksCari, pathname, router]);

  const jenisLaporanTerpilih = searchParams.get("lap") ?? "";
  const adaFilter = [
    "provinsi",
    "kabkota",
    "lokasi",
    "jenis",
    "lap",
    "status",
    "cari",
  ].some((k) => searchParams.get(k));

  const kelasSelect =
    "w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-700 focus:outline-none focus:border-blue-600";
  const kelasLabel = "block font-semibold text-slate-600 mb-1 text-[11px]";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 mb-5 no-print">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Filter
        </span>
        <div className="flex items-center gap-3">
          {memuat && (
            <span className="text-xs text-slate-400" role="status">
              Memuat…
            </span>
          )}
          {adaFilter && (
            <button
              type="button"
              onClick={() => {
                lewatiCari.current = true;
                setTeksCari("");
                // Periode bukan filter tampilan — ia memilih data mana yang
                // dimuat. Menghapusnya akan melempar Admin kembali ke periode
                // terbaru di tengah pekerjaan pada periode lama.
                const p = searchParams.get("periode");
                mulai(() =>
                  router.push(p ? `${pathname}?periode=${p}` : pathname)
                );
              }}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline"
            >
              Reset filter
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {periode.length > 1 && (
          <label>
            <span className={kelasLabel}>Periode</span>
            <select
              aria-label="Periode"
              className={kelasSelect}
              value={searchParams.get("periode") ?? periode[0]?.nilai ?? ""}
              onChange={(e) => ubah("periode", e.target.value)}
            >
              {periode.map((p) => (
                <option key={p.nilai} value={p.nilai}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          <span className={kelasLabel}>Provinsi</span>
          <select
            aria-label="Provinsi"
            className={kelasSelect}
            value={provinsiTerpilih}
            onChange={(e) => ubah("provinsi", e.target.value)}
          >
            <option value="">Semua provinsi</option>
            {daftarProvinsi.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className={kelasLabel}>Kabupaten/Kota</span>
          <select
            aria-label="Kabupaten/Kota"
            className={kelasSelect}
            value={kabTerpilih}
            onChange={(e) => ubah("kabkota", e.target.value)}
          >
            <option value="">Semua kabupaten/kota</option>
            {daftarKab.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className={kelasLabel}>Lokasi Pos SAPA</span>
          <select
            aria-label="Lokasi Pos SAPA"
            className={kelasSelect}
            value={searchParams.get("lokasi") ?? ""}
            onChange={(e) => ubah("lokasi", e.target.value)}
          >
            <option value="">Semua lokasi</option>
            {daftarLokasi.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama_lokasi}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className={kelasLabel}>Jenis Tempat</span>
          <select
            aria-label="Jenis Tempat"
            className={kelasSelect}
            value={searchParams.get("jenis") ?? ""}
            onChange={(e) => ubah("jenis", e.target.value)}
          >
            <option value="">Semua jenis tempat</option>
            {jenisTempat.map((j) => (
              <option key={j.nilai} value={j.nilai}>
                {j.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className={kelasLabel}>Jenis Laporan</span>
          <select
            aria-label="Jenis Laporan"
            className={kelasSelect}
            value={jenisLaporanTerpilih}
            onChange={(e) => {
              // Status tidak bermakna tanpa jenis; keduanya turun bersama.
              const params = new URLSearchParams(window.location.search);
              if (e.target.value) params.set("lap", e.target.value);
              else params.delete("lap");
              params.delete("status");
              mulai(() => router.push(`${pathname}?${params.toString()}`));
            }}
          >
            <option value="">Semua jenis laporan</option>
            {jenisLaporan.map((j) => (
              <option key={j.nilai} value={j.nilai}>
                {j.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className={kelasLabel}>Status Laporan</span>
          <select
            aria-label="Status Laporan"
            className={kelasSelect}
            value={searchParams.get("status") ?? ""}
            disabled={!jenisLaporanTerpilih}
            onChange={(e) => ubah("status", e.target.value)}
          >
            <option value="">
              {jenisLaporanTerpilih ? "Semua status" : "Pilih jenis dulu"}
            </option>
            {statusLaporan.map((s) => (
              <option key={s.nilai} value={s.nilai}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className={kelasLabel}>Cari lokasi</span>
          <input
            type="search"
            aria-label="Cari nama lokasi"
            value={teksCari}
            onChange={(e) => setTeksCari(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                ubah("cari", teksCari.trim());
              }
            }}
            placeholder="Nama lokasi Pos SAPA…"
            className={kelasSelect}
          />
        </label>
      </div>
    </div>
  );
}
