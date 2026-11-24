# PRD — Dashboard Capaian Kinerja Penyelenggaraan Pos SAPA

**Produk:** Dashboard Capaian Kinerja Pos Sahabat Perempuan dan Anak (Pos SAPA) — Perlindungan Perempuan dan Anak Pascabencana
**Unit Pemilik:** Deputi Bidang Perlindungan Khusus Anak — Kementerian Pemberdayaan Perempuan dan Perlindungan Anak RI
**Versi PRD:** 1.1
**Tanggal:** 18 November 2026
**Dokumen acuan:** *Kerangka Acuan Kerja (KAK) Pengembangan Dashboard Capaian Kinerja Penyelenggaraan Pos SAPA*; prototipe Google Sites `https://sites.google.com/view/dashboardmonitoringpossapa2026/full-page-embed`; berkas `Laporan Berkala Pos SAPA (Jawaban).xlsx`; `Template_Header_Laporan_Pos_SAPA_2026.csv`

**Riwayat revisi**
| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 17 Nov 2026 | Draf awal berdasarkan KAK dan analisa prototipe |
| 1.1 | 18 Nov 2026 | Keputusan stack (Next.js + Supabase + Vercel); Google Sheets menjadi jalur migrasi saja; formulir input di dalam aplikasi; spesifikasi UI/UX; temuan uji data nyata |
| 1.2 | 18 Nov 2026 | Perubahan model penugasan: satu akun petugas per kabupaten/kota, bukan per lokasi Pos SAPA. Petugas memilih lokasi saat input. RLS diperbarui |

---

## 1. Ringkasan Eksekutif

Dashboard ini mengubah data laporan berkala Pos SAPA menjadi informasi capaian kinerja yang terintegrasi, aktual, dan dapat difilter. Sasaran: 18 kabupaten/kota di Provinsi Aceh, Sumatera Utara, dan Sumatera Barat, dengan titik layanan di kawasan Huntap (hunian tetap) dan Huntara (hunian sementara).

Saat ini tersedia **prototipe statis** berupa satu berkas HTML yang di-embed di Google Sites. Prototipe membuktikan konsep visualisasi dan memetakan kelima kelompok pelaporan, tetapi belum memenuhi KAK sebagai sistem: data tersimpan di `localStorage` per-browser, tidak ada autentikasi, tidak ada data master wilayah, tidak ada peta, dan tidak ada monitoring kepatuhan pelaporan.

Uji terhadap data nyata (5 baris respons formulir dari Aceh Tamiang dan Bener Meriah) menemukan **lima cacat yang dapat direproduksi** pada jalur impor prototipe — termasuk distribusi usia anak yang selalu tampil nol. Temuan ini menjadi dasar keputusan untuk menjadikan **formulir input di dalam aplikasi** sebagai satu-satunya jalur input ke depan, dengan Google Sheets dipakai hanya sekali sebagai sumber migrasi data historis.

PRD ini mendefinisikan produk produksi yang menggantikan prototipe.

---

## 2. Latar Belakang dan Masalah

Pascabencana, perempuan dan anak menghadapi peningkatan kerentanan terhadap kekerasan, eksploitasi, penelantaran, dan masalah psikososial. Pos SAPA hadir sebagai layanan berbasis masyarakat untuk aktivitas bermain dan dukungan psikososial anak, pemberdayaan dan dukungan psikososial perempuan, pengaduan kekerasan, serta KIE kepada masyarakat.

Pelaporan berkala sudah berjalan lewat Google Formulir dengan lima kelompok pelaporan, tetapi hasilnya belum dapat dimanfaatkan optimal karena:

1. **Data terfragmentasi per respons formulir** — tidak ada tampilan capaian lintas wilayah dan periode.
2. **Tidak ada rekapitulasi otomatis** — rekap nasional dan per kab/kota masih manual.
3. **Tidak ada visibilitas kepatuhan pelaporan** — tidak diketahui Pos SAPA mana yang belum menyampaikan laporan pada periode tertentu.
4. **Pencatatan SIMFONI PPA tidak terpantau** — persentase kasus yang sudah masuk SIMFONI tidak terukur.
5. **Data kasus berisiko** — perlu jaminan tampilan tanpa identitas korban dan pembatasan akses.
6. **Kualitas input tidak terkendali** — uji data nyata menunjukkan periode, nama lokasi, dan status SIMFONI diisi dengan format yang tidak seragam sehingga merusak agregasi (lihat §6.5).

---

## 3. Tujuan dan Kriteria Keberhasilan

### 3.1 Tujuan Produk
| # | Tujuan | Indikator keberhasilan (6 bulan pasca-rilis) |
|---|---|---|
| T1 | Menyediakan informasi capaian Pos SAPA yang aktual dan terintegrasi | Data periode berjalan tampil ≤ 1 menit setelah laporan disubmit |
| T2 | Menampilkan perkembangan aktivitas dan layanan di 18 kab/kota | 100% kab/kota sasaran muncul di filter dan peta |
| T3 | Menyajikan penerima manfaat per kelompok sasaran, usia, jenis kelamin, disabilitas | Seluruh dimensi tersedia di semua halaman analisis, tanpa angka nol palsu |
| T4 | Memantau pengaduan dan tindak lanjut kasus | Status penanganan dan status SIMFONI terlihat per kasus |
| T5 | Mengidentifikasi wilayah belum melapor / perlu penguatan | Matriks kepatuhan per Pos SAPA per periode |
| T6 | Menjadi dasar kebijakan | Laporan rekapitulasi dapat diunduh (PDF/Excel) untuk rapat dan pelaporan pimpinan |
| T7 | Meningkatkan kualitas data sejak sumbernya | ≥ 95% laporan lolos validasi tanpa koreksi manual pada periode ke-3 |

### 3.2 Non-Tujuan (Out of Scope v1)
- Aplikasi mobile native (cukup web responsif).
- Penggantian SIMFONI PPA (dashboard hanya membaca/mencatat status rujukan).
- Input data langsung oleh korban/masyarakat.
- Analitik prediktif atau AI.
- Integrasi API langsung ke Google Form (Google Form dinonaktifkan untuk input baru).
- Multi-bahasa (Bahasa Indonesia saja).
- Offline penuh (hanya draf formulir yang tersimpan lokal).

