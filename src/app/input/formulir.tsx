"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { simpanLaporan } from "./actions";
import { LABEL_JENIS, type JenisForm } from "@/lib/validasi/laporan";
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

export function FormulirInput({
  daftarPos,
  wilayahNama,
  provinsiNama,
  posAwal,
  periode,
  periodeTerpilih,
  jenisAwal,
}: {
  daftarPos: Pos[];
  wilayahNama: string;
  provinsiNama: string;
  posAwal: string;
  periode: { id: string; label: string }[];
  periodeTerpilih: string;
  jenisAwal?: JenisForm;
}) {
  const router = useRouter();
  const [posId, setPosId] = useState(posAwal);
  const [periodeId, setPeriodeId] = useState(periodeTerpilih);
  const [jenis, setJenis] = useState<JenisForm>(jenisAwal ?? "aktivitas_anak");
  const [nilai, setNilai] = useState<Record<JenisForm, unknown>>(
    NILAI_AWAL as Record<JenisForm, unknown>
  );
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [tersimpan, setTersimpan] = useState<string | null>(null);

  // Muat draf lokal saat pertama kali.
  useEffect(() => {
    const mentah = localStorage.getItem(KUNCI_DRAF(posId));
    if (!mentah) return;
    try {
      const draf = JSON.parse(mentah) as {
        periodeId?: string;
        data?: Partial<Record<JenisForm, unknown>>;
      };
      if (draf.periodeId) setPeriodeId(draf.periodeId);
      if (draf.data) {
        setNilai((lama) => {
          const gabung = { ...lama };
          for (const [k, v] of Object.entries(draf.data!)) {
            gabung[k as JenisForm] = v;
          }
          return gabung;
        });
        setPesan("Draf tersimpan di perangkat ini dipulihkan.");
      }
    } catch {
      // draf rusak — abaikan
    }
  }, [posId]);

  // Simpan draf otomatis (debounce 600 ms).
  useEffect(() => {
    const t = setTimeout(() => {
      const isi = NILAI_AWAL[jenis];
      const sekarang = nilai[jenis];
      if (JSON.stringify(sekarang) === JSON.stringify(isi)) return;

      localStorage.setItem(
        KUNCI_DRAF(posId),
        JSON.stringify({ periodeId, data: nilai })
      );
      setTersimpan(new Date().toLocaleTimeString("id-ID"));
    }, 600);
    return () => clearTimeout(t);
  }, [nilai, periodeId, jenis, posId]);

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

    const hasil = await simpanLaporan({
      jenis,
      posId,
      periodeId,
      data: nilai[jenis],
      status,
    });

    setMemuat(false);

    if (!hasil.sukses) {
      if ("galat" in hasil) {
        setGalat(hasil.galat);
        setPesan("Periksa kembali isian yang ditandai merah.");
      } else {
        setPesan(hasil.pesan);
      }
      return;
    }

    if (status === "terkirim") {
      // Hapus draf jenis ini; jenis lain tetap tersimpan.
      const mentah = localStorage.getItem(KUNCI_DRAF(posId));
      if (mentah) {
        try {
          const draf = JSON.parse(mentah) as {
            periodeId?: string;
            data?: Record<string, unknown>;
          };
          if (draf.data) {
            delete draf.data[jenis];
            localStorage.setItem(KUNCI_DRAF(posId), JSON.stringify(draf));
          }
        } catch {
          localStorage.removeItem(KUNCI_DRAF(posId));
        }
      }
      setNilai((lama) => ({ ...lama, [jenis]: NILAI_AWAL[jenis] }));
      setPesan("Laporan berhasil dikirim.");
      router.refresh();
    } else {
      setPesan("Draf disimpan.");
    }
  }

  const data = nilai[jenis] as never;

  return (
    <div className="space-y-5">
      {/* Identitas — terkunci */}
      <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
          Identitas laporan (terisi otomatis)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <span className="text-xs text-slate-500">Lokasi Pos SAPA</span>
            <select
              value={posId}
              onChange={(e) => setPosId(e.target.value)}
              className="mt-0.5 w-full text-sm font-semibold border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
            >
              {daftarPos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama_lokasi}
                  {p.jenis_hunian ? ` (${p.jenis_hunian})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="text-xs text-slate-500">Kabupaten/Kota</span>
            <p className="font-semibold text-slate-900">{wilayahNama}</p>
            <p className="text-[11px] text-slate-500">{provinsiNama}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Periode</span>
            <select
              value={periodeId}
              onChange={(e) => setPeriodeId(e.target.value)}
              className="mt-0.5 w-full text-sm font-semibold border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
            >
              {periode.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Pilih jenis laporan */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
          Jenis laporan
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {(Object.keys(LABEL_JENIS) as JenisForm[]).map((j) => (
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
                  : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"
              }`}
            >
              {LABEL_JENIS[j]}
            </button>
          ))}
        </div>
      </div>

      {/* Formulir */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
        {jenis === "aktivitas_anak" && (
          <FormAnak nilai={data} ubah={ubah} galat={galat} />
        )}
        {jenis === "aktivitas_perempuan" && (
          <FormPerempuan nilai={data} ubah={ubah} galat={galat} />
        )}
        {jenis === "rekap_pengaduan" && (
          <FormRekap nilai={data} ubah={ubah} galat={galat} />
        )}
        {jenis === "tindak_lanjut_kasus" && (
          <FormKasus nilai={data} ubah={ubah} galat={galat} />
        )}
        {jenis === "publikasi" && (
          <FormPublikasi nilai={data} ubah={ubah} galat={galat} />
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

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => kirim("terkirim")}
          disabled={memuat}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm transition"
        >
          {memuat ? "Menyimpan…" : "Kirim laporan"}
        </button>

        <button
          type="button"
          onClick={() => kirim("draf")}
          disabled={memuat}
          className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 font-semibold text-sm transition"
        >
          Simpan draf
        </button>

        {tersimpan && (
          <span className="text-xs text-slate-500">
            Draf lokal tersimpan {tersimpan}
          </span>
        )}
      </div>
    </div>
  );
}
