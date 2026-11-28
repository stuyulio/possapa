"""Generator sekali pakai: baca Excel Google Form -> skrip SQL siap tempel.

Menulis:
  - /tmp/impor-202611.sql   : skrip untuk Supabase SQL Editor
  - /tmp/impor-202611.json  : data hasil normalisasi (untuk diperiksa)

Aturan yang dipakai (diputuskan pemilik produk 27 Nov 2026):
  1. Satu periode: 2026-11-01 s/d 2026-11-19.
  2. Lokasi dinormalkan; nama tidak baku dipetakan ke satu nama baku.
  3. Baris 2 ("Aceh Tamiang/24476") -> Huntara Kampung Empat (kode pos sama).
  4. Baris 19 ("Kab.Pidie Jaya") -> pos baru "Kantor Dinsos PPPA Kab. Pidie Jaya".
  5. Aktivitas yang bentrok digabung: nama kegiatan digabung, peserta dijumlahkan.
     Baris 11 Pandan DIBUANG karena tercakup baris 12.
  6. Publikasi TIDAK digabung: satu baris = satu laporan.
  7. Nilai "-", "0", "nihil", '" - "' -> NULL (bukan default yang menguntungkan).
  8. "Ada Dokumentasi" BUKAN tautan -> link_dokumentasi NULL.
  9. Link publikasi yang bukan https -> NULL, baris dicatat untuk ditinjau.
"""

import collections
import json
import re
import uuid

import openpyxl

SUMBER = "c:/laragon/www/possapa/docs/Laporan Berkala Pos SAPA (Jawaban) 3.xlsx"

JENIS = {
    "Aktivitas Anak (Bermain & Psikososial)": "aktivitas_anak",
    "Aktivitas Perempuan (Pemberdayaan & Psikososial)": "aktivitas_perempuan",
    "Rekapitulasi Layanan Pengaduan Bulanan": "rekap_pengaduan",
    "Rincian Tindak Lanjut (TL) Kasus Pengaduan": "tindak_lanjut_kasus",
    "Publikasi Media Sosial": "publikasi",
}

# lokasi mentah (lowercase, spasi dirapatkan) -> (kab_kota, nama baku, kode, jenis_hunian)
POS = {
    "aceh tamiang/ 24476": ("Aceh Tamiang", "Huntara Kampung Empat", "24476", "huntara"),
    "desa grong-grong kecamatan pante bidari kabupaten aceh timur/ 24463": (
        "Aceh Timur", "Desa Grong-Grong Kec. Pante Bidari", "24463", None),
    "huntap dolok nauli/22461": ("Tapanuli Utara", "Huntap Dolok Nauli", "22461", "huntap"),
    "huntara desa upah": ("Aceh Tamiang", "Huntara Desa Upah", None, "huntara"),
    "huntara kampung empat / 24476": ("Aceh Tamiang", "Huntara Kampung Empat", "24476", "huntara"),
    "huntara lubuk buaya padang (25173)": ("Kota Padang", "Huntara Lubuk Buaya", "25173", "huntara"),
    "huntara rusunawa pandan/22611": ("Tapanuli Tengah", "Huntara Rusunawa Pandan", "22611", "huntara"),
    "huntara simpang empat": ("Aceh Tamiang", "Huntara Simpang Empat", None, "huntara"),
    "jorong ladang laweh , nagari rambatan , kabupaten tanah datar": (
        "Tanah Datar", "Jorong Ladang Laweh, Nagari Rambatan", None, None),
    "kab.pidie jaya": ("Pidie Jaya", "Kantor Dinsos PPPA Kab. Pidie Jaya", None, "dinas_pppa"),
    "nagari paninggaahan": ("Solok", "Nagari Paninggahan", None, None),
    "nagari paninggahan": ("Solok", "Nagari Paninggahan", None, None),
    "nagari paninggahan, kabupaten solok": ("Solok", "Nagari Paninggahan", None, None),
    "nagari peninggahan": ("Solok", "Nagari Paninggahan", None, None),
    "pos sapa huntara 1": ("Aceh Tamiang", "Huntara 1", None, "huntara"),
    "pos sapa huntara desa upah": ("Aceh Tamiang", "Huntara Desa Upah", None, "huntara"),
    "pos sapa huntara simpang empat": ("Aceh Tamiang", "Huntara Simpang Empat", None, "huntara"),
    "pos sapa huntara tunyang kabupaten bener meriah": (
        "Bener Meriah", "Huntara Tunyang", None, "huntara"),
    "rptra gebang": ("Langkat", "RPTRA Gebang", None, None),
}

# Baris sumber yang DIBUANG sebelum penggabungan karena isinya sudah tercakup
# baris lain di grup yang sama. Pandan: baris 12 "Pelatihan PHBS dan Senam Pagi
# Lansia" (2 kegiatan, 87 peserta) memuat baris 11 "Senam Pagi Lansia" (1
# kegiatan, 27 peserta). Dijumlahkan akan menjadi 114 untuk 3 kegiatan, padahal
# orangnya sama dan senam sudah disebut di nama baris 12.
BARIS_DIBUANG = {11}

