"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { simpanLaporan } from "./actions";
import {
  galatPenerimaManfaat,
  LABEL_JENIS,
  type JenisForm,
} from "@/lib/validasi/laporan";
import { labelJenisHunian } from "@/lib/lokasi/jenis-hunian";
import {
  bacaSaja as hitungBacaSaja,
  modeFormulir,
  modeFormulirAdmin,
  type ModeFormulir,
  type StatusLaporan,
} from "@/lib/laporan";
import { Badge } from "@/components/dashboard/panel";
import { FormAnak, type NilaiAnak } from "@/components/form/form-anak";
import { FormPerempuan, type NilaiPerempuan } from "@/components/form/form-perempuan";
import {
  gabungJenisAnak,
  gabungJenisPerempuan,
  potongKegiatan,
  rapikanKegiatanAnak,
  rapikanKegiatanPerempuan,
  ringkasNama,
  type KegiatanAnak,
  type KegiatanPerempuan,
} from "@/lib/kegiatan";
import { FormRekap, type NilaiRekap } from "@/components/form/form-rekap";
import { FormKasus, type NilaiKasus } from "@/components/form/form-kasus";
import { FormPublikasi, type NilaiPublikasi } from "@/components/form/form-publikasi";

type Pos = {
  id: string;
  nama_lokasi: string;
  jenis_hunian: string | null;
  jenis_hunian_lainnya: string | null;
};

const NILAI_AWAL: Record<JenisForm, unknown> = {
  aktivitas_anak: {
    jumlah_kegiatan: 1,
    kegiatan: [{ nama: "", jenis: [] }],
    usia_0_5: 0, usia_6_12: 0, usia_13_17: 0,
    laki_laki: 0, perempuan: 0,
    disabilitas: 0, perlu_layanan_lanjutan: 0,
    temuan: "", tindak_lanjut: "",
  } satisfies NilaiAnak,
  aktivitas_perempuan: {
    jumlah_kegiatan: 1,
    kegiatan: [{ nama: "", jenis: "" }],
    total_ikut: 0, kepala_keluarga: 0,
    hamil: 0, menyusui: 0, lansia: 0, disabilitas: 0,
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

/**
 * Isian tersimpan / draf lama dimuat ke formulir yang kini memakai kartu
 * kegiatan.
 *
 * Dua bentuk lama ditemui:
 *  1. Sebelum 27 Nov 2026, isian tidak punya `kegiatan` sama sekali — hanya
 *     `nama_kegiatan` dan `jenis_kegiatan` untuk satu laporan. Keduanya
 *     dipindahkan menjadi kegiatan pertama (lihat `rapikanKegiatanAnak`).
 *  2. Kolom `jenis_kegiatan` pada aktivitas anak dulu berupa larik; sesudah
 *     migrasi 20261127000002 kolom itu menjadi ringkasan untuk dashboard dan
 *     tidak lagi dikirim ke server. Isinya tetap dipindahkan ke kegiatan
 *     pertama, bukan dibuang, supaya Admin yang membuka kunci laporan lama
 *     melihat jenis yang pernah dipilih.
 */
function rapikanIsianAnak(
  isian: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...isian,
    kegiatan: rapikanKegiatanAnak(isian),
    // Ringkasan hanya untuk disimpan, bukan untuk diedit.
    nama_kegiatan: undefined,
    jenis_kegiatan: undefined,
  };
}

function rapikanIsianPerempuan(
  isian: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...isian,
    kegiatan: rapikanKegiatanPerempuan(isian),
    nama_kegiatan: undefined,
    jenis_kegiatan: undefined,
  };
}

/** Bentuk formulir untuk satu jenis — berlaku juga untuk draf yang dipulihkan. */
function rapikanIsian(
  jenis: JenisForm,
  isian: Record<string, unknown>
): Record<string, unknown> {
  if (jenis === "aktivitas_anak") return rapikanIsianAnak(isian);
  if (jenis === "aktivitas_perempuan") return rapikanIsianPerempuan(isian);
  return isian;
}

/**
 * Buang kolom ringkasan sebelum isian masuk ke formulir.
 *
 * Keduanya diturunkan dari `kegiatan` saat dikirim, jadi menyimpannya di state
 * formulir hanya menciptakan nilai basi yang bisa ikut ke draf lokal.
 */
