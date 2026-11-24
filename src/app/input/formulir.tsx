"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { simpanLaporan } from "./actions";
import { LABEL_JENIS, type JenisForm } from "@/lib/validasi/laporan";
import {
  bacaSaja as hitungBacaSaja,
  modeFormulir,
  type ModeFormulir,
  type StatusLaporan,
} from "@/lib/laporan";
import { Badge } from "@/components/dashboard/panel";
import { FormAnak, type NilaiAnak } from "@/components/form/form-anak";
import { FormPerempuan, type NilaiPerempuan } from "@/components/form/form-perempuan";
import { FormRekap, type NilaiRekap } from "@/components/form/form-rekap";
import { FormKasus, type NilaiKasus } from "@/components/form/form-kasus";
import { FormPublikasi, type NilaiPublikasi } from "@/components/form/form-publikasi";

type Pos = { id: string; nama_lokasi: string; jenis_hunian: string | null };

const NILAI_AWAL: Record<JenisForm, unknown> = {
  aktivitas_anak: {
    jumlah_kegiatan: 1,
    nama_kegiatan: "",
    jenis_kegiatan: [],
    usia_0_5: 0, usia_6_12: 0, usia_13_17: 0,
    laki_laki: 0, perempuan: 0,
    disabilitas: 0, perlu_layanan_lanjutan: 0,
    temuan: "", tindak_lanjut: "",
  } satisfies NilaiAnak,
  aktivitas_perempuan: {
    jumlah_kegiatan: 1,
    nama_kegiatan: "",
    jenis_kegiatan: "",
    total_ikut: 0, kepala_keluarga: 0,
    hamil_menyusui: 0, lansia: 0, disabilitas: 0,
    manfaat: "",
  } satisfies NilaiPerempuan,
  rekap_pengaduan: {
    status_bulan: "Nihil",
    aduan_masuk: 0, kekerasan_perempuan: 0, kekerasan_anak: 0,
    non_kekerasan_perempuan: 0, non_kekerasan_anak: 0,
    sudah_ditindaklanjuti: 0, tercatat_simfoni: 0,
    tindak_lanjut_umum: "", pihak_terlibat: "",
  } satisfies NilaiRekap,
  tindak_lanjut_kasus: {
    kode_kasus: "",
    tanggal_aduan: "",
    kategori: "kekerasan",
    jenis_kasus: "",
    jumlah_korban: 1,
    jenis_kelamin: "",
    kelompok_usia: "",
    disabilitas: false,
    kebutuhan_korban: "", tindak_lanjut: "",
    status_penanganan: "dalam_proses",
    sudah_simfoni: false,
    no_registrasi_simfoni: "",
    tanggal_input_simfoni: "",
    penginput_simfoni: "",
    alasan_belum_simfoni: "",
    hambatan: "",
  } satisfies NilaiKasus,
  publikasi: {
    tanggal_publikasi: "",
    kegiatan: "",
    platform: "Instagram",
    nama_akun: "",
    link_publikasi: "",
    file_publikasi: "",
  } satisfies NilaiPublikasi,
};

const KUNCI_DRAF = (posId: string) => `possapa_draf_${posId}`;

/** Status laporan tersimpan untuk satu jenis, plus penanda buka kunci. */
export type StatusJenis = {
  status: StatusLaporan;
  catatanBukaKunci: string | null;
};

/** pos_id -> periode_id -> jenis laporan -> isian tersimpan. */
export type NilaiServer = Record<
  string,
  Record<string, Partial<Record<JenisForm, Record<string, unknown>>>>
>;

/** Draf yang disimpan di localStorage per lokasi. */
type DrafLokal = {
  periodeId?: string;
  data?: Partial<Record<JenisForm, unknown>>;
};