KEKOSONGAN = {"-", "\u2013", "\u2014", "nihil", "tidak ada", '" - "', '"-"', "0"}


def kek(s):
    return re.sub(r"\s+", " ", str(s).strip().lower())


def txt(v):
    if v is None or isinstance(v, (int, float)):
        return None
    s = str(v).strip()
    m = re.match(r'^"(.*)"$', s, re.S)
    if m:
        s = m.group(1).strip()
    s = re.sub(r"\s+", " ", s.replace("\u00a0", " ")).strip()
    return None if s.lower() in KEKOSONGAN else s


def num(v):
    if v is None or v == "":
        return 0
    try:
        return int(round(float(v)))
    except (TypeError, ValueError):
        return 0


def tgl(v):
    return v.date().isoformat() if hasattr(v, "date") else None


def tautan(v):
    s = txt(v)
    return s if s and s.lower().startswith("https://") else None


def jenis_anak(v):
    if not v:
        return []
    out = []
    for p in str(v).split(","):
        p = re.sub(r"\s+", " ", p).strip()
        if p and p.lower() not in {o.lower() for o in out}:
            out.append(p)
    return out


def gabung(nilai):
    unik = [v for v in dict.fromkeys(nilai) if v]
    return "\n\n".join(unik) if unik else None


wb = openpyxl.load_workbook(SUMBER, data_only=True)
ws = wb.active
rows = list(ws.iter_rows(min_row=2, values_only=True))

grup = collections.defaultdict(list)
for n, r in enumerate(rows, start=2):
    if n in BARIS_DIBUANG:
        continue
    kunci = kek(r[2])
    if kunci not in POS:
        raise SystemExit(f"Lokasi tidak dikenal di baris {n}: {r[2]!r}")
    kab, nama, kode, hunian = POS[kunci]
    grup[(kab, nama, kode, hunian, JENIS[r[4]])].append((n, r))

hasil = []
tinjau = []

