import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ambilChecklist, SEMUA_JENIS } from "@/lib/data/kepatuhan";
import { LABEL_JENIS } from "@/lib/validasi/laporan";
import { terkunciUntukPetugas } from "@/lib/laporan";
import { labelJenisHunian } from "@/lib/lokasi/jenis-hunian";
import {
  peringatanPeriode,
  ringkasPeriodeBerjalan,
  tanggalJakarta,
} from "@/lib/periode-berjalan";
import { Badge } from "@/components/dashboard/panel";
import { PemilihPeriode } from "@/components/dashboard/pemilih-periode";

export const metadata = { title: "Laporan Saya — Pos SAPA" };
export const dynamic = "force-dynamic";

const LABEL_STATUS: Record<
  string,
  { teks: string; warna: "slate" | "amber" | "emerald" | "blue" }
> = {
  belum: { teks: "Belum", warna: "slate" },
  draf: { teks: "Draf", warna: "amber" },
  terkirim: { teks: "Terkirim", warna: "blue" },
  terverifikasi: { teks: "Verifikasi", warna: "emerald" },
};

const SINGKAT: Record<string, string> = {
  aktivitas_anak: "Anak",
  aktivitas_perempuan: "Perempuan",
  rekap_pengaduan: "Rekap",
  tindak_lanjut_kasus: "Kasus",
  publikasi: "Publikasi",
};

