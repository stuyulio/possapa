#!/usr/bin/env node
/**
 * Migrasi data historis Pos SAPA dari ekspor Google Form (.xlsx) ke Supabase.
 *
 * Prinsip (PRD §7.3):
 *   1. Pemetaan berbasis INDEKS KOLOM TETAP, bukan pencocokan kata kunci.
 *   2. Validasi header pada setiap indeks. Bila tidak cocok -> BERHENTI.
 *   3. Tidak ada default pengganti yang menguntungkan (mis. "Ada Dokumentasi").
 *   4. Ditulis dalam transaksi; baris ditolak dilaporkan beserta alasannya.
 *
 * Pemakaian:
 *   node scripts/migrasi-sheets.mjs "docs/Laporan Berkala Pos SAPA (Jawaban).xlsx" --dry-run
 *   node scripts/migrasi-sheets.mjs "docs/Laporan Berkala Pos SAPA (Jawaban).xlsx" --commit
 *
 * Memerlukan: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

/**
 * Muat variabel dari berkas .env secara manual.
 * Node tidak membaca .env otomatis, dan kita tidak ingin menambah dependensi
 * hanya untuk ini.
 */
function muatEnv(berkas = ".env.local") {
  if (!existsSync(berkas)) {
    const cadangan = ".env";
    if (!existsSync(cadangan)) return;
    berkas = cadangan;
  }

  for (const baris of readFileSync(berkas, "utf8").split(/\r?\n/)) {
    const bersih = baris.trim();
    if (!bersih || bersih.startsWith("#")) continue;

    const pisah = bersih.indexOf("=");
    if (pisah === -1) continue;

    const kunci = bersih.slice(0, pisah).trim();
    let nilai = bersih.slice(pisah + 1).trim();

    // buang tanda kutip pembungkus bila ada
    if (
      (nilai.startsWith('"') && nilai.endsWith('"')) ||
      (nilai.startsWith("'") && nilai.endsWith("'"))
    ) {
      nilai = nilai.slice(1, -1);
    }

    if (!(kunci in process.env)) process.env[kunci] = nilai;
  }
}

muatEnv();

// ---------------------------------------------------------------------------
// Kontrak kolom — indeks 0-based sesuai FORM ASLI (bukan template CSV).
// Template menempatkan dokumentasi di indeks 4; form asli di indeks 59.
// ---------------------------------------------------------------------------
const KOLOM = {
  timestamp: 0,
  periode: 1,
  lokasi: 2,
  kab_kota: 3,
  jenis_laporan: 4,

  anak: {
    jumlah_kegiatan: 5,
    nama_kegiatan: 6,
    jenis_kegiatan: 7,
    usia_0_5: 8,
    usia_6_12: 9,
    usia_13_17: 10,
    laki_laki: 11,
    perempuan: 12,
    disabilitas: 13,
    perlu_layanan_lanjutan: 14,
    temuan: 15,
    tindak_lanjut: 16,
  },

  perempuan: {
    jumlah_kegiatan: 17,
    nama_kegiatan: 18,
    jenis_kegiatan: 19,
    total_ikut: 20,
    kepala_keluarga: 21,
    hamil_menyusui: 22,
    lansia: 23,
    disabilitas: 24,
    manfaat: 25,
  },

  rekap: {
    status_bulan: 26,
    aduan_masuk: 27,
    kekerasan_perempuan: 28,
    kekerasan_anak: 29,
    non_kekerasan_perempuan: 30,
    non_kekerasan_anak: 31,
    sudah_ditindaklanjuti: 32,
    tercatat_simfoni: 33,
    tindak_lanjut_umum: 34,
    pihak_terlibat: 35,
  },

  kasus: {
    kode_kasus: 36,
    tanggal_aduan: 37,
    kategori: 38,
    jenis_kasus: 39,
    jumlah_korban: 40,
    jenis_kelamin: 41,
    kelompok_usia: 42,
    disabilitas: 43,
    kebutuhan_korban: 44,
    tindak_lanjut: 45,
    status_penanganan: 46,
    sudah_simfoni: 47,
    no_registrasi_simfoni: 48,
    tanggal_input_simfoni: 49,
    penginput_simfoni: 50,
    alasan_belum_simfoni: 51,
    hambatan: 52,
  },

  publikasi: {
    tanggal_publikasi: 53,
    kegiatan: 54,
    platform: 55,
    nama_akun: 56,
    link_publikasi: 57,
    file_publikasi: 58,
  },

  dokumentasi: 59,
};