function tanpaRingkasan(
  isian: Record<string, unknown>
): Record<string, unknown> {
  const salinan = { ...isian };
  delete salinan.nama_kegiatan;
  delete salinan.jenis_kegiatan;
  return salinan;
}

/**
 * Draf lama — ditulis sebelum "Hamil / Menyusui" dipisah — menyimpan satu
 * kolom gabungan `hamil_menyusui`. Tanpa pemindahan, angka itu hilang saat
 * draf dipulihkan karena kolom tersebut tidak lagi ada di formulir. Angkanya
 * dipindahkan utuh ke `hamil`, sama seperti perlakuan data historis di
 * database, dan kolom lamanya dibuang. Draf berbentuk baru tidak berubah.
 */
function pindahkanDrafLama(draf: DrafLokal): DrafLokal {
  const lama = draf.data?.aktivitas_perempuan as
    | Record<string, unknown>
    | undefined;
  if (!lama || !("hamil_menyusui" in lama)) return draf;

  const { hamil_menyusui, ...sisa } = lama;
  return {
    ...draf,
    data: {
      ...draf.data,
      aktivitas_perempuan: {
        ...sisa,
        hamil: sisa.hamil ?? hamil_menyusui,
        menyusui: sisa.menyusui ?? 0,
      },
    },
  };
}

