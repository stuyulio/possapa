import Link from "next/link";
import { ambilChecklist, SEMUA_JENIS } from "@/lib/data/kepatuhan";
import { LABEL_JENIS } from "@/lib/validasi/laporan";
import { JENIS_HUNIAN, labelJenisHunian } from "@/lib/lokasi/jenis-hunian";
import { Badge } from "@/components/dashboard/panel";
import { FilterInput } from "./filter-input";
import { bacaFilter, ringkas, saringPos } from "./saring";

export const metadata = { title: "Input Laporan — Admin Pos SAPA" };
export const dynamic = "force-dynamic";

const LABEL_STATUS: Record<
  string,
  { teks: string; warna: "slate" | "amber" | "emerald" | "blue" }
> = {
  belum: { teks: "Belum", warna: "slate" },
  draf: { teks: "Tertahan", warna: "amber" },
  terkirim: { teks: "Terkirim", warna: "blue" },
  terverifikasi: { teks: "Verifikasi", warna: "emerald" },
};

/** Pilihan status untuk dropdown; urutannya mengikuti alur kerja. */
const PILIHAN_STATUS = [
  { nilai: "belum", label: "Belum diisi" },
  { nilai: "draf", label: "Tertahan (draf)" },
  { nilai: "terkirim", label: "Terkirim" },
  { nilai: "terverifikasi", label: "Terverifikasi" },
];

/**
 * Daftar semua Pos SAPA lintas wilayah untuk Admin Pusat.
 *
 * Pola halaman sengaja mengikuti /laporan-saya: lokasi dan periode dipilih di
 * sini, lalu formulir membawa keduanya lewat URL dan tidak menawarkan pemilih
 * sendiri. Dengan begitu mitigasi PRD §15 ("lokasi dipilih eksplisit di setiap
 * input") tetap berlaku untuk admin — satu-satunya bedanya, daftarnya tidak
 * dipersempit ke satu kabupaten/kota.
 *
 * Penyaringan dilakukan di memori (lihat `saring.ts`): seluruh Pos SAPA sudah
 * terambil untuk ringkasan, jadi tidak ada gunanya menambah query per filter.
 */
