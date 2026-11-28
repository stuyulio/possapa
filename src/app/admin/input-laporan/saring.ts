import type { ChecklistPos } from "@/lib/data/kepatuhan";
import { SEMUA_JENIS } from "@/lib/data/kepatuhan";

/**
 * Penyaringan daftar checklist Admin Pusat.
 *
 * Semua data seluruh Pos SAPA sudah diambil `ambilChecklist` dalam satu query,
 * jadi penyaringan cukup dilakukan di memori. Ini disengaja: menambah `.eq()`
 * ke query akan membuat setiap kombinasi filter butuh query sendiri, sementara
 * jumlah Pos SAPA berada di kisaran puluhan — jauh lebih murah disaring di
 * sini, dan ringkasan halaman dapat dihitung dari himpunan yang sama.
 *
 * Fungsi ini murni (tanpa I/O) supaya aturan filter dapat diuji tanpa database.
 */

export type FilterInput = {
  provinsi?: string;
  kabkota?: string;
  /** id Pos SAPA */
  lokasi?: string;
  /** nilai jenis_hunian, termasuk "lainnya" */
  jenis?: string;
  /** kode JenisLaporan yang sedang disorot */
  lap?: string;
  /** status jenis laporan terpilih: belum | draf | terkirim | terverifikasi */
  status?: string;
  /** potongan nama lokasi, tidak peka huruf besar/kecil */
  cari?: string;
};

export function bacaFilter(
  params: Record<string, string | string[] | undefined>
): FilterInput {
  const satu = (v: string | string[] | undefined) =>
    typeof v === "string" && v !== "" && v !== "ALL" ? v : undefined;

  return {
    provinsi: satu(params.provinsi),
    kabkota: satu(params.kabkota),
    lokasi: satu(params.lokasi),
    jenis: satu(params.jenis),
    lap: satu(params.lap),
    status: satu(params.status),
    cari: satu(params.cari)?.trim().toLowerCase() || undefined,
  };
}

/** Status efektif satu sel; "belum" bila laporan tidak ada. */
function statusSel(p: ChecklistPos, jenis: string) {
  const s = p.status.find((x) => x.jenis === jenis);
  if (!s) return "belum";
  return s.status;
}

export function saringPos(pos: ChecklistPos[], filter: FilterInput): ChecklistPos[] {
  // Dinormalkan lagi di sini, bukan hanya di `bacaFilter`: fungsi ini murni dan
  // dipanggil langsung oleh uji, jadi jangan bergantung pada pemanggil untuk
  // mengirim huruf kecil.
  const cari = filter.cari?.trim().toLowerCase() || undefined;

  return pos.filter((p) => {
    if (filter.provinsi && p.provinsi !== filter.provinsi) return false;
    if (filter.kabkota && p.kab_kota !== filter.kabkota) return false;
    if (filter.lokasi && p.pos_id !== filter.lokasi) return false;
    if (filter.jenis && p.jenis_hunian !== filter.jenis) return false;
    if (cari && !p.nama_lokasi.toLowerCase().includes(cari)) {
      return false;
    }

    // Filter laporan menyorot Pos yang status salah satu jenisnya cocok.
    // Tanpa `status`, cukup Pos yang sudah punya laporan jenis itu — berguna
    // untuk menjawab "siapa yang sudah/belum mengisi Aktivitas Anak".
    if (filter.lap) {
      const st = statusSel(p, filter.lap);
      if (filter.status) {
        if (st !== filter.status) return false;
      } else if (st === "belum") {
        return false;
      }
    }

    return true;
  });
}

/**
 * Ringkasan mengikuti hasil saringan, tetapi `selesai`/`target` dihitung dari
 * kelima jenis — bukan dari jenis yang sedang disorot — supaya angkanya tetap
 * berarti sebagai ukuran kelengkapan Pos.
 */
export function ringkas(terpilih: ChecklistPos[]) {
  return {
    jumlahPos: terpilih.length,
    selesai: terpilih.reduce((a, p) => a + p.selesai, 0),
    target: terpilih.length * SEMUA_JENIS.length,
  };
}