---

## 4. Pengguna dan Hak Akses

| Peran | Deskripsi | Hak akses |
|---|---|---|
| **Publik** | Masyarakat, peneliti, jurnalis | Halaman ringkasan nasional read-only: agregat, peta, publikasi. **Tanpa** rincian kasus, tanpa data kontak |
| **Petugas Kab/Kota** | Operator laporan — **satu akun per kabupaten/kota** | Input laporan untuk **semua lokasi Pos SAPA di wilayahnya** (memilih lokasi saat input); melihat checklist kelengkapan seluruh lokasi di wilayahnya |
| **Admin Kab/Kota** | Dinas PPPA / UPTD PPA kab/kota | Verifikasi dan buka-kunci laporan di wilayahnya; ekspor data wilayah; **boleh melihat rincian kasus lintas wilayah** (read-only) |
| **Admin Pusat (KemenPPPA)** | Sekretariat Deputi Bidang Perlindungan Khusus Anak | Akses penuh: semua wilayah, data master, verifikasi, ekspor nasional, kelola pengguna |
| **Pimpinan / Viewer Eksekutif** | Deputi, Sekretariat | Read-only penuh termasuk rincian kasus teragregasi; laporan eksekutif |

**Aturan data sensitif**
- Rincian kasus hanya tampil sebagai **kode kasus**; tidak ada nama atau identitas korban di semua level akses.
- Rincian naratif kasus (kebutuhan korban, hambatan penanganan) hanya untuk peran ber-login **Admin Kab/Kota ke atas**.
- Admin Kab/Kota boleh **membaca** rincian kasus seluruh wilayah, tetapi hanya dapat **memverifikasi/mengubah** laporan di wilayahnya sendiri.
- **Petugas terikat ke satu kabupaten/kota**, bukan ke satu lokasi. Petugas hanya melihat dan mengisi laporan untuk Pos SAPA yang berada di wilayahnya. Aturan ini ditegakkan RLS di database, bukan hanya di UI.
- Halaman publik menampilkan agregat hitungan saja.
- Semua aturan ini **dipaksakan di level database** melalui Row Level Security (RLS), bukan hanya di UI.

---

## 5. Ruang Lingkup Fungsional

### 5.1 Ringkasan Nasional (Halaman Utama)
Kartu KPI:
- Jumlah provinsi sasaran (3) dan kab/kota sasaran (18).
- Jumlah lokasi Pos SAPA aktif dan yang telah menyampaikan laporan pada periode terpilih.
- Total aktivitas Pos SAPA.
- Total penerima manfaat; anak penerima manfaat; perempuan penerima manfaat.
- Jumlah anak penyandang disabilitas yang mengikuti kegiatan.
- Jumlah pengaduan diterima dan yang telah ditindaklanjuti (dengan %).
- Jumlah kasus tercatat SIMFONI PPA (dengan %).
- Jumlah publikasi kegiatan.

Visualisasi: tren capaian per periode, perbandingan antarprovinsi/kab/kota, komposisi 5 jenis laporan, sorotan prioritas (temuan anak dan kasus belum selesai).

### 5.2 Peta Sebaran
- Peta 18 kab/kota sasaran di 3 provinsi.
- Titik lokasi Pos SAPA di kawasan Huntap/Huntara.
- Status visual per titik: aktif & melapor, aktif belum melapor, belum ada laporan.
- Klik titik → ringkasan singkat (lokasi, periode laporan terakhir, jumlah penerima manfaat).
- **Baru — belum ada di prototipe** (KAK §IV.3, §VI).

### 5.3 Analisis Aktivitas Anak (Bermain & Dukungan Psikososial)
- Total aktivitas anak per kab/kota dan periode.
- Komposisi jenis kegiatan: Edukasi, Trauma Healing, Kegiatan Fisik, Bermain Bersama, Lainnya.
- Distribusi usia: 0–5, 6–12, 13–17 tahun.
- Komposisi jenis kelamin.
- Jumlah dan proporsi anak penyandang disabilitas.
- Daftar temuan dan status tindak lanjut per lokasi, ditandai sebagai sorotan prioritas.
- Tabel rincian per lokasi/periode.

### 5.4 Analisis Aktivitas Perempuan (Pemberdayaan & Dukungan Psikososial)
- Total kegiatan perempuan per wilayah dan jenis kegiatan terbanyak.
- Total penerima manfaat perempuan per wilayah dan periode.
- Jumlah dan proporsi perempuan kepala keluarga (PEKKA).
- Komposisi perempuan hamil/menyusui dan perempuan lansia.
- Jumlah dan proporsi perempuan penyandang disabilitas.
- Rekapitulasi manfaat yang dirasakan (naratif, dapat dicari).

### 5.5 Layanan Pengaduan
- Status pelaporan bulanan: "Ada Aduan" / "Nihil".
- Tren jumlah pengaduan per periode dan wilayah.
- Perbandingan aduan kekerasan vs non-kekerasan, dipisah korban perempuan dan anak.
- Jumlah dan persentase aduan yang sudah ditindaklanjuti.
- Jumlah dan persentase aduan tercatat SIMFONI PPA.
- Pemetaan bentuk tindak lanjut umum dan pihak/instansi yang terlibat.

### 5.6 Tindak Lanjut Kasus Pengaduan
- Jumlah kasus per kategori, jenis kasus, periode, wilayah.
- Profil agregat korban/pelapor: jumlah, jenis kelamin, kelompok usia, status disabilitas.
- Pemetaan kebutuhan korban dan bentuk tindak lanjut/rujukan.
- Distribusi status penanganan: Dalam Proses, Dirujuk, Selesai.
- Pemantauan kelengkapan SIMFONI: status, nomor registrasi, tanggal input, penginput.
- Daftar alasan belum dicatat dan hambatan penanganan.

### 5.7 Publikasi dan Dokumentasi Kegiatan
- Jumlah publikasi per periode dan jenis kegiatan.
- Distribusi platform: Instagram, Facebook, TikTok, YouTube, Website Resmi, Lainnya.
- Rekapitulasi akun/instansi yang mempublikasikan.
- Galeri tautan dokumentasi; persentase laporan yang dilengkapi dokumentasi.
- Validasi URL: tautan harus diawali `https://`.