export function FormulirInput({
  pos,
  wilayahNama,
  provinsiNama,
  periode,
  jenisAwal,
  nilaiServer = {},
  statusPerJenis = {},
  modeAdmin = false,
  kembaliHref,
  kembaliLabel = "Laporan Saya",
}: {
  /** Lokasi yang diisi — ditentukan halaman pemilih, tidak dapat diubah di sini. */
  pos: Pos;
  wilayahNama: string;
  provinsiNama: string;
  /** Periode yang diisi — juga tetap. Lihat catatan di bawah. */
  periode: { id: string; label: string };
  jenisAwal: JenisForm;
  nilaiServer?: NilaiServer;
  /** Status tersimpan per jenis; yang tidak ada berarti belum pernah diisi. */
  statusPerJenis?: Partial<Record<JenisForm, StatusJenis>>;
  /**
   * Admin Pusat: tidak mengenal draf maupun kunci, setiap simpan langsung
   * terverifikasi. Aturannya sendiri di `modeFormulirAdmin`, bukan variasi
   * aturan petugas.
   */
  modeAdmin?: boolean;
  /** Tujuan "kembali"; default halaman daftar untuk peran pemanggil. */
  kembaliHref?: string;
  kembaliLabel?: string;
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
  const urlKembali = kembaliHref ?? `/laporan-saya?periode=${periodeId}`;
  const labelHunian = labelJenisHunian(
    pos.jenis_hunian,
    pos.jenis_hunian_lainnya
  );

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
  //
  // Admin Pusat memakai aturan sendiri (`modeFormulirAdmin`): tidak ada draf
  // dan tidak ada kunci, jadi formulirnya tidak pernah baca-saja. Status
  // "terverifikasi" di sini berarti "sudah ada isinya", bukan "jangan disentuh".
  const mode: ModeFormulir = modeAdmin
    ? "baru"
    : modeFormulir(statusJenis, catatanBukaKunci);
  const bacaSaja = modeAdmin ? false : hitungBacaSaja(mode);
  const modeAdminJenis = modeAdmin ? modeFormulirAdmin(statusJenis) : null;
  // Admin Pusat tidak pernah menyimpan draf, jadi autosave lokal tidak berlaku
  // untuknya. Bagi petugas, draf pada jenis yang terkunci juga tidak ditulis:
  // kalau tidak, draf lama dari kunjungan sebelumnya muncul dan menyesatkan.
  const bolehSimpanDraf = !modeAdmin && !bacaSaja && mode === "draf";
  const [catatanVerifikasi, setCatatanVerifikasi] = useState("");

  /**
   * Bagian isian yang boleh dibawa ke formulir — apa pun bentuk asalnya.
   *
   * Dipakai untuk isian server maupun draf lokal. Isian dari server berbentuk
   * kolom database: `kegiatan` (jsonb) plus ringkasan `nama_kegiatan`/
   * `jenis_kegiatan`. Formulir memakai kartu kegiatan, jadi ringkasannya
   * dibuang dan rinciannya dirapikan — juga untuk laporan lama yang belum
   * punya `kegiatan` sama sekali.
   */
  const rapikanUntuk = useCallback(
    (j: JenisForm, isian: Record<string, unknown> | undefined) => {
      if (!isian) return { ...(NILAI_AWAL[j] as Record<string, unknown>) };

      // Khusus jenis tindak lanjut kasus: `kode_kasus` tidak pernah diketik
      // petugas. Nilainya diturunkan database dari kab/kota dan tanggal, lalu
      // diisi via trigger. Kalau nilai tersimpan dari server ikut dimuat dan
      // ikut dikirim balik, validasi menolaknya sebagai diisikan sendiri.
      const bolehDimuat =
        j === "tindak_lanjut_kasus"
          ? Object.fromEntries(
              Object.entries(isian).filter(([k]) => k !== "kode_kasus")
            )
          : tanpaRingkasan(isian);

      return rapikanIsian(j, {
        ...(NILAI_AWAL[j] as Record<string, unknown>),
        ...bolehDimuat,
      });
    },
    []
  );

  /** Isian tersimpan di server untuk satu kombinasi, atau formulir kosong. */
  const dasarUntuk = useCallback(
    (j: JenisForm): Record<string, unknown> =>
      rapikanUntuk(j, serverRef.current[posId]?.[periodeId]?.[j]),
    [posId, periodeId, rapikanUntuk]
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
    const tersimpan = bacaDraf();
    const draf = tersimpan ? pindahkanDrafLama(tersimpan) : null;

    setNilai(() => {
      const gabung = {} as Record<JenisForm, unknown>;
      for (const j of Object.keys(NILAI_AWAL) as JenisForm[]) {
        // Untuk jenis yang terkunci — dan untuk Admin Pusat, yang selalu
        // mengubah isian tersimpan — yang ditampilkan adalah isian di server,
        // bukan draf lokal. Draf lokal adalah suntingan yang belum pernah
        // terkirim; memulihkannya di perangkat Admin akan menampilkan angka
        // milik petugas yang tidak pernah disetujui siapa pun.
        const s = statusPerJenis[j]?.status;
        const drafI = draf?.data?.[j] as Record<string, unknown> | undefined;
        if (modeAdmin || s === "terkirim" || s === "terverifikasi") {
          // Draf lokal adalah suntingan yang belum pernah terkirim; memulihkannya
          // di perangkat Admin akan menampilkan angka milik petugas yang tidak
          // pernah disetujui siapa pun.
          gabung[j] = dasarUntuk(j);
        } else if (drafI) {
          // Draf lama bisa memakai bentuk sebelum kartu kegiatan ada; ia
          // dirapikan melalui jalur yang sama dengan isian server.
          gabung[j] = rapikanUntuk(j, drafI);
        } else {
          gabung[j] = dasarUntuk(j);
        }
      }
      return gabung;
    });

    if (draf?.data && !bacaSaja && !modeAdmin) {
      setPesan("Draf tersimpan di perangkat ini dipulihkan.");
    }
    // Dipasang sekali saat halaman dibuka; `statusPerJenis` tidak berubah di
    // sisi klien — setelah kirim berhasil halaman ini ditinggalkan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dasarUntuk, bacaDraf, rapikanUntuk]);

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

  /**
   * Galat satu kartu kegiatan tidak punya kunci kolom sendiri, jadi tidak
   * dapat dibuang lewat `ubah`. Kuncinya berbentuk `kegiatan.<i>.<kolom>`
   * (juga `kegiatan` untuk galat jumlah), dan semuanya milik kartu yang sama.
   */
  const hapusGalatKegiatan = useCallback((i: number) => {
    setGalat((g) => {
      const awalan = `kegiatan.${i}.`;
      const kunci = Object.keys(g).filter(
        (k) => k.startsWith(awalan) || k === "kegiatan"
      );
      if (kunci.length === 0) return g;
      const baru = { ...g };
      for (const k of kunci) delete baru[k];
      return baru;
    });
  }, []);

  /**
   * Data yang benar-benar dikirim ke server.
   *
   * Formulir menyimpan daftar kegiatan yang boleh lebih panjang daripada yang
   * ditampilkan (lihat `NilaiAnak.kegiatan`), dan server mewajibkan panjangnya
   * sama dengan `jumlah_kegiatan`. Pemotongan terjadi di sini, sekali, tepat
   * sebelum validasi — sehingga server selalu menerima bentuk yang konsisten
   * dan tidak perlu memaafkan selisih.
   *
   * Dua kolom ringkasan (`nama_kegiatan`, `jenis_kegiatan`) diturunkan dari
   * kartu kegiatan, bukan diketik: dashboard, ekspor, dan laporan lama membaca
   * kolom itu, sementara kebenarannya ada di `kegiatan`.
   */
  const dataKirim = useCallback(
    (j: JenisForm, isian: unknown): unknown => {
      if (j !== "aktivitas_anak" && j !== "aktivitas_perempuan") return isian;

      if (j === "aktivitas_anak") {
        const a = isian as NilaiAnak;
        const kegiatan: KegiatanAnak[] = potongKegiatan(
          a.kegiatan ?? [],
          a.jumlah_kegiatan,
          () => ({ nama: "", jenis: [] })
        );
        return {
          ...a,
          kegiatan,
          nama_kegiatan: ringkasNama(kegiatan),
          jenis_kegiatan: gabungJenisAnak(kegiatan),
        };
      }

      const p = isian as NilaiPerempuan;
      const kegiatan: KegiatanPerempuan[] = potongKegiatan(
        p.kegiatan ?? [],
        p.jumlah_kegiatan,
        () => ({ nama: "", jenis: "" })
      );
      return {
        ...p,
        kegiatan,
        nama_kegiatan: ringkasNama(kegiatan),
        jenis_kegiatan: gabungJenisPerempuan(kegiatan),
      };
    },
    []
  );

  async function kirim(status: "draf" | "terkirim" | "terverifikasi") {
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
        data: dataKirim(jenis, nilai[jenis]),
        status,
        catatanVerifikasi: modeAdmin ? catatanVerifikasi : undefined,
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

    if (status !== "draf") {
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
      // `urlKembali` untuk Admin Pusat menunjuk /admin/input-laporan dan sudah
      // membawa periode di URL, jadi tidak perlu ditambahi lagi.
      router.push(
        kembaliHref ? urlKembali : `/laporan-saya?periode=${periodeId}`
      );
    } else {
      setPesan("Draf disimpan.");
    }
  }

  const data = nilai[jenis] as never;

  // Penerima manfaat wajib dan kedua totalnya harus cocok. Aturan yang sama
  // sudah ada di skema Zod (server tetap penentu akhir); di sini ia dipakai
  // untuk menahan tombol simpan sebelum permintaan dikirim — petugas tidak
  // perlu menunggu jawaban server untuk tahu laporannya belum lengkap.
  //
  // Kedua tombol ditahan, termasuk "Simpan draf": server memvalidasi draf
  // dengan skema yang sama (begitu pula `nama_kegiatan` dan jenis kegiatan),
  // jadi membiarkannya tetap bisa diklik hanya akan memunculkan galat server.
  // Suntingan yang belum lengkap tetap aman — penyimpan draf otomatis di
  // perangkat ini berjalan terpisah dari tombol tersebut.
  const galatAnak =
    jenis === "aktivitas_anak" && !bacaSaja
      ? galatPenerimaManfaat(nilai[jenis] as NilaiAnak)
      : null;
  const tertahan = !bacaSaja && galatAnak !== null;

  return (
    <div className="space-y-5">
      {/* Identitas — terkunci. Berasal dari sel yang diklik di /laporan-saya. */}
      <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Identitas laporan
          </p>
          <Link
            href={urlKembali}
            className="text-[11px] font-semibold text-blue-700 hover:underline no-print"
          >
            ← Kembali ke {kembaliLabel}
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <span className="text-xs text-slate-500">Lokasi Pos SAPA</span>
            <p className="font-semibold text-slate-900">
              {pos.nama_lokasi}
              {labelHunian ? (
                <span className="font-normal text-slate-500">
                  {" "}
                  ({labelHunian})
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
          {modeAdmin
            ? "Lokasi dan periode mengikuti yang Anda pilih di menu Input Laporan, sehingga tidak dapat diubah dari sini. Untuk lokasi atau periode lain, kembali ke daftar lalu pilih selnya."
            : "Lokasi dan periode mengikuti sel yang Anda pilih di Laporan Saya, sehingga tidak dapat diubah dari sini. Untuk lokasi atau periode lain, kembali ke daftar lalu pilih selnya."}
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
            // Admin Pusat tidak pernah terkunci — laporan terverifikasi pun
            // harus dapat ia perbaiki.
            const terkunci = modeAdmin ? false : modeFormulir(s, catatan) === "lihat";
            return (
              <button
                key={j}
                type="button"
                onClick={() => {
                  setJenis(j);
                  setGalat({});
                  setPesan(null);
                  // Catatan verifikasi menjelaskan anomali JENIS ini; membawanya
                  // ke jenis lain hanya akan menempelkan alasan yang salah.
                  setCatatanVerifikasi("");
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

      {/* Keterangan status jenis yang sedang dibuka. Admin Pusat tidak
          membutuhkannya: tidak ada tampilan baca-saja maupun kunci baginya,
          dan status yang sudah ada sudah terlihat di tab jenis. */}
      {!modeAdmin && (bacaSaja || catatanBukaKunci) && (
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
            hapusGalatKegiatan={hapusGalatKegiatan}
            bacaSaja={bacaSaja}
          />
        )}
        {jenis === "aktivitas_perempuan" && (
          <FormPerempuan
            nilai={data}
            ubah={ubah}
            galat={galat}
            hapusGalatKegiatan={hapusGalatKegiatan}
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
            href={urlKembali}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition no-print"
          >
            ← Kembali ke {kembaliLabel}
          </Link>
          <span className="text-xs text-slate-500">
            Tidak ada yang dapat diubah di tampilan ini.
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Catatan verifikasi hanya untuk Admin Pusat: simpanannya langsung
              terverifikasi, dan bila datanya beranomali server mewajibkan
              catatan agar alasannya tercatat — sama seperti verifikasi biasa. */}
          {modeAdmin && (
            <div>
              <label
                htmlFor="catatan-verifikasi"
                className="text-xs font-bold uppercase tracking-wide text-slate-500"
              >
                Catatan verifikasi{" "}
                <span className="font-normal normal-case text-slate-400">
                  (wajib bila data beranomali)
                </span>
              </label>
              <textarea
                id="catatan-verifikasi"
                value={catatanVerifikasi}
                onChange={(e) => setCatatanVerifikasi(e.target.value)}
                rows={2}
                placeholder="Mis. angka usia dan jenis kelamin memang berbeda karena satu anak mengikuti dua kegiatan."
                className="mt-1 w-full text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => kirim(modeAdmin ? "terverifikasi" : "terkirim")}
              disabled={memuat || tertahan}
              title={tertahan ? galatAnak : undefined}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm transition"
            >
              {memuat
                ? "Menyimpan…"
                : modeAdmin
                  ? modeAdminJenis === "perbarui"
                    ? "Perbarui & verifikasi"
                    : "Simpan & verifikasi"
                  : mode === "ulang"
                    ? "Kirim ulang laporan"
                    : "Kirim laporan"}
            </button>

            {tertahan && (
              <p role="status" className="text-xs font-semibold text-amber-700">
                Lengkapi bagian <strong>Penerima manfaat</strong> untuk menyimpan
                laporan ini.
              </p>
            )}

            {/* "Simpan draf" tidak ditawarkan setelah Admin membuka kunci: draf
                menghapus penanda buka kunci, sehingga alasan perbaikan dari Admin
                ikut hilang tanpa jejak. Admin Pusat tidak punya draf sama sekali. */}
            {mode === "draf" && !modeAdmin && (
              <button
                type="button"
                onClick={() => kirim("draf")}
                disabled={memuat || tertahan}
                title={tertahan ? galatAnak : undefined}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 font-semibold text-sm transition"
              >
                Simpan draf
              </button>
            )}

            {!bacaSaja && !modeAdmin && tersimpan && (
              <span className="text-xs text-slate-500">
                Draf lokal tersimpan {tersimpan}
              </span>
            )}

            <Link
              href={urlKembali}
              className="text-xs font-semibold text-blue-700 hover:underline no-print"
            >
              Kembali ke {kembaliLabel} →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