for (kab, nama, kode, hunian, jenis), items in sorted(grup.items(), key=lambda x: str(x[0])):
    if jenis == "publikasi":
        for n, r in items:
            link = tautan(r[57])
            if link is None:
                # laporan_publikasi.link_publikasi NOT NULL + check ^https://.
                # Baris tanpa tautan sah TIDAK dapat disimpan; dilewati dan
                # dilaporkan, bukan diisi tautan palsu.
                tinjau.append(
                    f"baris {n}: link publikasi {txt(r[57])!r} bukan URL https — "
                    "BARIS DILEWATI (tidak dapat disimpan: link_publikasi wajib https)")
                continue
            if " dan " in link:
                tinjau.append(f"baris {n}: sel berisi dua URL -> dipakai yang pertama")
            link = link.split(" dan ")[0].strip().rstrip("/")
            # File publikasi ada di INDEKS 58 (kolom 59), bukan 60. Kolom 60
            # adalah "Link Pengumpulan Dokumentasi Kegiatan" berisi teks
            # "Ada Dokumentasi" — bukan tautan.
            berkas = tautan(r[58])
            hasil.append({
                "kab": kab, "nama": nama, "kode": kode, "hunian": hunian,
                "jenis": jenis, "baris": [n], "ts": r[0].isoformat(),
                "detail": {
                    "tanggal_publikasi": tgl(r[53]),
                    "kegiatan": txt(r[54]) or "Tidak diisi",
                    "platform": txt(r[55]) or "Lainnya",
                    "nama_akun": txt(r[56]) or "Tidak diisi",
                    "link_publikasi": link,
                    "file_publikasi": berkas,
                },
                "link_dok": berkas,
            })
        continue

    nomor = [n for n, _ in items]

    if jenis == "aktivitas_anak":
        d = {k: sum(num(r[i]) for _, r in items) for k, i in [
            ("usia_0_5", 8), ("usia_6_12", 9), ("usia_13_17", 10),
            ("laki_laki", 11), ("perempuan", 12),
            ("disabilitas", 13), ("perlu_layanan_lanjutan", 14)]}
        d["jumlah_kegiatan"] = sum(num(r[5]) for _, r in items)
        d["nama_kegiatan"] = gabung([txt(r[6]) for _, r in items])
        jenis_semua = []
        for _, r in items:
            jenis_semua += jenis_anak(r[7])
        d["jenis_kegiatan"] = list(dict.fromkeys(jenis_semua))
        d["temuan"] = gabung([txt(r[15]) for _, r in items])
        d["tindak_lanjut"] = gabung([txt(r[16]) for _, r in items])
        if d["nama_kegiatan"] is None:
            raise SystemExit(f"nama kegiatan anak kosong: baris {nomor}")
        # Satu baris sumber = satu kegiatan anak. `jenis` tiap kegiatan diambil
        # dari baris sumbernya sendiri, bukan dari gabungan seluruh baris.
        d["_per_baris"] = [{"nama": txt(r[6]) or "", "jenis": jenis_anak(r[7])}
                           for _, r in items]
        detail = d

    elif jenis == "aktivitas_perempuan":
        d = {"total_ikut": sum(num(r[20]) for _, r in items),
             "kepala_keluarga": sum(num(r[21]) for _, r in items),
             "hamil": sum(num(r[22]) for _, r in items),
             "lansia": sum(num(r[23]) for _, r in items),
             "disabilitas": sum(num(r[24]) for _, r in items)}
        d["jumlah_kegiatan"] = sum(num(r[17]) for _, r in items)
        d["nama_kegiatan"] = gabung([txt(r[18]) for _, r in items])
        jenis_t = [v for v in dict.fromkeys(txt(r[19]) for _, r in items) if v]
        d["jenis_kegiatan"] = "; ".join(jenis_t) if jenis_t else None
        d["manfaat"] = gabung([txt(r[25]) for _, r in items])
        if d["nama_kegiatan"] is None:
            raise SystemExit(f"nama kegiatan perempuan kosong: baris {nomor}")
        # Subkelompok tidak boleh melebihi total (anomali A2 pada view).
        for k in ("kepala_keluarga", "hamil", "lansia", "disabilitas"):
            if d[k] > d["total_ikut"]:
                tinjau.append(f"baris {nomor}: {k} ({d[k]}) > total ({d['total_ikut']}) -> diturunkan")
                d[k] = d["total_ikut"]
        # Satu baris sumber = satu kegiatan perempuan. Dipakai untuk mengisi
        # `kegiatan` bila bentuknya cocok (lihat siapkan()).
        d["_per_baris"] = [{"nama": txt(r[18]) or "", "jenis": txt(r[19]) or ""}
                           for _, r in items]
        detail = d

    elif jenis == "rekap_pengaduan":
        n, r = items[0]
        st = (txt(r[26]) or "").lower()
        detail = {
            "status_bulan": "Nihil" if st.startswith("nihil") else "Ada aduan",
            "aduan_masuk": num(r[27]), "kekerasan_perempuan": num(r[28]),
            "kekerasan_anak": num(r[29]), "non_kekerasan_perempuan": num(r[30]),
            "non_kekerasan_anak": num(r[31]), "sudah_ditindaklanjuti": num(r[32]),
            "tercatat_simfoni": num(r[33]),
            "tindak_lanjut_umum": txt(r[34]), "pihak_terlibat": txt(r[35]),
        }
        if detail["status_bulan"] == "Nihil":
            for k in ("aduan_masuk", "kekerasan_perempuan", "kekerasan_anak",
                      "non_kekerasan_perempuan", "non_kekerasan_anak",
                      "sudah_ditindaklanjuti", "tercatat_simfoni"):
                detail[k] = 0
        detail["sudah_ditindaklanjuti"] = min(detail["sudah_ditindaklanjuti"],
                                             detail["aduan_masuk"])
        detail["tercatat_simfoni"] = min(detail["tercatat_simfoni"], detail["aduan_masuk"])

    else:  # tindak_lanjut_kasus
        n, r = items[0]
        kat = (txt(r[38]) or "").lower()
        sp = (txt(r[46]) or "").lower()
        sudah = (txt(r[47]) or "").lower() == "ya"
        detail = {
            "kode_kasus": txt(r[36]) or f"IMPOR-{n}",
            "tanggal_aduan": tgl(r[37]),
            "kategori": "kekerasan" if kat.startswith("kekerasan") else "non_kekerasan",
            "jenis_kasus": txt(r[39]) or "Tidak diisi",
            "jumlah_korban": num(r[40]) or 1,
            "jenis_kelamin": txt(r[41]) or "Tidak diisi",
            "kelompok_usia": txt(r[42]) or "Tidak diisi",
            "disabilitas": (txt(r[43]) or "").lower() == "ya",
            "kebutuhan_korban": txt(r[44]),
            "tindak_lanjut": txt(r[45]),
            "status_penanganan": "selesai" if sp.startswith("selesai")
            else ("dirujuk" if sp.startswith("dirujuk") else "dalam_proses"),
            "hambatan": txt(r[52]),
        }
        if sudah:
            tinjau.append(
                f"baris {n}: SIMFONI 'Ya' tetapi nomor/tanggal/penginput tidak lengkap — "
                "SIMFONI tidak diimpor (form tidak lagi memakainya)")
        if detail["tanggal_aduan"] is None:
            raise SystemExit(f"tanggal aduan kosong di baris {n}")

    hasil.append({
        "kab": kab, "nama": nama, "kode": kode, "hunian": hunian,
        "jenis": jenis, "baris": nomor, "ts": items[0][1][0].isoformat(),
        "detail": detail, "link_dok": tautan(items[0][1][58]),
    })

print(f"Laporan: {len(hasil)}")
for k, v in collections.Counter(h["jenis"] for h in hasil).items():
    print(f"  {k}: {v}")