### 5.8 Monitoring Pelaporan
- Matriks kepatuhan: baris = Pos SAPA, kolom = periode, sel = status (lengkap / sebagian / belum melapor).
- "Sebagian" berarti baru mengirim sebagian dari 5 kelompok laporan yang diwajibkan pada periode itu.
- Daftar wilayah belum melapor pada periode berjalan, siap diekspor untuk tindak lanjut.
- Penanda tanggal dan waktu pembaruan data terakhir.
- **Baru — belum ada di prototipe** (KAK §IV.8, §VI).

### 5.9 Filter Global
- Periode pelaporan, Provinsi, Kabupaten/Kota, Lokasi Pos SAPA, Jenis layanan.
- Filter status SIMFONI PPA (dipertahankan dari prototipe).
- Filter berlaku lintas halaman dan tercermin di URL agar bisa dibagikan.
- **Filter Provinsi wajib ditambahkan** — prototipe belum punya, dan data formulir tidak mengandung kolom provinsi sama sekali.

### 5.10 Ekspor dan Cetak
- **Ekspor Excel (prioritas v1)** — tabel aktif dan laporan rekapitulasi capaian per periode, memakai SheetJS.
- Ekspor tabel ke CSV untuk kebutuhan ad-hoc.
- Cetak halaman / simpan PDF melalui cetak browser dengan stylesheet cetak bersih.
- Pembuatan PDF terprogram (mis. template laporan resmi) **ditunda** ke luar v1.

### 5.11 Formulir Input Laporan (Petugas)
Pengganti Google Formulir. Lima percabangan sesuai jenis laporan.

**Perilaku umum**
- Kab/kota **terisi otomatis** dari penugasan petugas dan tidak dapat diubah.
- **Lokasi Pos SAPA dipilih dari dropdown** yang hanya berisi lokasi aktif di wilayah petugas. Satu wilayah boleh memiliki beberapa lokasi (Huntap/Huntara).
- Draf disimpan **terpisah per lokasi**, sehingga laporan dua Pos SAPA tidak saling menimpa.
- Pemilihan jenis laporan memecah formulir menjadi lima bagian, mengikuti struktur Google Form agar petugas familiar.
- **Simpan draf otomatis** ke penyimpanan lokal, tersinkron saat koneksi tersedia. Petugas lapangan sering mengisi dengan sinyal buruk.
- Setelah submit, laporan terkunci; hanya Admin Kab/Kota yang dapat membuka kembali.
- Petugas dapat melihat checklist kelengkapan: laporan apa saja yang sudah/belum dikirim pada periode berjalan.

**Validasi inline (menggantikan akar masalah §6.5)**
| Aturan | Perilaku |
|---|---|
| `Sudah Dicatat di SIMFONI = Ya` | Nomor registrasi, tanggal input, dan penginput menjadi **wajib** |
| `Sudah Dicatat di SIMFONI = Belum` | Field alasan menjadi wajib |
| `Status Pelaporan Aduan = Nihil` | Seluruh hitungan aduan dikunci ke 0 |
| Jumlah aduan masuk | Harus sama dengan jumlah keempat kategori aduan |
| Total anak | Harus ≥ jumlah subkelompok usia dan ≥ jumlah per jenis kelamin |
| Total perempuan | Harus ≥ jumlah PEKKA/hamil/lansia/disabilitas |
| Link publikasi | Harus URL valid berawalan `https://` |
| Kode kasus | Unik per wilayah |
| Periode | Satu laporan per lokasi per periode per jenis laporan |

### 5.12 Manajemen Data Master
- Data 18 kab/kota (nama, provinsi, kode wilayah) — referensi tetap, bukan input bebas.
- Data lokasi Pos SAPA: nama, kab/kota, koordinat, jenis hunian (Huntap/Huntara), status aktif, penanggung jawab.
- Data periode pelaporan: tanggal mulai dan selesai.
- Data pengguna dan penugasan peran per lokasi/wilayah.
- **Pengambilan koordinat:** Admin Pusat melakukan digitasi manual — mencari lokasi Pos SAPA di Google Maps, mengambil pasangan `lat,lng` dari titik yang dipilih, lalu memasukkannya ke data master. Prasyarat Fase 3; 18 lokasi.

---

## 6. Kebutuhan Data

### 6.1 Sumber Data
| Fase | Sumber | Catatan |
|---|---|---|
| **Migrasi (sekali)** | Berkas Google Sheets `Form Responses 1` | Impor data historis ke database melalui skrip ETL sekali jalan |
| **Transisi** | Google Form **dan** formulir internal | Keduanya aktif (§15.2). Sheet diimpor manual oleh Admin Pusat, tidak otomatis |
| **Operasional (setelah transisi)** | Formulir input di dalam aplikasi (§5.11) | Satu-satunya jalur input |

Google Sheets **tidak** dijadikan pipeline berjalan. Alasannya didokumentasikan di §6.5: jalur impor berbasis CSV terbukti menghasilkan data yang salah secara diam-diam.

### 6.2 Struktur Sumber Historis
Formulir memiliki **60 kolom** pada satu sheet `Form Responses 1`, dikelompokkan menjadi lima jenis laporan yang dipilih pada pertanyaan ke-4.

| Jenis Laporan | Rentang Pertanyaan | Entitas |
|---|---|---|
| Aktivitas Anak (Bermain & Psikososial) | Q6–Q17 | `anak` |
| Aktivitas Perempuan (Pemberdayaan & Psikososial) | Q18–Q26 | `perempuan` |
| Rekapitulasi Layanan Pengaduan Bulanan | Q27–Q36 | `rekapPengaduan` |
| Rincian Tindak Lanjut Kasus Pengaduan | Q37–Q53 | `kasus` |
| Publikasi Media Sosial | Q54–Q59, Q60 | `medsos` |

Kolom Q1–Q5 (timestamp, periode, lokasi/kode pos, kabupaten/kota, jenis laporan) menjadi identitas bersama semua jenis laporan. **Kolom Q5 (Link Pengumpulan Dokumentasi) berada di posisi ke-5 pada template CSV tetapi di posisi ke-60 pada form asli** — lihat §6.5.

