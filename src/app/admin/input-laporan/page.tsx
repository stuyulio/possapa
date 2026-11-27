import Link from "next/link";
import { ambilChecklist, SEMUA_JENIS } from "@/lib/data/kepatuhan";
import { LABEL_JENIS } from "@/lib/validasi/laporan";
import { labelJenisHunian } from "@/lib/lokasi/jenis-hunian";
import { Badge } from "@/components/dashboard/panel";

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

/**
 * Daftar semua Pos SAPA lintas wilayah untuk Admin Pusat.
 *
 * Pola halaman sengaja mengikuti /laporan-saya: lokasi dan periode dipilih di
 * sini, lalu formulir membawa keduanya lewat URL dan tidak menawarkan pemilih
 * sendiri. Dengan begitu mitigasi PRD §15 ("lokasi dipilih eksplisit di setiap
 * input") tetap berlaku untuk admin — satu-satunya bedanya, daftarnya tidak
 * dipersempit ke satu kabupaten/kota.
 */
export default async function HalamanInputLaporanAdmin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const periodeId = typeof params.periode === "string" ? params.periode : undefined;

  // Admin Pusat melihat draf: simpanan yang tertahan karena anomali tersimpan
  // sebagai draf, dan harus terlihat di sini sebagai "Tertahan" agar Admin tahu
  // ada isian yang belum ia selesaikan.
  const checklist = await ambilChecklist(null, periodeId, { sertakanDraf: true });

  const idPeriode = checklist.periode?.id ?? "";
  const totalTarget = checklist.pos.length * SEMUA_JENIS.length;

  // Dikelompokkan per wilayah untuk tampilan; urutan baris sudah disiapkan
  // ambilChecklist (provinsi → kab/kota → lokasi).
  const kelompok = new Map<
    string,
    { kab_kota: string; provinsi: string; pos: typeof checklist.pos }
  >();
  for (const p of checklist.pos) {
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
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold text-slate-900">
            Input Laporan
          </h2>
          <p className="text-sm text-slate-500">
            Seluruh Pos SAPA lintas wilayah Admin Pusat
          </p>
        </div>

        {checklist.daftarPeriode.length > 1 && (
          <form className="no-print flex items-center gap-2">
            <select
              name="periode"
              defaultValue={checklist.periode?.id ?? ""}
              className="text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white"
            >
              {checklist.daftarPeriode.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="text-xs font-semibold bg-slate-900 text-white px-3 py-2 rounded-xl"
            >
              Tampilkan
            </button>
          </form>
        )}
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
                  {checklist.ringkasan.selesai}
                  <span className="text-sm font-semibold text-slate-400">
                    {" "}
                    / {totalTarget}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Pos SAPA aktif
                </p>
                <p className="font-display text-2xl font-extrabold text-slate-900">
                  {checklist.pos.length}
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
                            return (
                              <li
                                key={s.jenis}
                                className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2"
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