export default async function LaporanSaya({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const periodeId = typeof params.periode === "string" ? params.periode : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profil } = user
    ? await supabase
        .from("pengguna")
        .select("wilayah_id, peran")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  if (!profil?.wilayah_id) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-6">
        <h2 className="font-display font-bold text-slate-900">
          Akun belum terhubung ke kabupaten/kota
        </h2>
        <p className="text-sm text-slate-600 mt-2">
          Checklist kelengkapan laporan tersedia untuk petugas yang sudah
          ditugaskan ke satu kabupaten/kota. Hubungi Admin Pusat.
        </p>
      </div>
    );
  }

  const { data: wilayahData } = await supabase
    .from("wilayah")
    .select("kab_kota, provinsi")
    .eq("id", profil.wilayah_id)
    .maybeSingle();

  const wilayah = wilayahData as unknown as {
    kab_kota: string;
    provinsi: string;
  } | null;

  const checklist = await ambilChecklist(profil.wilayah_id, periodeId);
  const totalTarget = checklist.ringkasan.totalPos * SEMUA_JENIS.length;

  // Penanda periode berjalan. Periode pelaporan mingguan, jadi tanpa penanda
  // ini petugas tidak dapat membedakan "periode yang harus saya isi sekarang"
  // dari periode lampau yang kebetulan sedang terbuka.
  const hariIni = tanggalJakarta();
  const { berjalan, status: statusPeriode } = ringkasPeriodeBerjalan(
    checklist.daftarPeriode,
    hariIni
  );
  const peringatan = peringatanPeriode(checklist.periode, berjalan, hariIni);
  // Dipakai di dalam closure, jadi disimpan di variabel terpisah agar
  // penyempitan tipe tidak hilang.
  const idPeriode = checklist.periode?.id ?? "";

  return (
    <>
      <div className="mb-5">
        <h2 className="font-display text-xl font-extrabold text-slate-900">
          Laporan Saya
        </h2>
        <p className="text-sm text-slate-500">
          {wilayah?.kab_kota}, {wilayah?.provinsi} ·{" "}
          {checklist.ringkasan.totalPos} lokasi Pos SAPA
        </p>
      </div>

      {checklist.periode ? (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 mb-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Periode
                </p>
                <p className="font-display font-bold text-slate-900">
                  {checklist.periode.label}
                </p>
                {berjalan ? (
                  checklist.periode.id === berjalan.id ? (
                    <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                      ● Periode berjalan
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Periode berjalan: {berjalan.label}
                    </p>
                  )
                ) : (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Belum ada periode berjalan hari ini
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Laporan terkirim
                </p>
                <p className="font-display text-2xl font-extrabold text-slate-900">
                  {checklist.ringkasan.selesai}
                  <span className="text-sm font-semibold text-slate-400">
                    {" "}
                    / {totalTarget}
                  </span>
                </p>
              </div>
            </div>

            {checklist.daftarPeriode.length > 1 && (
              <div className="mt-4 no-print">
                <PemilihPeriode
                  terpilih={checklist.periode.id}
                  daftar={checklist.daftarPeriode.map((p) => {
                    // Penanda di tiap opsi membuat petugas dapat memilih
                    // periode yang benar tanpa membuka satu per satu.
                    const st = statusPeriode.get(p.id);
                    return {
                      id: p.id,
                      label: p.label,
                      tanda:
                        st === "berjalan"
                          ? " (berjalan)"
                          : st === "belum"
                            ? " (belum dimulai)"
                            : undefined,
                    };
                  })}
                />
              </div>
            )}
          </div>

          {peringatan && (
            <div
              className={`rounded-2xl p-4 text-sm mb-5 border ${
                peringatan.jenis === "lewat"
                  ? "bg-amber-50 border-amber-200 text-amber-900"
                  : "bg-blue-50 border-blue-200 text-blue-900"
              }`}
            >
              <p>{peringatan.teks}</p>
              {peringatan.jenis === "lewat" && (
                <p className="mt-1 text-[13px]">
                  Laporan yang dikirim ke periode lama tetap dihitung pada
                  periode itu — periksa kembali kalau niatnya mengisi periode
                  sekarang.
                </p>
              )}
            </div>
          )}

          {checklist.pos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-amber-200 p-6">
              <h3 className="font-display font-bold text-slate-900">
                Belum ada lokasi Pos SAPA aktif
              </h3>
              <p className="text-sm text-slate-600 mt-2">
                Tambahkan lokasi Pos SAPA (Huntap, Huntara, Dinas/UPTD PPPA,
                atau lainnya) di{" "}
                <strong>{wilayah?.kab_kota}</strong> terlebih dahulu, lalu
                checklist laporan akan muncul di sini.
              </p>
              <Link
                href="/lokasi-saya"
                className="inline-block mt-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl no-print"
              >
                + Tambah lokasi Pos SAPA
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {checklist.pos.map((p) => (
                <section
                  key={p.pos_id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">
                        {p.nama_lokasi}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {labelJenisHunian(
                          p.jenis_hunian,
                          p.jenis_hunian_lainnya
                        ) ?? "jenis tempat belum diisi"}{" "}
                        ·{" "}
                        {p.selesai} dari 5 laporan
                      </p>
                    </div>
                    <Link
                      href={`/input?pos=${p.pos_id}&periode=${idPeriode}`}
                      className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg no-print"
                    >
                      Input laporan
                    </Link>
                  </div>

                  <ul className="divide-y divide-slate-100">
                    {p.status.map((s) => {
                      const meta = LABEL_STATUS[s.status] ?? LABEL_STATUS.belum;
                      // Admin dapat membuka kunci laporan terverifikasi; statusnya
                      // kembali "terkirim" tetapi petugas tetap harus bisa
                      // memperbaikinya.
                      const dibuka = Boolean(s.catatanBukaKunci);
                      const bisaDiisi =
                        s.status === "belum" || s.status === "draf" || dibuka;
                      // Laporan terkirim terkunci: datanya tetap dapat DILIHAT
                      // petugas, tetapi tidak diubah sampai Admin memverifikasi
                      // atau membuka kuncinya. Sebelumnya sel ini tidak punya
                      // tautan apa pun, jadi isinya hanya terjangkau lewat URL
                      // yang diketik manual.
                      const terkunci = terkunciUntukPetugas(
                        s.status,
                        s.catatanBukaKunci
                      );
                      return (
                        <li key={s.jenis} className="px-4 py-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <Badge warna={dibuka ? "rose" : meta.warna}>
                                {dibuka ? "Perlu diperbaiki" : meta.teks}
                              </Badge>
                              <span className="text-xs sm:text-sm text-slate-800">
                                {LABEL_JENIS[s.jenis]}
                              </span>
                            </div>
                            {bisaDiisi ? (
                              <Link
                                href={`/input?pos=${p.pos_id}&jenis=${s.jenis}&periode=${idPeriode}`}
                                className="text-[11px] font-semibold text-blue-700 hover:underline no-print"
                              >
                                {s.status === "draf"
                                  ? "Lanjutkan"
                                  : dibuka
                                    ? "Perbaiki"
                                    : "Isi"}{" "}
                                →
                              </Link>
                            ) : terkunci ? (
                              <Link
                                href={`/input?pos=${p.pos_id}&jenis=${s.jenis}&periode=${idPeriode}`}
                                className="text-[11px] font-semibold text-slate-600 hover:underline no-print"
                              >
                                Lihat
                              </Link>
                            ) : null}
                          </div>

                          {dibuka && (
                            <p className="mt-1.5 text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
                              <strong>Alasan dibuka Admin:</strong>{" "}
                              {s.catatanBukaKunci} — formulir akan terisi data
                              yang tersimpan; ubah yang perlu lalu kirim ulang.
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-amber-200 p-6">
          <p className="text-sm text-slate-700">
            Belum ada periode pelaporan. Hubungi Admin Pusat.
          </p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-900 mt-5">
        <p className="font-semibold mb-1">Catatan</p>
        <p>
          Checklist menghitung laporan yang sudah <strong>dikirim</strong>, bukan
          draf. Setiap lokasi Pos SAPA dihitung terpisah — satu akun petugas
          mengelola seluruh lokasi di kabupaten/kotanya.
        </p>
      </div>
    </>
  );
}