### 6.3 Model Data
```
wilayah(id, provinsi, kab_kota, kode_kemendagri)
pos_sapa(id, wilayah_id, nama_lokasi, kode_pos, jenis_hunian[Huntap|Huntara],
         lat, lng, status_aktif, penanggung_jawab)
periode(id, tanggal_mulai, tanggal_selesai, label)
laporan(id, pos_id, periode_id, jenis_laporan, status[DRAT|TERKIRIM|TERVERIFIKASI],
        sumber_input[form_internal|google_form],
        submitted_by, submitted_at, verified_by, verified_at, link_dokumentasi)
  ├─ laporan_anak(laporan_id, jumlah_kegiatan, nama_kegiatan, jenis_kegiatan[],
  │               usia_0_5, usia_6_12, usia_13_17, laki_laki, perempuan,
  │               disabilitas, perlu_layanan_lanjutan, temuan, tindak_lanjut)
  ├─ laporan_perempuan(laporan_id, jumlah_kegiatan, nama_kegiatan, jenis_kegiatan,
  │                   total_ikut, kepala_keluarga, hamil_menyusui, lansia,
  │                   disabilitas, manfaat)
  ├─ laporan_rekap_pengaduan(laporan_id, status_bulan, aduan_masuk, kekerasan_perempuan,
  │                          kekerasan_anak, non_kekerasan_perempuan, non_kekerasan_anak,
  │                          sudah_ditindaklanjuti, tercatat_simfoni, tindak_lanjut_umum,
  │                          pihak_terlibat)
  ├─ laporan_kasus(laporan_id, kode_kasus, tanggal_aduan, kategori, jenis_kasus,
  │               jumlah_korban, jenis_kelamin, kelompok_usia, disabilitas,
  │               kebutuhan_korban, tindak_lanjut, status_penanganan, sudah_simfoni,
  │               no_registrasi_simfoni, tanggal_input_simfoni, penginput_simfoni,
  │               alasan_belum_simfoni, hambatan)
  └─ laporan_publikasi(laporan_id, tanggal_publikasi, kegiatan, platform,
                       nama_akun, link_publikasi, file_publikasi)
pengguna(id, nama, email, peran, wilayah_id|null, pos_id|null /* tidak dipakai */)
audit_log(id, aktor_id, entitas, entitas_id, aksi, perubahan, waktu)
```

Catatan: `periode` disimpan sebagai tanggal, bukan string bebas. Label diturunkan dari tanggal.

**Penugasan petugas.** Petugas terikat ke `wilayah_id` (kabupaten/kota), bukan ke `pos_id`. Kolom `pos_id` pada `pengguna` dipertahankan untuk kompatibilitas tetapi tidak dibaca oleh kode. Karena satu wilayah dapat memiliki beberapa lokasi Pos SAPA, `laporan.pos_id` tetap menjadi kunci penentu lokasi mana yang dilaporkan.

**Constraint peran:**
- `petugas` → wajib `wilayah_id`
- `admin_kabkota` → wajib `wilayah_id`
- `admin_pusat`, `pimpinan` → tidak wajib keduanya

### 6.4 Aturan Validasi Data
- Lokasi dan kab/kota harus merujuk ke data master (tidak ada input bebas).
- Total penerima manfaat tidak boleh kurang dari jumlah subkelompok; selisih ditandai sebagai anomali, **bukan** diganti dengan `max()` seperti prototipe.
- `status_bulan = 'Nihil'` → seluruh hitungan aduan = 0.
- `sudah_simfoni = 'Ya'` mewajibkan nomor registrasi, tanggal input, dan penginput.
- Kode kasus unik per wilayah.
- Periode valid dan tidak tumpang tindih untuk lokasi yang sama.
- Nilai kosong tampil sebagai **"belum diisi"** — tidak pernah diganti default yang menguntungkan.

### 6.5 Temuan Uji Data Nyata

Pengujian dilakukan terhadap `Laporan Berkala Pos SAPA (Jawaban).xlsx` (5 baris, 2 kab/kota) dan `Template_Header_Laporan_Pos_SAPA_2026.csv`.

**B1 — Karakter en-dash mematikan distribusi usia**
Header formulir memakai en-dash `–` (U+2013): `Jumlah Usia Anak 0–5 Tahun`. Kode prototipe mencari dengan hyphen ASCII `-` (U+002D). Hasil: ketiga kelompok usia **tidak pernah ditemukan** dan tampil `0`. Pada baris Bener Meriah, nilai sebenarnya 50/70/80 (total 200), tetapi dashboard melaporkan 0/0/0. Total keseluruhan tetap 200 hanya karena prototipe memakai `max(sumUsia, sumGender)` dan jumlah per gender kebetulan juga 200 — kerusakan tersembunyi. Template CSV memakai hyphen, sehingga bug ini **tidak pernah terlihat saat menguji dengan template**.

**B2 — Urutan kolom template berbeda dari form asli**
Template CSV menempatkan `Link Pengumpulan Dokumentasi Kegiatan` di kolom ke-5; form asli menempatkannya di kolom ke-60. Kolom 5–59 bergeser satu posisi. Tidak berdampak pada prototipe (karena pencocokan substring), tetapi menjadi jebakan fatal bagi parser berbasis indeks.

**B3 — Template tidak konsisten dengan kode**
`downloadTemplateCSV()` menghasilkan 59 header, sedangkan file template yang beredar berisi 60 header bernomor 1–59. Dua sumber kebenaran yang berbeda.

**B4 — Kata kunci "Tindak Lanjut" salah kolom**
Pada template, kata kunci `'Tindak Lanjut (Pendampingan'` gagal cocok sehingga jatuh ke `'Tindak Lanjut'` yang menangkap Q17 (Tindak Lanjut Temuan Anak). Kasus `ACH-01` menampilkan tindak lanjut temuan anak sebagai tindak lanjut kasusnya.

**B5 — Indikator dokumentasi palsu 100%**
Kolom Q60 kosong di semua baris, tetapi prototipe memberi default `|| 'Ada Dokumentasi'`, sehingga KPI menampilkan 5/5 = 100% padahal tidak ada satu pun tautan dokumentasi.

