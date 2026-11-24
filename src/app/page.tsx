import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";
import { LogoKemenPPPA } from "@/components/brand/logo";
import { KakiHalaman } from "@/components/brand/kaki";
import { waktuPanjang } from "@/lib/format";

// Halaman publik boleh di-cache; data diperbarui tiap 5 menit.
export const revalidate = 300;

type Ringkasan = {
  provinsi: string;
  kab_kota: string;
  jumlah_pos_aktif: number;
  jumlah_pos_melapor: number;
  total_anak: number;
  total_perempuan: number;
  total_anak_disabilitas: number;
  total_aduan: number;
  total_aduan_ditindaklanjuti: number;
  total_aduan_simfoni: number;
  total_publikasi: number;
};

const nf = new Intl.NumberFormat("id-ID");

async function ambilRingkasan(): Promise<Ringkasan[]> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("publik_ringkasan")
      .select("*")
      .order("provinsi")
      .order("kab_kota");

    if (error) {
      console.error("[publik_ringkasan]", error.message);
      return [];
    }
    return (data ?? []) as Ringkasan[];
  } catch (err) {
    console.error("[publik_ringkasan] gagal terhubung", err);
    return [];
  }
}

type Pembaruan = {
  terakhir_diperbarui: string | null;
  jumlah_laporan: number;
  jumlah_terverifikasi: number;
};

async function ambilPembaruan(): Promise<Pembaruan | null> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("publik_pembaruan")
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[publik_pembaruan]", error.message);
      return null;
    }
    return (data as Pembaruan) ?? null;
  } catch (err) {
    console.error("[publik_pembaruan] gagal terhubung", err);
    return null;
  }
}

function KartuKpi({
  label,
  nilai,
  keterangan,
}: {
  label: string;
  nilai: string;
  keterangan?: string;
}) {
  return (
    <div className="kpi-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="font-display text-3xl font-extrabold text-slate-900 mt-1">
        {nilai}
      </p>
      {keterangan && (
        <p className="text-xs text-slate-500 mt-1">{keterangan}</p>
      )}
    </div>
  );
}

export default async function Beranda() {
  const [ringkasan, pembaruan] = await Promise.all([
    ambilRingkasan(),
    ambilPembaruan(),
  ]);

  const waktuDiperbarui = waktuPanjang(pembaruan?.terakhir_diperbarui);

  const total = ringkasan.reduce(
    (acc, r) => ({
      anak: acc.anak + Number(r.total_anak),
      perempuan: acc.perempuan + Number(r.total_perempuan),
      disabilitas: acc.disabilitas + Number(r.total_anak_disabilitas),
      aduan: acc.aduan + Number(r.total_aduan),
      ditindaklanjuti: acc.ditindaklanjuti + Number(r.total_aduan_ditindaklanjuti),
      simfoni: acc.simfoni + Number(r.total_aduan_simfoni),
      publikasi: acc.publikasi + Number(r.total_publikasi),
    }),
    {
      anak: 0,
      perempuan: 0,
      disabilitas: 0,
      aduan: 0,
      ditindaklanjuti: 0,
      simfoni: 0,
      publikasi: 0,
    }
  );

  const pctTl =
    total.aduan > 0 ? Math.round((total.ditindaklanjuti / total.aduan) * 100) : 0;
  const pctSimfoni =
    total.aduan > 0 ? Math.round((total.simfoni / total.aduan) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="exec-header text-white border-b-4 border-amber-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4 min-w-0">
              <LogoKemenPPPA className="h-12 w-12 sm:h-16 sm:w-16 shrink-0" />
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 px-3 py-1 rounded-full mb-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-amber-300">
                    Kementerian Pemberdayaan Perempuan dan Perlindungan Anak RI
                  </span>
                </div>
                <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold">
                  DASHBOARD CAPAIAN KINERJA{" "}
                  <span className="text-amber-400">POS SAPA</span>
                </h1>
                <p className="text-sm text-slate-300 mt-1">
                  Deputi Bidang Perlindungan Khusus Anak — Perlindungan Perempuan
                  dan Anak Pascabencana
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 no-print">
              <Link
                href="/masuk"
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition"
              >
                Masuk
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1">
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KartuKpi
            label="Anak penerima manfaat"
            nilai={nf.format(total.anak)}
            keterangan={`${nf.format(total.disabilitas)} anak penyandang disabilitas`}
          />
          <KartuKpi
            label="Perempuan penerima manfaat"
            nilai={nf.format(total.perempuan)}
          />
          <KartuKpi
            label="Pengaduan diterima"
            nilai={nf.format(total.aduan)}
            keterangan={`${pctTl}% ditindaklanjuti`}
          />
          <KartuKpi
            label="Tercatat SIMFONI PPA"
            nilai={`${pctSimfoni}%`}
            keterangan={`${nf.format(total.simfoni)} dari ${nf.format(total.aduan)} aduan`}
          />
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-display font-bold text-slate-900">
              Ringkasan per Kabupaten/Kota
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {ringkasan.length} wilayah sasaran
              {waktuDiperbarui && (
                <>
                  {" · "}
                  <span title="Waktu ubah laporan terakhir">
                    Data diperbarui {waktuDiperbarui}
                  </span>
                </>
              )}
            </p>
          </div>

          {ringkasan.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Belum ada data. Pastikan database sudah terhubung dan seed wilayah
              sudah dijalankan.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left font-semibold px-5 py-3 sticky left-0 bg-slate-50">
                      Kabupaten/Kota
                    </th>
                    <th className="text-left font-semibold px-5 py-3">Provinsi</th>
                    <th className="text-right font-semibold px-5 py-3">Pos aktif</th>
                    <th className="text-right font-semibold px-5 py-3">Melapor</th>
                    <th className="text-right font-semibold px-5 py-3">Anak</th>
                    <th className="text-right font-semibold px-5 py-3">Perempuan</th>
                    <th className="text-right font-semibold px-5 py-3">Aduan</th>
                    <th className="text-right font-semibold px-5 py-3">Publikasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ringkasan.map((r) => (
                    <tr key={`${r.provinsi}-${r.kab_kota}`} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-semibold text-slate-900 sticky left-0 bg-white">
                        {r.kab_kota}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{r.provinsi}</td>
                      <td className="px-5 py-3 text-right">{r.jumlah_pos_aktif}</td>
                      <td className="px-5 py-3 text-right">{r.jumlah_pos_melapor}</td>
                      <td className="px-5 py-3 text-right">{nf.format(r.total_anak)}</td>
                      <td className="px-5 py-3 text-right">{nf.format(r.total_perempuan)}</td>
                      <td className="px-5 py-3 text-right">{nf.format(r.total_aduan)}</td>
                      <td className="px-5 py-3 text-right">{nf.format(r.total_publikasi)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <div className="mt-10">
        <KakiHalaman />
      </div>
    </div>
  );
}