// Teks header yang WAJIB ada pada indeks tertentu. En-dash dinormalisasi.
const HARAPAN_HEADER = {
  0: "timestamp",
  1: "periode laporan",
  2: "lokasi pos sapa",
  3: "kabupaten",
  4: "jenis laporan",
  5: "jumlah kegiatan anak",
  8: "0-5 tahun",
  9: "6-12 tahun",
  10: "13-17 tahun",
  17: "jumlah kegiatan perempuan",
  20: "total perempuan",
  26: "status pelaporan aduan",
  27: "jumlah aduan masuk",
  36: "kode kasus",
  47: "sudah dicatat di simfoni",
  53: "tanggal publikasi",
  57: "link publikasi",
  59: "link pengumpulan dokumentasi",
};

const JENIS_MAP = {
  "aktivitas anak": "aktivitas_anak",
  "aktivitas perempuan": "aktivitas_perempuan",
  "rekapitulasi layanan pengaduan": "rekap_pengaduan",
  "rincian tindak lanjut": "tindak_lanjut_kasus",
  "publikasi media sosial": "publikasi",
};

// ---------------------------------------------------------------------------
// Utilitas
// ---------------------------------------------------------------------------
function normalisasiHeader(s) {
  return String(s ?? "")
    .replace(/[–—]/g, "-") // en/em dash -> hyphen
    .replace(/ /g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function teks(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function angka(v, fallback = 0) {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function tanggal(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function bulatkanTanggal(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

/**
 * Periode bisa berupa "2026-11", "5 - 19 November 2026", atau "November 2026".
 * Dikembalikan sebagai { mulai, selesai }.
 */
function uraikanPeriode(raw) {
  const s = teks(raw);
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    return {
      mulai: `${m[1]}-${m[2]}-01`,
      selesai: bulatkanTanggal(new Date(Date.UTC(y, mo, 0))),
    };
  }

  m = s.match(/^(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const bulan = bulanDariNama(m[3]);
    if (bulan === null) return null;
    return {
      mulai: `${m[4]}-${pad(bulan)}-${pad(m[1])}`,
      selesai: `${m[4]}-${pad(bulan)}-${pad(m[2])}`,
    };
  }

  m = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const bulan = bulanDariNama(m[1]);
    if (bulan === null) return null;
    return {
      mulai: `${m[2]}-${pad(bulan)}-01`,
      selesai: bulatkanTanggal(new Date(Date.UTC(Number(m[2]), bulan, 0))),
    };
  }

  return null;
}

const NAMA_BULAN = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
};

function bulanDariNama(nama) {
  return NAMA_BULAN[String(nama).toLowerCase()] ?? null;
}

const pad = (n) => String(n).padStart(2, "0");

/**
 * "Kabupaten Aceh Tamiang" -> "Aceh Tamiang"; "Kota Padang" tetap "Kota Padang".
 */
function normalisasiKabKota(raw) {
  const s = teks(raw);
  if (!s) return null;
  return s.replace(/^Kabupaten\s+/i, "").replace(/^Kab\.\s*/i, "").trim();
}

// ---------------------------------------------------------------------------
// Validasi header — gagal keras
// ---------------------------------------------------------------------------
function validasiHeader(header) {
  const masalah = [];
  for (const [idx, harapan] of Object.entries(HARAPAN_HEADER)) {
    const aktual = normalisasiHeader(header[Number(idx)]);
    if (!aktual.includes(harapan)) {
      masalah.push(
        `  kolom ${Number(idx) + 1}: diharapkan mengandung "${harapan}", ditemukan "${aktual}"`
      );
    }
  }
  if (masalah.length > 0) {
    console.error("\nVALIDASI HEADER GAGAL. Migrasi dihentikan.");
    console.error("Kemungkinan penyebab: urutan kolom formulir berubah.\n");
    masalah.forEach((m) => console.error(m));
    console.error(
      "\nPerbarui kontrak kolom di scripts/migrasi-sheets.mjs, JANGAN memaksakan migrasi.\n"
    );
    process.exit(1);
  }
  console.log("✓ Validasi header lolos (60 kolom).");
}

// ---------------------------------------------------------------------------
// Pemetaan baris
// ---------------------------------------------------------------------------
function petakanBaris(row, nomorBaris) {
  const jenisRaw = normalisasiHeader(row[KOLOM.jenis_laporan]);
  let jenis = null;
  for (const [kunci, nilai] of Object.entries(JENIS_MAP)) {
    if (jenisRaw.includes(kunci)) {
      jenis = nilai;
      break;
    }
  }
  if (!jenis) {
    return { ditolak: `jenis laporan tidak dikenali: "${row[KOLOM.jenis_laporan]}"` };
  }

  const periode = uraikanPeriode(row[KOLOM.periode]);
  if (!periode) {
    return { ditolak: `format periode tidak dikenali: "${row[KOLOM.periode]}"` };
  }

  const kab_kota = normalisasiKabKota(row[KOLOM.kab_kota]);
  if (!kab_kota) return { ditolak: "kabupaten/kota kosong" };

  const lokasi = teks(row[KOLOM.lokasi]);
  if (!lokasi) return { ditolak: "lokasi Pos SAPA kosong" };

  const dasar = {
    nomorBaris,
    jenis,
    periode,
    kab_kota,
    lokasi,
    dokumentasi: teks(row[KOLOM.dokumentasi]), // null bila kosong — tanpa default palsu
    timestamp: row[KOLOM.timestamp] instanceof Date
      ? row[KOLOM.timestamp].toISOString()
      : null,
  };

  if (jenis === "aktivitas_anak") {
    const k = KOLOM.anak;
    const usia = {
      u05: angka(row[k.usia_0_5]),
      u612: angka(row[k.usia_6_12]),
      u1317: angka(row[k.usia_13_17]),
    };
    const gender = {
      L: angka(row[k.laki_laki]),
      P: angka(row[k.perempuan]),
    };
    const sumUsia = usia.u05 + usia.u612 + usia.u1317;
    const sumGender = gender.L + gender.P;
    // Koreksi §6.4: laporkan selisih, jangan diganti max().
    const anomali =
      sumUsia !== sumGender
        ? `total usia (${sumUsia}) != total gender (${sumGender})`
        : null;

    dasar.anak = {
      jumlah_kegiatan: angka(row[k.jumlah_kegiatan], 1),
      nama_kegiatan: teks(row[k.nama_kegiatan]),
      jenis_kegiatan: (teks(row[k.jenis_kegiatan]) ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      usia_0_5: usia.u05,
      usia_6_12: usia.u612,
      usia_13_17: usia.u1317,
      laki_laki: gender.L,
      perempuan: gender.P,
      disabilitas: angka(row[k.disabilitas]),
      perlu_layanan_lanjutan: angka(row[k.perlu_layanan_lanjutan]),
      temuan: teks(row[k.temuan]),
      tindak_lanjut: teks(row[k.tindak_lanjut]),
    };
    if (anomali) dasar.anomali = anomali;
  }

  if (jenis === "aktivitas_perempuan") {
    const k = KOLOM.perempuan;
    dasar.perempuan = {
      jumlah_kegiatan: angka(row[k.jumlah_kegiatan], 1),
      nama_kegiatan: teks(row[k.nama_kegiatan]),
      jenis_kegiatan: teks(row[k.jenis_kegiatan]),
      total_ikut: angka(row[k.total_ikut]),
      kepala_keluarga: angka(row[k.kepala_keluarga]),
      // Google Form hanya punya SATU pertanyaan gabungan "Hamil/Menyusui"
      // (kolom 23). Angka gabungan itu masuk ke `hamil`; `menyusui` diisi 0
      // karena tidak dapat dipilah dari data lama. Indeks kolom tidak berubah,
      // jadi template dan form lama tetap terbaca.
      hamil: angka(row[k.hamil_menyusui]),
      menyusui: 0,
      lansia: angka(row[k.lansia]),
      disabilitas: angka(row[k.disabilitas]),
      manfaat: teks(row[k.manfaat]),
    };
  }

  if (jenis === "rekap_pengaduan") {
    const k = KOLOM.rekap;
    dasar.rekap = {
      status_bulan: teks(row[k.status_bulan]) ?? "Nihil",
      aduan_masuk: angka(row[k.aduan_masuk]),
      kekerasan_perempuan: angka(row[k.kekerasan_perempuan]),
      kekerasan_anak: angka(row[k.kekerasan_anak]),
      non_kekerasan_perempuan: angka(row[k.non_kekerasan_perempuan]),
      non_kekerasan_anak: angka(row[k.non_kekerasan_anak]),
      sudah_ditindaklanjuti: angka(row[k.sudah_ditindaklanjuti]),
      tercatat_simfoni: angka(row[k.tercatat_simfoni]),
      tindak_lanjut_umum: teks(row[k.tindak_lanjut_umum]),
      pihak_terlibat: teks(row[k.pihak_terlibat]),
    };
  }

  if (jenis === "tindak_lanjut_kasus") {
    const k = KOLOM.kasus;
    const sudahSimfoni = normalisasiHeader(row[k.sudah_simfoni]) === "ya";
    const noReg = teks(row[k.no_registrasi_simfoni]);
    const tglInput = tanggal(row[k.tanggal_input_simfoni]);
    const penginput = teks(row[k.penginput_simfoni]);
    const alasan = teks(row[k.alasan_belum_simfoni]);

    // Validasi keras §6.4 — baris yang melanggar ditolak, bukan diperbaiki
    // diam-diam. Constraint database akan menolaknya pula.
    if (sudahSimfoni && (!noReg || !tglInput || !penginput)) {
      return {
        ditolak:
          "status SIMFONI 'Ya' tetapi nomor registrasi / tanggal input / penginput kosong",
      };
    }
    if (!sudahSimfoni && !alasan) {
      return { ditolak: "status SIMFONI 'Belum' tetapi alasan belum diisi" };
    }

    dasar.kasus = {
      kode_kasus: teks(row[k.kode_kasus]),
      tanggal_aduan: tanggal(row[k.tanggal_aduan]),
      kategori:
        normalisasiHeader(row[k.kategori]) === "kekerasan"
          ? "kekerasan"
          : "non_kekerasan",
      jenis_kasus: teks(row[k.jenis_kasus]),
      jumlah_korban: angka(row[k.jumlah_korban], 1),
      jenis_kelamin: teks(row[k.jenis_kelamin]),
      kelompok_usia: teks(row[k.kelompok_usia]),
      disabilitas: normalisasiHeader(row[k.disabilitas]) === "ya",
      kebutuhan_korban: teks(row[k.kebutuhan_korban]),
      tindak_lanjut: teks(row[k.tindak_lanjut]),
      status_penanganan:
        normalisasiHeader(row[k.status_penanganan]) === "selesai"
          ? "selesai"
          : normalisasiHeader(row[k.status_penanganan]) === "dirujuk"
          ? "dirujuk"
          : "dalam_proses",
      sudah_simfoni: sudahSimfoni,
      no_registrasi_simfoni: noReg,
      tanggal_input_simfoni: tglInput,
      penginput_simfoni: penginput,
      alasan_belum_simfoni: alasan,
      hambatan: teks(row[k.hambatan]),
    };

    if (!dasar.kasus.kode_kasus) return { ditolak: "kode kasus kosong" };
    if (!dasar.kasus.tanggal_aduan) return { ditolak: "tanggal aduan tidak valid" };
  }

  if (jenis === "publikasi") {
    const k = KOLOM.publikasi;
    const link = teks(row[k.link_publikasi]);
    if (!link || !/^https:\/\//i.test(link)) {
      return {
        ditolak: `tautan publikasi bukan URL https yang valid: "${link ?? "(kosong)"}"`,
      };
    }

    // Kolom ke-59 di Google Form bernama "File Publikasi" — di aplikasi kini
    // berlabel "Link penyimpanan dokumentasi". Header Google Form sengaja
    // TIDAK diubah (mengubahnya menggeser penomoran seluruh kolom sesudahnya
    // dan menghentikan pembacaan skrip ini). Karena itu tautan arsip hanya
    // diterima bila benar-benar berupa https; selain itu dianggap tidak diisi
    // supaya tidak menyimpan nama berkas lepas ke kolom tautan.
    const arsip = teks(row[k.file_publikasi]);
    const arsipSah = arsip && /^https:\/\//i.test(arsip) ? arsip : null;

    dasar.publikasi = {
      tanggal_publikasi: tanggal(row[k.tanggal_publikasi]),
      kegiatan: teks(row[k.kegiatan]),
      platform: teks(row[k.platform]) ?? "Lainnya",
      nama_akun: teks(row[k.nama_akun]),
      link_publikasi: link,
      file_publikasi: arsipSah,
    };
    if (!dasar.publikasi.tanggal_publikasi) {
      return { ditolak: "tanggal publikasi tidak valid" };
    }
  }

  return { data: dasar };
}

// ---------------------------------------------------------------------------
// Program utama
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const berkas = args.find((a) => !a.startsWith("--"));
  const dryRun = !args.includes("--commit");

  if (!berkas) {
    console.error("Pemakaian: node scripts/migrasi-sheets.mjs <berkas.xlsx> [--commit]");
    process.exit(1);
  }

  console.log(`\n=== Migrasi Pos SAPA ===`);
  console.log(`Berkas : ${berkas}`);
  console.log(`Mode   : ${dryRun ? "DRY RUN (tidak menulis ke database)" : "COMMIT"}\n`);

  const wb = XLSX.read(readFileSync(berkas), { type: "buffer", cellDates: true });
  const ws = wb.Sheets["Form Responses 1"];
  if (!ws) {
    console.error('Sheet "Form Responses 1" tidak ditemukan.');
    console.error(`Sheet tersedia: ${wb.SheetNames.join(", ")}`);
    process.exit(1);
  }

  const matriks = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const [header, ...baris] = matriks;

  validasiHeader(header);
  console.log(`Baris data: ${baris.length}\n`);

  const diterima = [];
  const ditolak = [];

  baris.forEach((row, i) => {
    if (!row || row.every((c) => c === null || c === "")) return;
    const hasil = petakanBaris(row, i + 2);
    if (hasil.ditolak) ditolak.push({ baris: i + 2, alasan: hasil.ditolak });
    else diterima.push(hasil.data);
  });

  console.log(`Diterima : ${diterima.length}`);
  console.log(`Ditolak  : ${ditolak.length}`);
  if (ditolak.length) {
    console.log("\nBaris ditolak:");
    ditolak.forEach((d) => console.log(`  baris ${d.baris}: ${d.alasan}`));
  }

  const anomali = diterima.filter((d) => d.anomali);
  if (anomali.length) {
    console.log("\n⚠ Anomali data (tetap diimpor, ditandai untuk tinjauan):");
    anomali.forEach((d) =>
      console.log(`  baris ${d.nomorBaris} [${d.jenis}] ${d.anomali}`)
    );
  }

  console.log("\nRingkasan per jenis:");
  const perJenis = diterima.reduce((m, d) => {
    m[d.jenis] = (m[d.jenis] ?? 0) + 1;
    return m;
  }, {});
  Object.entries(perJenis).forEach(([j, n]) => console.log(`  ${j}: ${n}`));

  if (dryRun) {
    console.log("\nDry run selesai. Jalankan ulang dengan --commit untuk menulis ke database.");
    console.log(JSON.stringify(diterima.slice(0, 2), null, 2));
    return;
  }

  // --- Penulisan ke database ---
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const hilang = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !key && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);

  if (hilang.length > 0) {
    console.error(`\nVariabel berikut kosong: ${hilang.join(", ")}`);
    console.error("Pastikan berkas .env.local ada di root proyek dan berisi:");
    console.error("  NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co");
    console.error("  SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...");
    console.error("\nCatatan: SERVICE_ROLE_KEY berbeda dari ANON_KEY.");
    console.error("Ambil dari Supabase Dashboard → Project Settings → API → service_role.");
    process.exit(1);
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: wilayah, error: errWilayah } = await db
    .from("wilayah")
    .select("id, kab_kota");
  if (errWilayah) {
    console.error("Gagal membaca wilayah:", errWilayah.message);
    process.exit(1);
  }
  const petaWilayah = new Map(wilayah.map((w) => [w.kab_kota.toLowerCase(), w.id]));

  let sukses = 0;
  for (const d of diterima) {
    const wilayahId = petaWilayah.get(d.kab_kota.toLowerCase());
    if (!wilayahId) {
      console.error(`  ✗ baris ${d.nomorBaris}: kab/kota "${d.kab_kota}" tidak ada di data master`);
      continue;
    }

    // Cari atau buat Pos SAPA (nama lokasi CSV tidak baku).
    let { data: pos } = await db
      .from("pos_sapa")
      .select("id")
      .eq("wilayah_id", wilayahId)
      .eq("nama_lokasi", d.lokasi)
      .maybeSingle();

    if (!pos) {
      const { data: baru, error: errPos } = await db
        .from("pos_sapa")
        .insert({
          wilayah_id: wilayahId,
          nama_lokasi: d.lokasi,
          status_aktif: true,
        })
        .select("id")
        .single();
      if (errPos) {
        console.error(`  ✗ baris ${d.nomorBaris}: gagal membuat Pos SAPA — ${errPos.message}`);
        continue;
      }
      pos = baru;
    }

    // Periode
    let { data: periode } = await db
      .from("periode")
      .select("id")
      .eq("tanggal_mulai", d.periode.mulai)
      .eq("tanggal_selesai", d.periode.selesai)
      .maybeSingle();

    if (!periode) {
      const { data: baru, error: errPeriode } = await db
        .from("periode")
        .insert({ tanggal_mulai: d.periode.mulai, tanggal_selesai: d.periode.selesai })
        .select("id")
        .single();
      if (errPeriode) {
        console.error(`  ✗ baris ${d.nomorBaris}: gagal membuat periode — ${errPeriode.message}`);
        continue;
      }
      periode = baru;
    }

    const { data: laporan, error: errLaporan } = await db
      .from("laporan")
      .insert({
        pos_id: pos.id,
        periode_id: periode.id,
        jenis_laporan: d.jenis,
        status: "terkirim",
        sumber_input: "google_form",
        link_dokumentasi: d.dokumentasi,
        submitted_at: d.timestamp ?? new Date().toISOString(),
      })
      .select("id")
      .single();

    if (errLaporan) {
      console.error(`  ✗ baris ${d.nomorBaris}: ${errLaporan.message}`);
      continue;
    }

    const id = laporan.id;
    const detail =
      d.jenis === "aktivitas_anak" ? ["laporan_anak", d.anak] :
      d.jenis === "aktivitas_perempuan" ? ["laporan_perempuan", d.perempuan] :
      d.jenis === "rekap_pengaduan" ? ["laporan_rekap_pengaduan", d.rekap] :
      d.jenis === "tindak_lanjut_kasus" ? ["laporan_kasus", d.kasus] :
      ["laporan_publikasi", d.publikasi];

    const { error: errDetail } = await db
      .from(detail[0])
      .insert({ laporan_id: id, ...detail[1] });

    if (errDetail) {
      console.error(`  ✗ baris ${d.nomorBaris}: detail gagal — ${errDetail.message}`);
      await db.from("laporan").delete().eq("id", id);
      continue;
    }

    sukses++;
  }

  console.log(`\n✓ ${sukses} dari ${diterima.length} laporan berhasil dimigrasikan.`);
  if (anomali.length) {
    console.log(`⚠ ${anomali.length} laporan memuat anomali — tinjau manual.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