export default async function HalamanInputLaporanAdmin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filter = bacaFilter(params);
  // Periode bukan filter tampilan: ia memilih himpunan data yang diambil,
  // jadi dibaca terpisah dan diteruskan ke `ambilChecklist`.
  const periodeId =
    typeof params.periode === "string" && params.periode !== ""
      ? params.periode
      : undefined;

  // Admin Pusat melihat draf: simpanan yang tertahan karena anomali tersimpan
  // sebagai draf, dan harus terlihat di sini sebagai "Tertahan" agar Admin tahu
  // ada isian yang belum ia selesaikan.
  const checklist = await ambilChecklist(null, periodeId, { sertakanDraf: true });

  const idPeriode = checklist.periode?.id ?? "";
  const terpilih = saringPos(checklist.pos, filter);
  const total = ringkas(terpilih);
  // Target nasional tetap ditampilkan sebagai pembanding saat filter aktif,
  // supaya "3/5" tidak terbaca sebagai capaian seluruh program.
  const targetSemua = checklist.pos.length * SEMUA_JENIS.length;

  // Dikelompokkan per wilayah untuk tampilan; urutan baris sudah disiapkan
  // ambilChecklist (provinsi → kab/kota → lokasi).
  const kelompok = new Map<
    string,
    { kab_kota: string; provinsi: string; pos: typeof checklist.pos }
  >();
  for (const p of terpilih) {
    const kunci = `${p.provinsi ?? "—"}|${p.kab_kota ?? "—"}`;
    const ada = kelompok.get(kunci);
    if (ada) ada.pos.push(p);
    else
      kelompok.set(kunci, {
        kab_kota: p.kab_kota ?? "—",
        provinsi: p.provinsi ?? "—",
        pos: [p],
      });
  }

  return (
    <>
      <div className="mb-5">
        <h2 className="font-display text-xl font-extrabold text-slate-900">
          Input Laporan
        </h2>
        <p className="text-sm text-slate-500">
          Seluruh Pos SAPA lintas wilayah Admin Pusat
        </p>
      </div>

      {!checklist.periode ? (
        <div className="bg-white rounded-2xl border border-amber-200 p-6">
          <p className="text-sm text-slate-700">
            Belum ada periode pelaporan. Buat periode di{" "}
            <Link href="/admin/periode" className="text-blue-700 font-semibold hover:underline">
              menu Periode
            </Link>{" "}
            sebelum mengisi laporan.
          </p>
        </div>
      ) : (
        <>
          <FilterInput
            pos={checklist.pos.map((p) => ({
              id: p.pos_id,
              nama_lokasi: p.nama_lokasi,
              provinsi: p.provinsi,
              kab_kota: p.kab_kota,
              jenis_hunian: p.jenis_hunian,
            }))}
            periode={checklist.daftarPeriode.map((p) => ({
              nilai: p.id,
              label: p.label,
            }))}
            jenisTempat={JENIS_HUNIAN.map((j) => ({
              nilai: j.nilai,
              label: j.label,
            }))}
            jenisLaporan={SEMUA_JENIS.map((j) => ({
              nilai: j,
              label: LABEL_JENIS[j],
            }))}
            statusLaporan={PILIHAN_STATUS}
          />

          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 mb-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Periode
                </p>
                <p className="font-display font-bold text-slate-900">
                  {checklist.periode.label}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Laporan terverifikasi / terkirim
                </p>
                <p className="font-display text-2xl font-extrabold text-slate-900">
                  {total.selesai}
                  <span className="text-sm font-semibold text-slate-400">
                    {" "}
                    / {total.target}
                  </span>
                </p>
                <p className="text-[10px] text-slate-400">
                  dari {targetSemua} target seluruh Pos
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Pos SAPA aktif
                </p>
                <p className="font-display text-2xl font-extrabold text-slate-900">
                  {total.jumlahPos}
                </p>
                <p className="text-[10px] text-slate-400">
                  dari {checklist.pos.length} Pos total
                </p>
              </div>
            </div>
          </div>

          {checklist.pos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-amber-200 p-6">
              <h3 className="font-display font-bold text-slate-900">
                Belum ada lokasi Pos SAPA aktif
              </h3>
              <p className="text-sm text-slate-600 mt-2">
                Tambahkan lokasi lebih dulu di{" "}
                <Link href="/admin/wilayah" className="text-blue-700 font-semibold hover:underline">
                  Wilayah &amp; Lokasi
                </Link>
                .
              </p>
            </div>
          ) : terpilih.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-display font-bold text-slate-900">
                Tidak ada Pos SAPA yang cocok
              </h3>
              <p className="text-sm text-slate-600 mt-2">
                Longgarkan filter atau pilih provinsi/kabupaten lain. Bila
                filter status sedang aktif, Pos yang lolos hanya yang status
                laporannya persis seperti yang dipilih.
              </p>
              <Link
                href={`/admin/input-laporan?periode=${idPeriode}`}
                className="inline-block mt-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl no-print"
              >
                Reset filter
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {[...kelompok.entries()].map(([kunci, g]) => (
                <section key={kunci}>
                  <h3 className="font-display font-bold text-slate-900 text-sm mb-2">
                    {g.kab_kota}
                    <span className="font-normal text-slate-500">
                      {" "}
                      · {g.provinsi} · {g.pos.length} lokasi
                    </span>
                  </h3>

                  <div className="space-y-3">
                    {g.pos.map((p) => (
                      <div
                        key={p.pos_id}
                        className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
                      >
                        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">
                              {p.nama_lokasi}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {labelJenisHunian(
                                p.jenis_hunian,
                                p.jenis_hunian_lainnya
                              ) ?? "jenis tempat belum diisi"}{" "}
                              · {p.selesai} dari {SEMUA_JENIS.length} laporan
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
                            // Saat menyorot satu jenis laporan, baris jenis lain
                            // diredupkan agar mata tidak membaca semuanya.
                            const disorot =
                              !filter.lap || filter.lap === s.jenis;
                            return (
                              <li
                                key={s.jenis}
                                className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 ${
                                  disorot ? "" : "opacity-40"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <Badge warna={meta.warna}>{meta.teks}</Badge>
                                  <span className="text-xs sm:text-sm text-slate-800">
                                    {LABEL_JENIS[s.jenis]}
                                  </span>
                                </div>
                                <Link
                                  href={`/input?pos=${p.pos_id}&jenis=${s.jenis}&periode=${idPeriode}`}
                                  className="text-[11px] font-semibold text-blue-700 hover:underline no-print"
                                >
                                  {s.status === "belum"
                                    ? "Isi"
                                    : s.status === "draf"
                                      ? "Lanjutkan"
                                      : "Perbaiki"}{" "}
                                  →
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-900 mt-5">
        <p className="font-semibold mb-1">Catatan</p>
        <p>
          Laporan yang Anda simpan sebagai Admin Pusat langsung berstatus{" "}
          <strong>terverifikasi</strong> dan tercatat atas nama Anda sebagai
          verifikator. Bila datanya beranomali, catatan verifikasi wajib diisi
          agar alasannya tercatat. Setiap perubahan tercatat di{" "}
          <Link href="/admin/audit" className="font-semibold underline">
            Log Audit
          </Link>
          .
        </p>
      </div>
    </>
  );
}