export function FormulirInput({
  pos,
  wilayahNama,
  provinsiNama,
  periode,
  jenisAwal,
  nilaiServer = {},
  statusPerJenis = {},
}: {
  /** Lokasi yang diisi — ditentukan /laporan-saya, tidak dapat diubah di sini. */
  pos: Pos;
  wilayahNama: string;
  provinsiNama: string;
  /** Periode yang diisi — juga tetap. Lihat catatan di bawah. */
  periode: { id: string; label: string };
  jenisAwal: JenisForm;
  nilaiServer?: NilaiServer;
  /** Status tersimpan per jenis; yang tidak ada berarti belum pernah diisi. */
  statusPerJenis?: Partial<Record<JenisForm, StatusJenis>>;
}) {
  const router = useRouter();

  // Kombinasi lokasi + periode sengaja TIDAK dapat diubah dari halaman ini.
  //
  // Dua alasan. Pertama, PRD §15 mencatat risiko "satu petugas mengelola
  // beberapa lokasi sehingga laporan tertukar", dengan mitigasi "lokasi dipilih
  // eksplisit di setiap input". Pemilih lokasi DI DALAM formulir justru
  // membatalkan mitigasi itu: pos bisa berpindah setelah petugas menekan "Isi"
  // dari sel tertentu di /laporan-saya. Kedua, periode menimbulkan salah yang
  // lebih halus — tekan "Isi" di sel November, alihkan pemilih ke Desember,
  // lalu ketik angka November ke sana. Tidak terlihat sampai diverifikasi.
  //
  // Yang tetap dapat berpindah adalah JENIS laporan: kelimanya berbagi lokasi
  // dan periode yang sama, jadi tab jenis tidak membawa risiko itu sekaligus
  // memungkinkan mengisi lima laporan dalam satu duduk.
  const posId = pos.id;
  const periodeId = periode.id;

  const [jenis, setJenis] = useState<JenisForm>(jenisAwal);
  const [nilai, setNilai] = useState<Record<JenisForm, unknown>>(
    NILAI_AWAL as Record<JenisForm, unknown>
  );
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [tersimpan, setTersimpan] = useState<string | null>(null);

  // Menandai bahwa laporan baru saja terkirim, supaya penyimpan draf otomatis
  // tidak menulis ulang isian yang baru saja dihapus dari localStorage.
  const lewatiSimpan = useRef(false);

  // Disimpan di ref supaya efek di bawah tidak dipasang ulang saat induk
  // merender kembali — kalau tidak, isian pengguna bisa tertimpa.
  const serverRef = useRef(nilaiServer);
  serverRef.current = nilaiServer;

  /** Status satu jenis pada kombinasi yang dibuka; "belum" bila belum ada. */
  const statusJenis: StatusLaporan = statusPerJenis[jenis]?.status ?? "belum";
  const catatanBukaKunci =
    statusPerJenis[jenis]?.catatanBukaKunci ?? null;

  // Mode mengikuti JENIS yang sedang dibuka, bukan seluruh kombinasi: satu
  // lokasi dapat punya laporan anak yang sudah terkirim sementara rekapan
  // pengaduannya masih draf.
  const mode: ModeFormulir = modeFormulir(statusJenis, catatanBukaKunci);
  const bacaSaja = hitungBacaSaja(mode);
  // Draf pada jenis yang terkunci tetap tidak boleh ditulis; kalau tidak, draf
  // lokal dari kunjungan lama akan muncul dan menyesatkan.
  const bolehSimpanDraf = !bacaSaja && mode === "draf";

  /** Isian tersimpan di server untuk satu kombinasi, atau formulir kosong. */
  const dasarUntuk = useCallback(
    (j: JenisForm): Record<string, unknown> => {
      const tersimpan = serverRef.current[posId]?.[periodeId]?.[j];
      // Khusus jenis tindak lanjut kasus: `kode_kasus` tidak pernah diketik
      // petugas. Nilainya diturunkan database dari kab/kota dan tanggal, lalu
      // diisi via trigger. Kalau nilai tersimpan dari server ikut dimuat dan
      // ikut dikirim balik, validasi menolaknya sebagai diisikan sendiri.
      const bolehDimuat =
        j === "tindak_lanjut_kasus"
          ? Object.fromEntries(
              Object.entries(tersimpan ?? {}).filter(([k]) => k !== "kode_kasus")
            )
          : tersimpan;

      return bolehDimuat
        ? { ...(NILAI_AWAL[j] as Record<string, unknown>), ...bolehDimuat }
        : (NILAI_AWAL[j] as Record<string, unknown>);
    },
    [posId, periodeId]
  );

  /** Draf lokal yang tersimpan untuk kombinasi lokasi+periode ini. */
  const bacaDraf = useCallback((): DrafLokal | null => {
    const mentah = localStorage.getItem(KUNCI_DRAF(posId));
    if (!mentah) return null;
    try {
      const draf = JSON.parse(mentah) as DrafLokal;
      // Draf disimpan per lokasi, tetapi hanya berlaku untuk periode yang
      // sedang diisi.
      return draf.periodeId === periodeId ? draf : null;
    } catch {
      return null;
    }
  }, [posId, periodeId]);

  // Muat isian saat halaman dibuka.
  //
  // Urutan prioritasnya: isian tersimpan di server, lalu draf lokal di atasnya
  // (draf lokal adalah suntingan yang belum terkirim).
  useEffect(() => {
    const draf = bacaDraf();

    setNilai(() => {
      const gabung = {} as Record<JenisForm, unknown>;
      for (const j of Object.keys(NILAI_AWAL) as JenisForm[]) {
        // Untuk jenis yang terkunci, yang ditampilkan adalah isian tersimpan di
        // server — bukan draf lokal. Draf lokal adalah suntingan yang belum
        // pernah terkirim, jadi menampilkannya di atas laporan terkirim akan
        // memperlihatkan angka yang tidak pernah disetujui siapa pun.
        const s = statusPerJenis[j]?.status;
        gabung[j] =
          s === "terkirim" || s === "terverifikasi"
            ? dasarUntuk(j)
            : { ...dasarUntuk(j), ...(draf?.data?.[j] as object | undefined) };
      }
      return gabung;
    });

    if (draf?.data && !bacaSaja) {
      setPesan("Draf tersimpan di perangkat ini dipulihkan.");
    }
    // Dipasang sekali saat halaman dibuka; `statusPerJenis` tidak berubah di
    // sisi klien — setelah kirim berhasil halaman ini ditinggalkan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dasarUntuk, bacaDraf]);

  // Simpan draf otomatis (debounce 600 ms).
  useEffect(() => {
    // Setelah laporan terkirim, biarkan draf di localStorage terhapus seperti
    // yang dilakukan kirim(); jangan tulis ulang isian yang sudah tersimpan.
    if (lewatiSimpan.current) return;
    // Jenis yang terkunci tidak punya draf untuk ditulis, dan jenis yang baru
    // terkirim tidak boleh menulis ulang isian yang baru saja dihapus.
    if (!bolehSimpanDraf) return;

    const t = setTimeout(() => {
      const isi = dasarUntuk(jenis);
      const sekarang = nilai[jenis];
      if (JSON.stringify(sekarang) === JSON.stringify(isi)) return;

      // Gabungkan dengan draf jenis lain yang sudah ada agar tidak terhapus.
      const drafLama = bacaDraf();
      localStorage.setItem(
        KUNCI_DRAF(posId),
        JSON.stringify({
          periodeId,
          data: { ...(drafLama?.data ?? {}), ...nilai },
        })
      );
      setTersimpan(new Date().toLocaleTimeString("id-ID"));
    }, 600);
    return () => clearTimeout(t);
  }, [nilai, periodeId, jenis, posId, dasarUntuk, bacaDraf, bolehSimpanDraf]);

  const ubah = useMemo(
    () =>
      <K extends string>(k: K, v: unknown) => {
        setNilai((lama) => ({
          ...lama,
          [jenis]: {
            ...(lama[jenis] as Record<string, unknown>),
            [k]: v,
          },
        }));
        setGalat((g) => {
          if (!g[k]) return g;
          const baru = { ...g };
          delete baru[k];
          return baru;
        });
      },
    [jenis]
  );

  async function kirim(status: "draf" | "terkirim") {
    setMemuat(true);
    setPesan(null);
    setGalat({});

    // Server action dapat MELEMPAR, bukan hanya mengembalikan {sukses:false} —
    // misalnya koneksi terputus atau sesi berakhir di tengah permintaan. Tanpa
    // penangkap, await-nya menolak, setMemuat(false) tidak pernah jalan, dan
    // tombol tertinggal di "Menyimpan…" tanpa penjelasan apa pun.
    let hasil: Awaited<ReturnType<typeof simpanLaporan>>;
    try {
      hasil = await simpanLaporan({
        jenis,
        posId,
        periodeId,
        data: nilai[jenis],
        status,
      });
    } catch (e) {
      setPesan(
        `Gagal mengirim: ${
          e instanceof Error ? e.message : "koneksi ke server terputus"
        }. Isian Anda belum hilang — coba kirim lagi.`
      );
      return;
    } finally {
      setMemuat(false);
    }

    if (!hasil.sukses) {
      if ("galat" in hasil) {
        setGalat(hasil.galat);
        setPesan("Periksa kembali isian yang ditandai merah.");
      } else {
        setPesan(hasil.pesan);
      }
      return;
    }

    const drafLama = bacaDraf();

    if (status === "terkirim") {
      // Hapus draf jenis ini; jenis lain tetap tersimpan.
      if (drafLama?.data) {
        delete drafLama.data[jenis];
        localStorage.setItem(KUNCI_DRAF(posId), JSON.stringify(drafLama));
      }
      // Isian TIDAK dikosongkan di sini — halaman langsung ditinggalkan, jadi
      // tidak ada gunanya. Yang penting draf lokalnya sudah dihapus di atas.
      lewatiSimpan.current = true;

      // KEMBALI KE MODEL "LANGSUNG DITINGGALKAN".
      //
      // Versi sebelumnya menandai status lokal lalu menawarkan tombol
      // "Selesai — kembali ke Laporan Saya", dan itu menggantung: tidak ada
      // satu pun jalan di layar yang memaksanya selesai. Memilih satu perilaku
      // lebih baik daripada menawarkan dua — jadi halaman ini kembali
      // meninggalkan /input begitu kiriman berhasil, seperti biasa.
      //
      // Navigasi dengan URL lengkap, bukan router.refresh(): refresh()
      // mengirim ulang /input TANPA searchParams, sehingga penjaga parameter di
      // page.tsx mem-`redirect()` ke /laporan-saya tanpa periode — persis bug
      // "dikembalikan ke periode sebelumnya" yang pernah diperbaiki. URL
      // lengkap membuat halaman tujuan dirender segar.
      router.push(`/laporan-saya?periode=${periodeId}`);
    } else {
      setPesan("Draf disimpan.");
    }
  }

  const data = nilai[jenis] as never;

  return (
    <div className="space-y-5">
      {/* Identitas — terkunci. Berasal dari sel yang diklik di /laporan-saya. */}
      <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Identitas laporan
          </p>
          <Link
            href="/laporan-saya"
            className="text-[11px] font-semibold text-blue-700 hover:underline no-print"
          >
            ← Kembali ke Laporan Saya
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <span className="text-xs text-slate-500">Lokasi Pos SAPA</span>
            <p className="font-semibold text-slate-900">
              {pos.nama_lokasi}
              {pos.jenis_hunian ? (
                <span className="font-normal text-slate-500">
                  {" "}
                  ({pos.jenis_hunian})
                </span>
              ) : null}
            </p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Kabupaten/Kota</span>
            <p className="font-semibold text-slate-900">{wilayahNama}</p>
            <p className="text-[11px] text-slate-500">{provinsiNama}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Periode</span>
            <p className="font-semibold text-slate-900">{periode.label}</p>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-3">
          Lokasi dan periode mengikuti sel yang Anda pilih di Laporan Saya,
          sehingga tidak dapat diubah dari sini. Untuk lokasi atau periode lain,
          kembali ke daftar lalu pilih selnya.
        </p>
      </div>

      {/* Pilih jenis laporan */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
          Jenis laporan
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {(Object.keys(LABEL_JENIS) as JenisForm[]).map((j) => {
            const s = statusPerJenis[j]?.status ?? "belum";
            const catatan = statusPerJenis[j]?.catatanBukaKunci ?? null;
            const terkunci = modeFormulir(s, catatan) === "lihat";
            return (
              <button
                key={j}
                type="button"
                onClick={() => {
                  setJenis(j);
                  setGalat({});
                  setPesan(null);
                }}
                aria-pressed={jenis === j}
                className={`text-left px-3 py-2.5 rounded-xl text-xs font-semibold border transition ${
                  jenis === j
                    ? "bg-blue-600 text-white border-blue-600"
                    : terkunci
                      ? "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"
                      : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  {LABEL_JENIS[j]}
                  {terkunci && (
                    <span
                      className={
                        jenis === j
                          ? "text-white/80"
                          : "text-slate-400 font-bold"
                      }
                      title="Terkirim — hanya dapat dibaca"
                    >
                      🔒
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Keterangan status jenis yang sedang dibuka. */}
      {(bacaSaja || catatanBukaKunci) && (
        <div
          className={`rounded-2xl border p-4 text-sm ${
            bacaSaja
              ? "bg-blue-50 border-blue-200 text-blue-900"
              : "bg-amber-50 border-amber-200 text-amber-900"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge warna={bacaSaja ? "blue" : "amber"}>
              {statusJenis === "terverifikasi"
                ? "Sudah diverifikasi"
                : "Sudah terkirim"}
            </Badge>
            <span className="font-semibold">
              {bacaSaja
                ? "Tampilan baca-saja"
                : "Kunci dibuka Admin — silakan perbaiki lalu kirim ulang"}
            </span>
          </div>
          {bacaSaja ? (
            <p>
              Laporan ini sudah dikirim dan sedang menunggu verifikasi, jadi
              isinya hanya dapat dilihat — bukan diubah. Bila ada yang perlu
              diperbaiki, minta Admin membuka kuncinya.
            </p>
          ) : (
            <p>
              <strong>Alasan dibuka Admin:</strong> {catatanBukaKunci}
            </p>
          )}
        </div>
      )}

      {/* Formulir */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
        {jenis === "aktivitas_anak" && (
          <FormAnak
            nilai={data}
            ubah={ubah}
            galat={galat}
            bacaSaja={bacaSaja}
          />
        )}
        {jenis === "aktivitas_perempuan" && (
          <FormPerempuan
            nilai={data}
            ubah={ubah}
            galat={galat}
            bacaSaja={bacaSaja}
          />
        )}
        {jenis === "rekap_pengaduan" && (
          <FormRekap
            nilai={data}
            ubah={ubah}
            galat={galat}
            bacaSaja={bacaSaja}
          />
        )}
        {jenis === "tindak_lanjut_kasus" && (
          <FormKasus
            nilai={data}
            ubah={ubah}
            galat={galat}
            bacaSaja={bacaSaja}
          />
        )}
        {jenis === "publikasi" && (
          <FormPublikasi
            nilai={data}
            ubah={ubah}
            galat={galat}
            bacaSaja={bacaSaja}
          />
        )}
      </div>

      {pesan && (
        <p
          role="status"
          className={`text-sm rounded-xl px-3 py-2.5 border ${
            pesan.includes("berhasil") || pesan.includes("Draf")
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-amber-50 border-amber-200 text-amber-900"
          }`}
        >
          {pesan}
        </p>
      )}

      {bacaSaja ? (
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/laporan-saya?periode=${periodeId}`}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition no-print"
          >
            ← Kembali ke Laporan Saya
          </Link>
          <span className="text-xs text-slate-500">
            Tidak ada yang dapat diubah di tampilan ini.
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => kirim("terkirim")}
            disabled={memuat}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm transition"
          >
            {memuat
              ? "Menyimpan…"
              : mode === "ulang"
                ? "Kirim ulang laporan"
                : "Kirim laporan"}
          </button>

          {/* "Simpan draf" tidak ditawarkan setelah Admin membuka kunci: draf
              menghapus penanda buka kunci, sehingga alasan perbaikan dari Admin
              ikut hilang tanpa jejak. */}
          {mode === "draf" && (
            <button
              type="button"
              onClick={() => kirim("draf")}
              disabled={memuat}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 font-semibold text-sm transition"
            >
              Simpan draf
            </button>
          )}

          {!bacaSaja && tersimpan && (
            <span className="text-xs text-slate-500">
              Draf lokal tersimpan {tersimpan}
            </span>
          )}

          <Link
            href={`/laporan-saya?periode=${periodeId}`}
            className="text-xs font-semibold text-blue-700 hover:underline no-print"
          >
            Kembali ke Laporan Saya →
          </Link>
        </div>
      )}
    </div>
  );
}