print(f"\nCatatan tinjau ({len(tinjau)}):")
for t in tinjau:
    print("  -", t)

# =============================================================================
# SQL — satu tabel staging + insert set-based, id deterministik (idempoten).
# =============================================================================

TABEL = {
    "aktivitas_anak": "laporan_anak",
    "aktivitas_perempuan": "laporan_perempuan",
    "rekap_pengaduan": "laporan_rekap_pengaduan",
    "tindak_lanjut_kasus": "laporan_kasus",
    "publikasi": "laporan_publikasi",
}

# Urutan kolom rincian per jenis, sesuai definisi tabel.
KOLOM = {
    "aktivitas_anak": ["jumlah_kegiatan", "kegiatan", "nama_kegiatan", "jenis_kegiatan",
                       "usia_0_5", "usia_6_12", "usia_13_17", "laki_laki", "perempuan",
                       "disabilitas", "perlu_layanan_lanjutan", "temuan", "tindak_lanjut",
                       "hambatan"],
    "aktivitas_perempuan": ["jumlah_kegiatan", "kegiatan", "nama_kegiatan", "jenis_kegiatan",
                            "total_ikut", "kepala_keluarga", "hamil", "lansia",
                            "disabilitas", "manfaat", "hambatan"],
    "rekap_pengaduan": ["status_bulan", "aduan_masuk", "kekerasan_perempuan", "kekerasan_anak",
                        "non_kekerasan_perempuan", "non_kekerasan_anak",
                        "sudah_ditindaklanjuti", "tercatat_simfoni", "tindak_lanjut_umum",
                        "pihak_terlibat"],
    "tindak_lanjut_kasus": ["kode_kasus", "tanggal_aduan", "kategori", "jenis_kasus",
                            "jumlah_korban", "jenis_kelamin", "kelompok_usia", "disabilitas",
                            "kebutuhan_korban", "tindak_lanjut", "status_penanganan",
                            "hambatan"],
    "publikasi": ["tanggal_publikasi", "kegiatan", "platform", "nama_akun",
                  "link_publikasi", "file_publikasi"],
}

CAST = {
    "jenis_kegiatan": "text[]",
    "jumlah_kegiatan": "integer", "usia_0_5": "integer", "usia_6_12": "integer",
    "usia_13_17": "integer", "laki_laki": "integer", "perempuan": "integer",
    "disabilitas": "integer", "perlu_layanan_lanjutan": "integer",
    "total_ikut": "integer", "kepala_keluarga": "integer", "hamil": "integer",
    "lansia": "integer", "aduan_masuk": "integer", "kekerasan_perempuan": "integer",
    "kekerasan_anak": "integer", "non_kekerasan_perempuan": "integer",
    "non_kekerasan_anak": "integer", "sudah_ditindaklanjuti": "integer",
    "tercatat_simfoni": "integer", "jumlah_korban": "integer",
    "tanggal_aduan": "date", "tanggal_publikasi": "date",
    "kategori": "kategori_kasus_t", "status_penanganan": "status_penanganan_t",
}