**B6 — Sheet turunan menghasilkan record kosong**
Sheet `Aktivitas Anak`, `Aktivitas Perempuan`, `Rekap Pengaduan`, `TL Kasus`, dan `Publikasi Medsos` tidak memiliki kolom `Jenis Laporan`. Pemetaan gagal menentukan cabang dan menghasilkan record kosong, lalu `allRecords = mapped` **menimpa** data baik dan tetap menampilkan toast "Berhasil menyinkronkan".

**Kualitas data yang ditemukan (bukan bug, tetapi merusak agregasi)**
```
Periode    : '2026-11'  vs  '5 - 19 November 2026'
Lokasi     : 'Huntara Kampung Empat / 24476'  vs  'Aceh Tamiang/ 24476'
             (Pos SAPA yang sama, nama berbeda)
             'Gayo Lues' diisi sebagai nama lokasi
Provinsi   : tidak ada kolomnya sama sekali
SIMFONI    : kasus ACH-01 berstatus 'Ya' tetapi nomor registrasi,
             tanggal input, dan penginput kosong
Link       : 'googleforms.com' (bukan URL lengkap)
```

**Konsisten:** rekap aduan (2 = 0+1+0+1) dan jumlah anak per gender vs usia (200 = 200).

**Implikasi.** Formulir input di dalam aplikasi (§5.11) ditetapkan sebagai jalur input tunggal karena menghapus B1–B6 seluruhnya: tidak ada CSV, tidak ada parsing header, tidak ada nama wilayah yang diketik bebas, dan validasi berjalan saat input. ETL Sheets hanya dipakai sekali untuk migrasi, dengan pemetaan berbasis indeks kolom tetap dan validasi header yang **gagal keras** bila tidak cocok.

---

## 7. Arsitektur Teknis

### 7.1 Stack
| Lapisan | Pilihan | Alasan |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Server Components mengambil data langsung dari database tanpa API perantara; deploy native di Vercel; ekosistem paling matang untuk kebutuhan ini |
| Styling | **Tailwind CSS + shadcn/ui** | Prototipe sudah memakai Tailwind; token warna dapat dipindahkan langsung. shadcn/ui menyediakan komponen aksesibel tanpa mengunci desain |
| Database | **Supabase (PostgreSQL 16)** | Relasional — 90% kebutuhan dashboard adalah `GROUP BY`. Region Singapore (±20–40 ms dari Indonesia) |
| Autentikasi | **Supabase Auth** (email + password) | Satu platform dengan database; RLS terintegrasi langsung. SSO tidak diperlukan (§15) |
| Otorisasi | **Row Level Security (Postgres)** | Aturan peran dipaksakan di database, bukan di UI |
| Grafik | **Recharts** | Deklaratif, SSR-friendly, cetak lebih baik dari Chart.js |
| Peta | **Leaflet + react-leaflet** | Gratis, tanpa API key. 18 titik tidak membutuhkan Google Maps |
| Formulir | **React Hook Form + Zod** | Skema Zod dipakai bersama klien dan server — satu sumber validasi |
| Tabel | **TanStack Table** | Sortir, filter, dan paginasi tanpa menulis ulang |
| Komponen tanggal | date-fns (`id` locale) | Format tanggal Indonesia |
| Migrasi DB | Supabase CLI | Skema berversi di repositori |
| Pengujian | Vitest + Playwright | Unit untuk logika agregasi, E2E untuk alur input dan DRC |

**Alternatif yang tidak dipilih**
| Alternatif | Alasan tidak dipilih |
|---|---|
| Firebase / Firestore | Cloud Functions hanya bisa di-deploy di paket berbayar (Blaze), sehingga ETL tidak bisa berjalan gratis. API agregasi klasik tidak mendukung `GROUP BY` — justru pola kueri utama dashboard ini. Biaya per pembacaan dokumen tidak cocok untuk dashboard yang sering di-refresh |
| Vite + React SPA terpisah | Memerlukan API backend terpisah; kehilangan keunggulan Server Components dan rendering data sensitif di server |
| Astro | Bagus untuk situs statis, kurang cocok untuk aplikasi ber-login yang berat interaksi |
| Prisma ORM | Lapisan tambahan; `@supabase/supabase-js` dengan kueri SQL dan tipe hasil generate sudah cukup |

### 7.2 Topologi
```
Pengguna ──► Vercel (Next.js, region sin1)
                │
                ├─► Supabase Postgres (sin)  ← Server Components & Route Handlers
                │      └─ RLS: publik / petugas / admin kab / admin pusat
                │
                └─► Supabase Storage (opsional, bila file publikasi diunggah)
```

- Koneksi database lewat **Supabase pooler** atau `supabase-js` (HTTP), menghindari masalah koneksi pada lingkungan serverless.
- **Tidak ada Redis atau data warehouse.** Skala data tidak membenarkannya; cache HTTP Next.js (`revalidate`) sudah cukup.
- Region function Vercel diset `sin1`.

### 7.3 Sinkronisasi Data (Migrasi Saja)
Skrip sekali jalan (`scripts/migrate-sheets.ts`), dijalankan manual oleh Admin Pusat:

1. Baca sheet `Form Responses 1` via **Google Sheets API dengan service account** — bukan URL CSV publik, karena sheet memuat data kasus yang sensitif.
2. Validasi header pada indeks yang diharapkan (setelah normalisasi en-dash dan prefix nomor).
3. Bila validasi gagal → **berhenti dan laporkan**, jangan melanjutkan.
4. Normalisasi: periode → tanggal, lokasi → `pos_id` melalui pencocokan ke data master, provinsi → dari data master.
5. Tulis dalam satu transaksi; laporkan baris yang ditolak beserta alasannya.

Tidak ada cron, tidak ada sinkronisasi berulang.

### 7.4 Biaya
| Layanan | Paket | Biaya |
|---|---|---|
| Supabase | **Free** | **$0** |
| Vercel | **Hobby** (konsumsi internal, non-komersial) | **$0** |

**Total: $0/bulan.**

Ukuran data tidak pernah menjadi kendala: 18 lokasi × 5 jenis × 52 minggu ≈ 4.700 baris/tahun, sekitar 5–15 MB/tahun.

### 7.5 Batasan Paket Free dan Mitigasi Wajib
Paket gratis dipilih secara sadar. Dua batasan berikut **harus** ditangani secara operasional — lihat §15.1 untuk uraian lengkap:

1. **Project Supabase di-pause setelah 7 hari tanpa aktivitas.** Mitigasi: Vercel Cron harian melakukan ping ringan ke database.
2. **Tidak ada backup otomatis.** Mitigasi: `pg_dump` manual terjadwal mingguan, disimpan di luar Supabase, dengan prosedur restore yang diuji.

Bila mitigasi №2 tidak dapat dijalankan secara disiplin, naik ke Supabase Pro ($25/bulan) — lebih murah daripada kehilangan data kasus.

---

## 8. Desain UI/UX

### 8.1 Arah Visual
Evolusi dari prototipe: identitas visual yang sudah dilihat pimpinan dipertahankan, dengan perbaikan keterbacaan dan responsivitas.

**Design token**
```
Navy        #1e293b   header, teks utama
Navy dark   #0f172a   gradient header
Navy light  #334155
Amber       #f59e0b   aksen, garis header (BUKAN untuk teks di atas putih — kontras gagal)
Amber dark  #d97706
Blue        #2563eb   data anak, aksi primer
Rose        #e11d48   data perempuan, kekerasan, peringatan
Emerald     #10b981   selesai / tercatat
Slate-50    #f8fafc   latar halaman

Display     Plus Jakarta Sans (judul, angka KPI)
Body        Inter (teks)
```

**Warna semantik** (konsisten di seluruh aplikasi, tidak diacak per grafik):
| Makna | Warna |
|---|---|
| Kekerasan / belum ditangani / peringatan | Rose |
| Tercatat / selesai / berhasil | Emerald |
| Menunggu / dalam proses | Amber |
| Netral / data umum | Navy, Blue |

### 8.2 Struktur Halaman
```
PUBLIK (tanpa login)
  /                  Ringkasan nasional, peta, publikasi — agregat saja

INTERNAL (login)
  /dashboard         Ringkasan + sorotan prioritas
  /dashboard/anak
  /dashboard/perempuan
  /dashboard/pengaduan
  /dashboard/kasus
  /dashboard/publikasi
  /monitoring        Matriks kepatuhan per Pos SAPA
  /peta              Sebaran Huntap/Huntara
  /input             Formulir 5 percabangan (petugas)
  /laporan-saya      Checklist kelengkapan petugas
  /admin             Data master, pengguna, verifikasi (admin)
```

Halaman publik dan internal berbagi komponen dan kueri; yang berbeda adalah tingkat detail dan visibilitas field sensitif.

### 8.3 Tata Letak Komponen

**Header** — gradient navy → biru dengan garis bawah amber setebal 4px. Berisi identitas instansi, judul, dan aksi (sinkron/cetak/masuk).

**Filter bar** — desktop: horizontal. Di bawah 768px: satu tombol "Filter" yang membuka panel; filter aktif tampil sebagai chip yang dapat dihapus satu per satu. Prototipe menumpuk 5 dropdown vertikal dan menutupi konten di ponsel — ini diperbaiki.

**Kartu KPI** — 4 kolom desktop, 2 kolom tablet, 1 kolom ponsel. Angka besar, label kecil, sub-indikator di bawah.

**Tabel** — desktop: scroll horizontal dengan kolom pertama (Kab/Kota) sticky. Ponsel: berubah menjadi kartu bertumpuk, bukan tabel terpotong.

**Grafik** — palet kategorikal berurutan yang konsisten lintas halaman. Setiap grafik menyediakan tabel alternatif untuk aksesibilitas.

**Cetak** — `@media print`: sembunyikan filter, tombol, dan navigasi tab; header menyusut; latar putih; grafik tetap tercetak. Prototipe memanggil `window.print()` tanpa stylesheet cetak sehingga tombol ikut tercetak.

### 8.4 Aksesibilitas
- Kontras teks minimal 4.5:1. Amber `#f59e0b` hanya sebagai aksen latar atau garis, tidak pernah sebagai teks di atas putih.
- Navigasi keyboard penuh dengan indikator fokus yang terlihat.
- Label ARIA pada grafik dan tabel data.
- Status tidak disampaikan lewat warna saja — selalu disertai teks atau ikon.

### 8.5 Formulir Input
- Satu kolom di ponsel, dua kolom di desktop.
- Bagian identitas laporan di atas, terisi otomatis dan tidak dapat diubah.
- Lima bagian laporan ditampilkan sesuai pilihan jenis laporan.
- Indikator kemajuan ("3 dari 5 laporan periode ini terkirim").
- Peringatan sebelum meninggalkan halaman bila ada draf belum tersimpan.
- Pesan validasi muncul di samping field yang bersangkutan, bukan sebagai toast global.

---

## 9. Kebutuhan Non-Fungsional

- **Kinerja:** halaman utama termuat < 3 detik pada koneksi 3G; agregat publik di-cache.
- **Ketersediaan:** 99% uptime jam kerja; data tetap terbaca meski sinkronisasi migrasi gagal.
- **Keamanan & privasi:** HTTPS wajib; tidak ada identitas korban di dashboard; RLS untuk semua tabel; audit log untuk perubahan data kasus; patuh pada ketentuan pelindungan data pribadi.
- **Sifat konsumsi:** internal tim (bukan situs publik terbuka). Halaman publik tetap tersedia tetapi tidak menjadi kanal utama distribusi. Bila kelak dibuka untuk publik luas, Vercel Hobby harus ditinjau ulang.
- **Backup:** paket Free tidak menyediakan backup otomatis. Wajib `pg_dump` manual terjadwal mingguan disimpan di luar Supabase (§7.5), dengan prosedur restore yang diuji sebelum data produksi masuk.
- **Aksesibilitas:** WCAG 2.1 level AA untuk kontras dan navigasi keyboard.
- **Kompatibilitas:** Chrome/Edge/Firefox/Safari versi terkini; responsif mulai 360px.
- **Lokalisasi:** Bahasa Indonesia; format angka dan tanggal `id-ID`.
- **Kemudahan pemakaian:** petugas lapangan harus dapat menyelesaikan satu laporan tanpa pelatihan panjang; istilah mengikuti formulir asli.

---

## 10. Alur Pengguna Utama