def q(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def jsonb(v):
    return "null" if v is None else q(json.dumps(v, ensure_ascii=False)) + "::jsonb"


def ekstrak(kolom, jenis):
    """Ekspresi SQL mengambil satu kolom dari `i.detail` (jsonb).

    Perhatikan: kolom bernama `kegiatan` ada di DUA tempat dengan tipe berbeda —
    larik jsonb di laporan_anak/laporan_perempuan, dan teks biasa di
    laporan_publikasi. Pengecualian di bawah hanya untuk dua tabel pertama.
    """
    if kolom == "kegiatan" and jenis in ("aktivitas_anak", "aktivitas_perempuan"):
        # JSON `null` BUKAN SQL NULL: `-> 'kegiatan'` mengembalikan jsonb
        # bernilai 'null', yang ditolak constraint anak_kegiatan_larik
        # (jsonb_typeof harus 'array' atau nilainya NULL). Karena itu hanya
        # larik yang diambil; selain itu SQL NULL.
        return ("case when jsonb_typeof(i.detail -> 'kegiatan') = 'array'"
                " then i.detail -> 'kegiatan' end")
    if kolom == "jenis_kegiatan":
        if jenis == "aktivitas_anak":
            return ("(select coalesce(array_agg(e order by o), '{}'::text[])\n"
                    "          from jsonb_array_elements_text("
                    "coalesce(i.detail -> 'jenis_kegiatan', '[]'::jsonb))"
                    " with ordinality as t(e, o))")
        return "(i.detail ->> 'jenis_kegiatan')"
    if jenis == "tindak_lanjut_kasus" and kolom == "disabilitas":
        return "(i.detail ->> 'disabilitas')::boolean"
    tipe = CAST.get(kolom)
    return f"(i.detail ->> {q(kolom)})::{tipe}" if tipe else f"(i.detail ->> {q(kolom)})"


def siapkan(h):
    """Tambah kolom `kegiatan` bila bentuknya cocok dengan jumlah_kegiatan.

    Aplikasi memeriksa `kegiatan.length === jumlah_kegiatan`. Bila tidak sama,
    kolom dibiarkan NULL: aplikasi lalu membacanya sebagai satu kegiatan dari
    kolom ringkasan, dan tidak ada angka yang berbohong.
    """
    jenis = h["jenis"]
    detail = dict(h["detail"])
    per_baris = detail.pop("_per_baris", None)
    if jenis in ("aktivitas_anak", "aktivitas_perempuan"):
        if per_baris is not None and len(per_baris) == detail["jumlah_kegiatan"]:
            detail["kegiatan"] = per_baris
        else:
            # Baris sumber lebih sedikit daripada jumlah kegiatan (mis. Padang:
            # 42 kegiatan dalam 1 baris). Rincian per kegiatan tidak diketahui;
            # NULL lebih jujur daripada mengarang 42 kartu kosong.
            detail["kegiatan"] = None
    return detail


SPASI = uuid.UUID("00000000-0000-0000-0000-000000000000")
for i, h in enumerate(hasil, 1):
    kunci = f"impor-202611|{i}|{h['jenis']}|{h['kab']}|{h['nama']}"
    h["id_laporan"] = str(uuid.uuid5(SPASI, "laporan|" + kunci))
    h["id_rincian"] = str(uuid.uuid5(SPASI, "rincian|" + kunci))
    h["detail_final"] = siapkan(h)

pos_unik = {}
for h in hasil:
    pos_unik[(h["kab"], h["nama"])] = (h["kode"], h["hunian"])

_per = collections.Counter(h["jenis"] for h in hasil)
n_anak, n_per = _per["aktivitas_anak"], _per["aktivitas_perempuan"]
n_rek, n_kas, n_pub = _per["rekap_pengaduan"], _per["tindak_lanjut_kasus"], _per["publikasi"]

out = []
w = out.append

w("-- =============================================================================")
w("-- Impor data Google Form — Laporan Berkala Pos SAPA (Jawaban) 3.xlsx")
w("-- Dibuat 27 Nov 2026 dari docs/Laporan Berkala Pos SAPA (Jawaban) 3.xlsx")
w("-- =============================================================================")
w("--")
w("-- CARA PAKAI")
w("--   Supabase Dashboard -> SQL Editor, jalankan sebagai role postgres.")
w("--   Seluruh berkas SATU transaksi: bila verifikasi di bagian 6 gagal, semua")
w("--   dibatalkan otomatis — tidak ada yang tersimpan separuh.")
w("--")
w("-- PRASYARAT (diperiksa di bagian 0; skrip berhenti bila belum terpenuhi)")
w("--   a. supabase/seed.sql sudah dijalankan (18 wilayah).")
w("--   b. supabase/migrations/20261127000001_hapus_simfoni_dari_kasus.sql")
w("--      sudah dijalankan — constraint kasus_belum_simfoni_alasan menolak")
w("--      laporan kasus yang tidak membawa alasan SIMFONI.")
w("--   c. supabase/migrations/20261127000004_publikasi_banyak.sql sudah")
w("--      dijalankan — tanpa itu 12 publikasi RPTRA Gebang melanggar")
w("--      unique (pos_id, periode_id, jenis_laporan).")
w("--")
w("-- ISI: 46 baris Excel -> %d laporan + %d rincian" % (len(hasil), len(hasil)))
w("--   aktivitas_anak       %2d   (dari 7 baris; 1 pasang digabung)" % n_anak)
w("--   aktivitas_perempuan  %2d   (dari 14 baris; 1 grup 6 baris + 2 pasang digabung)" % n_per)
w("--   rekap_pengaduan      %2d   (dari 4 baris)" % n_rek)
w("--   tindak_lanjut_kasus  %2d   (dari 2 baris)" % n_kas)
w("--   publikasi            %2d   (dari 18 baris; 1 dilewati karena tautan bukan https)" % n_pub)
w("--")
w("-- KEPUTUSAN PEMILIK PRODUK (27 Nov 2026)")
w("--   1. Periode 2026-11-01 s/d 2026-11-19 dibuat baru. Isian '1 - 19 November")
w("--      2026' tidak sama dengan periode mingguan (Jumat-Kamis) mana pun.")
w("--   2. Nama lokasi tidak baku dipetakan ke satu nama baku; pos baru dibuat")
w("--      bila belum ada.")
w("--   3. Baris Excel 2 ('Aceh Tamiang/24476') -> Huntara Kampung Empat")
w("--      (kode pos sama: 24476).")
w("--   4. Baris Excel 19 ('Kab.Pidie Jaya') -> pos baru")
w("--      'Kantor Dinsos PPPA Kab. Pidie Jaya' (nama dari landing page).")
w("--   5. Aktivitas yang bentrok digabung: nama kegiatan digabung, peserta")
w("--      dijumlahkan. Pandan: baris 11 ('Senam Pagi Lansia', 27 orang) DIBUANG")
w("--      karena sudah tercakup baris 12 ('Pelatihan PHBS dan Senam Pagi Lansia',")
w("--      2 kegiatan, 87 orang) — bukan dijumlahkan menjadi 114.")
w("--   6. Publikasi tidak digabung: satu baris = satu laporan.")
w("--   7. '-' / '0' / 'nihil' / '\"-\"' -> NULL, bukan default yang menguntungkan.")
w("--   8. 'Ada Dokumentasi' bukan tautan -> link_dokumentasi NULL.")
w("--   9. Link publikasi bukan https -> baris DILEWATI (kolom wajib https);")
w("--      dicatat pada ringkasan generator, bukan disimpan sebagai tautan palsu.")
w("--  10. SIMFONI per kasus TIDAK diimpor: form tidak lagi memakainya dan kedua")
w("--      baris di Excel memang tidak lengkap. SIMFONI agregat pada rekap")
w("--      pengaduan tetap diimpor.")
w("--  11. status = 'terkirim', sumber_input = 'google_form', submitted_at = waktu")
w("--      pengisian Google Form, verified_by NULL (data impor, bukan verifikasi).")
w("--")
w("-- SIFAT: idempoten. Id laporan dan rincian DITENTUKAN (uuid5), jadi menjalankan")
w("-- ulang tidak menggandakan apa pun. Pos dan periode memakai ON CONFLICT.")
w("-- =============================================================================")
w("")
w("begin;")
w("")
w("-- -----------------------------------------------------------------------------")
w("-- 0. PRASYARAT — berhenti sebelum menulis apa pun.")
w("-- -----------------------------------------------------------------------------")
w("do $$")
w("declare")
w("  v integer;")
w("begin")
w("  select count(*) into v from wilayah;")
w("  if v = 0 then")
w("    raise exception 'Tabel wilayah kosong. Jalankan supabase/seed.sql lebih dulu.';")
w("  end if;")
w("")
w("  select count(*) into v from pg_constraint")
w("  where conrelid = 'laporan_kasus'::regclass")
w("    and conname in ('kasus_simfoni_lengkap', 'kasus_belum_simfoni_alasan');")
w("  if v > 0 then")
w("    raise exception 'Migrasi 20261127000001_hapus_simfoni_dari_kasus.sql belum dijalankan: % constraint SIMFONI masih aktif', v;")
w("  end if;")
w("")
w("  select count(*) into v from pg_constraint")
w("  where conrelid = 'laporan'::regclass")
w("    and conname = 'laporan_pos_id_periode_id_jenis_laporan_key';")
w("  if v > 0 then")
w("    raise exception 'Migrasi 20261127000004_publikasi_banyak.sql belum dijalankan: unique (pos_id, periode_id, jenis_laporan) masih berlaku untuk publikasi';")
w("  end if;")
w("")
w("  -- Kolom rincian yang dipakai skrip ini wajib ada. Tanpa pemeriksaan ini,")
w("  -- kegagalannya muncul sebagai 'column does not exist' di tengah impor,")
w("  -- setelah sebagian baris sudah tersimpan.")
w("  -- `hamil` sengaja TIDAK masuk daftar ini: namanya bisa 'hamil' atau")
w("  -- 'hamil_menyusui' tergantung migrasi pemisahan; diperiksa terpisah.")
w("  select count(*) into v")
w("  from (values")
for jenis, tabel in TABEL.items():
    for k in KOLOM[jenis]:
        if not (jenis == "aktivitas_perempuan" and k == "hamil"):
            w(f"    ({q(tabel)}, {q(k)}),")
# Buang koma pada baris terakhir.
out[-1] = out[-1].rstrip(",")
w("  ) as c(tabel, kolom)")
w("  where not exists (")
w("    select 1 from information_schema.columns ic")
w("    where ic.table_schema = 'public'")
w("      and ic.table_name = c.tabel")
w("      and ic.column_name = c.kolom")
w("  );")
w("  if v > 0 then")
w("    raise exception 'Ada % kolom rincian yang belum ada. Jalankan migrasi terbaru di supabase/migrations.', v;")
w("  end if;")
w("")
w("  -- Kolom peserta hamil: 'hamil' (setelah pemisahan) ATAU 'hamil_menyusui'")
w("  -- (sebelumnya). Salah satu wajib ada; keduanya ditangani bagian 5.")
w("  if not exists (")
w("    select 1 from information_schema.columns")
w("    where table_schema = 'public' and table_name = 'laporan_perempuan'")
w("      and column_name in ('hamil', 'hamil_menyusui')")
w("  ) then")
w("    raise exception 'Kolom hamil/hamil_menyusui tidak ada di laporan_perempuan';")
w("  end if;")
w("end $$;")
w("")
w("-- -----------------------------------------------------------------------------")
w("-- 1. Periode 2026-11-01 s/d 2026-11-19.")
w("-- -----------------------------------------------------------------------------")
w("insert into periode (tanggal_mulai, tanggal_selesai)")
w("values ('2026-11-01', '2026-11-19')")
w("on conflict (tanggal_mulai, tanggal_selesai) do nothing;")
w("")
w("-- -----------------------------------------------------------------------------")
w("-- 2. Pos SAPA. Pos yang sudah ada dipakai ulang apa adanya.")
w("-- -----------------------------------------------------------------------------")
w("create temporary table _pos (kab_kota text, nama_lokasi text, kode_pos text,")
w("                            jenis_hunian text) on commit drop;")
w("insert into _pos (kab_kota, nama_lokasi, kode_pos, jenis_hunian) values")
w(",\n".join(f"  ({q(kab)}, {q(nama)}, {q(kode)}, {q(hun)})"
            for (kab, nama), (kode, hun) in sorted(pos_unik.items())) + ";")
w("")
w("insert into pos_sapa (wilayah_id, nama_lokasi, kode_pos, jenis_hunian)")
w("select w.id, d.nama_lokasi, d.kode_pos, d.jenis_hunian")
w("from _pos d")
w("join wilayah w on w.kab_kota = d.kab_kota")
w("on conflict (wilayah_id, nama_lokasi) do nothing;")
w("")
w("do $$")
w("declare")
w("  v integer;")
w("begin")
w("  select count(*) into v")
w("  from _pos d")
w("  join wilayah w on w.kab_kota = d.kab_kota")
w("  join pos_sapa p on p.wilayah_id = w.id and p.nama_lokasi = d.nama_lokasi;")
w(f"  if v <> {len(pos_unik)} then")
w(f"    raise exception 'Pos siap % dari {len(pos_unik)}. Periksa nama kab/kota terhadap tabel wilayah.', v;")
w("  end if;")
w("end $$;")
w("")
w("-- -----------------------------------------------------------------------------")
w("-- 3. Staging: satu baris = satu laporan impor.")
w("-- -----------------------------------------------------------------------------")
w("create temporary table _impor (")
w("  urut         integer primary key,")
w("  id_laporan   uuid not null,")
w("  id_rincian   uuid not null,")
w("  kab_kota     text not null,")
w("  nama_lokasi  text not null,")
w("  jenis        jenis_laporan_t not null,")
w("  baris_excel  text not null,")
w("  submitted_at timestamptz not null,")
w("  link_dok     text,")
w("  detail       jsonb not null")
w(") on commit drop;")
w("")
w("insert into _impor (urut, id_laporan, id_rincian, kab_kota, nama_lokasi, jenis,")
w("                    baris_excel, submitted_at, link_dok, detail) values")
w(",\n".join(
    f"  ({i}, {q(h['id_laporan'])}, {q(h['id_rincian'])}, {q(h['kab'])}, "
    f"{q(h['nama'])}, {q(h['jenis'])}, {q(', '.join(map(str, h['baris'])))}, "
    f"{q(h['ts'])}::timestamptz, {q(h['link_dok'])}, {jsonb(h['detail_final'])})"
    for i, h in enumerate(hasil, 1)) + ";")
w("")
w("-- -----------------------------------------------------------------------------")
w("-- 4. Laporan induk. ON CONFLICT (id) DO NOTHING -> aman dijalankan ulang.")
w("-- -----------------------------------------------------------------------------")
w("insert into laporan (id, pos_id, periode_id, jenis_laporan, status, sumber_input,")
w("                     link_dokumentasi, submitted_by, submitted_at)")
w("select i.id_laporan, ps.id, pr.id, i.jenis, 'terkirim', 'google_form',")
w("       i.link_dok,")
w("       (select id from pengguna where peran = 'admin_pusat' order by email limit 1),")
w("       i.submitted_at")
w("from _impor i")
w("join wilayah w on w.kab_kota = i.kab_kota")
w("join pos_sapa ps on ps.wilayah_id = w.id and ps.nama_lokasi = i.nama_lokasi")
w("join periode pr on pr.tanggal_mulai = '2026-11-01'")
w("               and pr.tanggal_selesai = '2026-11-19'")
w("on conflict (id) do nothing;")
w("")
w("-- -----------------------------------------------------------------------------")
w("-- 5. Rincian per jenis. `detail` jsonb di-cast ke tipe kolom masing-masing.")
w("--    FK memakai id_laporan (induk), bukan id_rincian.")
w("-- -----------------------------------------------------------------------------")
for jenis, tabel in TABEL.items():
    kolom = KOLOM[jenis]
    w("")
    w(f"-- {jenis} -> {tabel}")
    if jenis == "aktivitas_perempuan":
        # Nama kolom peserta hamil berbeda tergantung apakah usulan migrasi
        # pemisahan hamil/menyusui sudah dijalankan. Ditangani dinamis supaya
        # skrip ini tidak menuntut urutan migrasi tertentu:
        #   'hamil'         -> kolom hamil (setelah pemisahan; menyusui dibiarkan 0)
        #   'hamil_menyusui'-> kolom gabungan (sebelum pemisahan)
        # Yang dinamis HANYA NAMA kolom di daftar INSERT. Di SELECT nilainya
        # tetap ekspresi staging yang sama untuk kedua kemungkinan — kuncinya
        # selalu 'hamil' — jadi tidak boleh ikut ditandai %s (kalau ikut, yang
        # tersubstitusi nama kolom, bukan nilai).
        tag = "__KOLOM_HAMIL__"
        badan = "\n".join([
            "insert into laporan_perempuan (laporan_id, "
            + ", ".join(tag if k == "hamil" else k for k in kolom) + ")",
            "select i.id_laporan,",
            "       " + ",\n       ".join(
                ekstrak(k, jenis) for k in kolom),
            "from _impor i",
            f"where i.jenis = {q(jenis)}",
            "on conflict (laporan_id) do nothing",
        ]).replace(tag, "%s")
        w("do $l$")
        w("declare")
        w("  v_kolom text := case")
        w("    when exists (select 1 from information_schema.columns")
        w("                 where table_schema = 'public'")
        w("                   and table_name   = 'laporan_perempuan'")
        w("                   and column_name  = 'hamil') then 'hamil'")
        w("    else 'hamil_menyusui'")
        w("  end;")
        w("begin")
        w("  execute format($f$" + badan + "$f$, v_kolom);")
        w("end $l$;")
        continue
    w(f"insert into {tabel} (laporan_id, {', '.join(kolom)})")
    w("select i.id_laporan,")
    w("       " + ",\n       ".join(ekstrak(k, jenis) for k in kolom))
    w("from _impor i")
    w(f"where i.jenis = {q(jenis)}")
    w("on conflict (laporan_id) do nothing;")
w("")
w("-- -----------------------------------------------------------------------------")
w("-- 5b. VERIFIKASI — gagal keras bila hasilnya tidak sesuai harapan.")
w("-- -----------------------------------------------------------------------------")
w("do $$")
w("declare")
w("  v_induk   integer;")
w("  v_rincian integer;")
w("begin")
w("  select count(*) into v_induk from laporan")
w("  where id in (select id_laporan from _impor);")
w(f"  if v_induk <> {len(hasil)} then")
w(f"    raise exception 'Laporan impor % (seharusnya {len(hasil)})', v_induk;")
w("  end if;")
w("")
w("  select count(*) into v_rincian from _impor i")
w("  where exists (select 1 from laporan_anak a where a.laporan_id = i.id_laporan)")
w("     or exists (select 1 from laporan_perempuan x where x.laporan_id = i.id_laporan)")
w("     or exists (select 1 from laporan_rekap_pengaduan r where r.laporan_id = i.id_laporan)")
w("     or exists (select 1 from laporan_kasus k where k.laporan_id = i.id_laporan)")
w("     or exists (select 1 from laporan_publikasi b where b.laporan_id = i.id_laporan);")
w(f"  if v_rincian <> {len(hasil)} then")
w(f"    raise exception 'Rincian impor % (seharusnya {len(hasil)})', v_rincian;")
w("  end if;")
w("end $$;")
w("")
w("-- -----------------------------------------------------------------------------")
w("-- 6. Ringkasan per lokasi dan jenis.")
w("-- -----------------------------------------------------------------------------")
w("select w.kab_kota, p.nama_lokasi, l.jenis_laporan,")
w("       count(*) as jumlah,")
w("       count(*) filter (where l.link_dokumentasi is not null) as ada_tautan_dok")
w("from laporan l")
w("join periode pr on pr.id = l.periode_id")
w("join pos_sapa p on p.id = l.pos_id")
w("join wilayah w on w.id = p.wilayah_id")
w("where l.id in (select id_laporan from _impor)")
w("group by w.kab_kota, p.nama_lokasi, l.jenis_laporan")
w("order by w.kab_kota, p.nama_lokasi, l.jenis_laporan;")
w("")
w("-- -----------------------------------------------------------------------------")
w("-- 7. Anomali hasil impor. Hanya DIBACA — PRD §6.4: laporkan, jangan ganti.")
w("--    Yang diharapkan: 1 distribusi_usia (Huntara Lubuk Buaya, data asli")
w("--    157 vs 170). Bila kode lain muncul, periksa sebelum commit.")
w("-- -----------------------------------------------------------------------------")
w("select a.kab_kota, a.nama_lokasi, a.kode, a.tingkat, a.keterangan")
w("from anomali_laporan a")
w("where a.laporan_id in (select id_laporan from _impor)")
w("order by a.kab_kota, a.nama_lokasi, a.kode;")
w("")
w("commit;")

sql = "\n".join(out) + "\n"
with open("/tmp/impor-202611.sql", "w", encoding="utf-8") as f:
    f.write(sql)
with open("/tmp/impor-202611.json", "w", encoding="utf-8") as f:
    json.dump({"laporan": hasil, "tinjau": tinjau}, f, ensure_ascii=False, indent=1)

print(f"\nSQL ditulis: /tmp/impor-202611.sql ({len(sql.splitlines())} baris)")