1. **Petugas** login → `/laporan-saya` melihat checklist **seluruh lokasi Pos SAPA di kabupaten/kotanya** untuk periode berjalan → memilih lokasi → membuka `/input` → kab/kota terisi otomatis, lokasi dipilih dari dropdown wilayah → mengisi bagian sesuai jenis laporan → validasi inline → submit. Draf tersimpan per lokasi bila sinyal terputus.
2. **Admin Kab/Kota** membuka `/monitoring` → melihat Pos SAPA yang belum melapor → menghubungi petugas → memverifikasi laporan yang masuk → membuka kunci bila perlu perbaikan.
3. **Admin Pusat** membuka Ringkasan Nasional → memfilter provinsi/periode → mengekspor rekap untuk laporan pimpinan.
4. **Pimpinan** membuka dashboard → melihat KPI dan sorotan prioritas → mencetak PDF.
5. **Publik** membuka `/` → melihat agregat nasional, peta, dan publikasi tanpa rincian kasus.

---

## 11. Metrik dan Pelaporan Produk

- Rasio kepatuhan pelaporan: Pos SAPA melapor lengkap ÷ 18 per periode.
- Waktu dari submit ke tampil di dashboard.
- Persentase laporan lolos validasi tanpa koreksi manual.
- Persentase kasus tercatat SIMFONI PPA.
- Persentase laporan dengan dokumentasi (dihitung dari tautan yang benar-benar terisi).
- Jumlah temuan anak yang belum ditindaklanjuti.
- Jumlah pengguna aktif per peran per bulan.

---

## 12. Rencana Rilis Bertahap

| Fase | Cakupan | Keluaran |
|---|---|---|
| **Fase 0 — Fondasi** | Next.js + Supabase, skema database, data master 18 kab/kota + lokasi Pos SAPA, auth + RLS, migrasi data historis | Data historis masuk; login dan hak akses berfungsi |
| **Fase 1 — Paritas prototipe** | 5 halaman analisis, KPI, filter global (termasuk provinsi), ekspor Excel, cetak | Dashboard produksi menggantikan prototipe |
| **Fase 2 — Input & kepatuhan** | Formulir 5 percabangan, validasi inline, draf, checklist petugas, Monitoring Pelaporan | **Google Form tetap aktif** sebagai jalur paralel selama transisi (§15.2) |
| **Fase 3 — Fitur KAK yang belum ada** | Peta sebaran (digitasi manual 18 koordinat), sorotan prioritas, timestamp pembaruan | Gap §13 tertutup |
| **Fase 4 — Penyempurnaan** | Verifikasi berjenjang, audit log, penandaan anomali | Kesiapan operasional penuh |

**Prasyarat lintas fase (bukan fitur, tetapi harus ada):**
- Vercel Cron ping harian — mencegah Supabase Free di-pause (§7.5).
- Prosedur `pg_dump` mingguan + uji restore (§7.5).
- Penandaan `sumber_input` pada tabel `laporan` selama transisi (§15.2).

---

## 13. Analisis Gap: KAK vs Prototipe

| # | Kebutuhan KAK | Status di prototipe | Tindakan |
|---|---|---|---|
| 1 | Integrasi data Google Form | Sebagian — tarik CSV manual | Diganti formulir internal; Sheets hanya untuk migrasi |
| 2 | Pengelompokan per provinsi/kab/kota/lokasi/periode | Kab/kota, lokasi, periode ada; **provinsi tidak ada** | Tambah dimensi provinsi dari data master |
| 3 | Grafik, tabel, angka indikator, **peta sebaran** | Grafik/tabel/angka ada; **peta tidak ada** | Bangun peta Leaflet |
| 4 | Analisis penerima manfaat & aktivitas | Ada, tetapi distribusi usia salah (B1) | Perbaiki lewat formulir tervalidasi |
| 5 | Analisis pengaduan & tindak lanjut | Ada | Pertahankan, tambah validasi |
| 6 | Analisis publikasi | Ada | Pertahankan, tambah validasi URL |
| 7 | Filter periode/provinsi/kab/kota/jenis layanan | Periode, kab/kota, lokasi, SIMFONI ada; **provinsi & jenis layanan tidak** | Tambah |
| 8 | Informasi wilayah belum melapor | **Tidak ada** | Bangun Monitoring Pelaporan |
| 9 | Jumlah Pos aktif & sudah melapor | Menampilkan jumlah laporan, bukan jumlah Pos | Data master lokasi |
| 10 | Kewenangan pengguna berjenjang | **Tidak ada autentikasi** | Auth + RLS |
| 11 | Data tersimpan dan terbarui berkala | `localStorage` lokal | Database terpusat |
| 12 | Kode kasus tanpa identitas korban | Sudah diterapkan | Pertahankan & uji |
| 13 | Penanda waktu pembaruan terakhir | Badge sumber ada, timestamp tidak | Tambah |

---

## 14. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Formulir internal menambah lingkup besar dan memperlambat rilis | Jadwal mundur | Fase 1 merilis paritas prototipe lebih dulu (data historis + view), formulir menyusul di Fase 2 |
| Petugas menolak pindah dari Google Form | Data berhenti masuk | Google Form tetap aktif selama transisi (§15.2); checklist dan pengingat |
| Supabase Free di-pause karena sepi akses | Dashboard mati | Cron ping harian (§7.5) |
| Tidak ada backup otomatis di paket Free | Data hilang permanen | `pg_dump` mingguan + uji restore; naik ke Pro bila tidak disiplin (§7.5) |
| Data dari dua jalur input tidak konsisten | Agregasi ganda/terlewat | Kolom `sumber_input`; deduplikasi per lokasi/periode/jenis saat impor manual |
| Nama kab/kota/lokasi tidak konsisten | Agregasi salah | Dropdown dari data master; tidak ada input bebas |
| Satu petugas mengelola beberapa lokasi sehingga laporan tertukar | Data salah pos | Lokasi dipilih eksplisit di setiap input; draf disimpan per lokasi; keunikan dijaga `unique(pos_id, periode_id, jenis_laporan)` |
| Data kasus sensitif bocor | Risiko hukum & reputasi | Kode kasus saja, RLS di database, audit log, tanpa tabel mentah untuk publik |
| Angka penerima manfaat tidak konsisten antar-subkelompok | KPI salah | Validasi input dan penandaan anomali, bukan `max()` |
| Koordinat lokasi tidak tersedia | Peta kosong | Kumpulkan 18 koordinat sebagai prasyarat Fase 3 |
| Kuota/billing terlampaui tanpa pemantauan | Layanan berhenti | Budget alert pada Supabase dan Vercel |

---

## 15. Keputusan yang Telah Ditetapkan

| # | Pertanyaan | Keputusan | Dampak pada PRD |
|---|---|---|---|
| 1 | Google Form lama | **Tetap dibuka selama masa transisi** | §6.1 dan §12 disesuaikan: dua jalur input aktif hingga Fase 2 stabil |
| 2 | Sumber koordinat Pos SAPA | **Digitasi manual dari Google Maps** | §5.12 dan Fase 3: 18 koordinat diambil oleh Admin Pusat melalui pencarian titik di Google Maps |
| 3 | Akses rincian kasus lintas wilayah | **Diperbolehkan** untuk Admin Kab/Kota | §4 disesuaikan; RLS mengizinkan baca lintas wilayah namun tetap menolak untuk peran Petugas |
| 4 | SSO KemenPPPA | **Tidak diperlukan** | Auth memakai email + password Supabase |
| 5 | Format laporan rekapitulasi | **Excel saja** untuk saat ini | §5.10: ekspor Excel menjadi prioritas; PDF ditunda ke luar v1, kecuali cetak browser |
| 6 | Paket layanan | **Gunakan paket gratis** | §7.4 dan §7.5: risiko dan mitigasi paket Free didokumentasikan |
| 7 | Kedaulatan data | **Tidak menjadi kendala** — konsumsi internal tim | Supabase region Singapore dapat diterima |

### 15.1 Konsekuensi Keputusan №6 dan Mitigasinya

Paket gratis Supabase dan Vercel dipilih karena dashboard hanya dikonsumsi tim internal. Dua batasan paket Free tetap harus ditangani secara operasional:

| Batasan | Dampak bila diabaikan | Mitigasi wajib |
|---|---|---|
| Project Supabase di-pause setelah 7 hari tanpa aktivitas | Dashboard tidak dapat diakses sampai dipulihkan manual | Vercel Cron harian melakukan ping ringan ke database (1×/hari cukup, sesuai batas Hobby) |
| Tidak ada backup otomatis | Data hilang permanen bila terjadi kesalahan | **`pg_dump` manual terjadwal mingguan** disimpan di luar Supabase; prosedur didokumentasikan dan diuji sebelum data produksi masuk |
| Batas 500 MB database | Tidak relevan — estimasi 5–15 MB/tahun | Tidak perlu tindakan |
| Vercel Hobby untuk non-komersial | Risiko penangguhan bila dianggap komersial | Konsumsi internal tidak berbayar; tinjau ulang bila akses diperluas ke publik |

> **Catatan penting:** tanpa backup dan tanpa penjaga aktivitas, paket Free tidak boleh dipakai begitu saja. Kedua mitigasi di atas adalah **prasyarat**, bukan opsional. Bila tim tidak dapat menjalankan `pg_dump` mingguan secara disiplin, naik ke Supabase Pro ($25/bulan) lebih murah daripada kehilangan data kasus.

### 15.2 Masa Transisi Input
Selama transisi, Google Form tetap aktif dan petugas boleh memilih salah satu jalur. Aturan:
- Admin Kab/Kota memantau `/monitoring` yang menggabungkan laporan dari kedua jalur.
- Formulir internal diberi tanda sumber (`sumber_input = 'form_internal' | 'google_form'`) agar dapat diaudit.
- Data dari Google Sheets **tidak** disinkronkan otomatis selama transisi — hanya diimpor manual oleh Admin Pusat, dengan validasi §7.3.
- Transisi berakhir ketika kepatuhan pelaporan melalui formulir internal mencapai 100% selama satu periode penuh.

---

## 16. Lampiran

### 16.1 Daftar 18 Kabupaten/Kota Sasaran
| Provinsi | Jumlah | Kabupaten/Kota |
|---|---|---|
| Aceh | 8 | Pidie Jaya; Aceh Timur; Aceh Utara; Bener Meriah; Aceh Tengah; Gayo Lues; Nagan Raya; Aceh Tamiang |
| Sumatera Utara | 5 | Langkat; Tapanuli Selatan; Tapanuli Tengah; Tapanuli Utara; Kota Sibolga |
| Sumatera Barat | 5 | Agam; Padang Pariaman; Tanah Datar; Solok; Kota Padang |
| **Total** | **18** | |

### 16.2 Pemetaan 60 Kolom Formulir ke Dashboard
| Indeks | Kelompok | Halaman |
|---|---|---|
| 1 | Timestamp | Audit |
| 2–5 | Identitas laporan (periode, lokasi, kab/kota, jenis laporan) | Semua halaman + Monitoring |
| 6–17 | Aktivitas Anak | Aktivitas Anak |
| 18–26 | Aktivitas Perempuan | Aktivitas Perempuan |
| 27–36 | Rekapitulasi Layanan Pengaduan | Layanan Pengaduan |
| 37–53 | Rincian Tindak Lanjut Kasus | Tindak Lanjut Kasus |
| 54–59 | Publikasi Media Sosial | Publikasi |
| 60 | Link Pengumpulan Dokumentasi | Semua halaman (indikator kelengkapan) |

> **Peringatan:** pada form asli, kolom dokumentasi berada di indeks 60; pada template CSV di indeks 5. Migrasi harus memetakan berdasarkan **indeks form asli**, bukan template.

### 16.3 Data Uji
`Laporan Berkala Pos SAPA (Jawaban).xlsx` — 5 baris, 2 dari 18 kab/kota (Aceh Tamiang, Bener Meriah), 5 sheet turunan. Data uji awal, bukan data produksi.

### 16.4 Referensi
- KAK Dashboard Capaian Kinerja Pos SAPA (Deputi Bidang Perlindungan Khusus Anak).
- Prototipe: `https://sites.google.com/view/dashboardmonitoringpossapa2026/full-page-embed`
- Supabase Pricing — https://supabase.com/pricing
- Firestore aggregation query limitations — https://firebase.google.com/docs/firestore/query-data/aggregation-queries
