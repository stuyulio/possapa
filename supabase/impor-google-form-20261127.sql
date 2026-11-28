-- =============================================================================
-- Impor data Google Form — Laporan Berkala Pos SAPA (Jawaban) 3.xlsx
-- Dibuat 27 Nov 2026 dari docs/Laporan Berkala Pos SAPA (Jawaban) 3.xlsx
-- =============================================================================
--
-- CARA PAKAI
--   Supabase Dashboard -> SQL Editor, jalankan sebagai role postgres.
--   Seluruh berkas SATU transaksi: bila verifikasi di bagian 6 gagal, semua
--   dibatalkan otomatis — tidak ada yang tersimpan separuh.
--
-- PRASYARAT (diperiksa di bagian 0; skrip berhenti bila belum terpenuhi)
--   a. supabase/seed.sql sudah dijalankan (18 wilayah).
--   b. supabase/migrations/20261127000001_hapus_simfoni_dari_kasus.sql
--      sudah dijalankan — constraint kasus_belum_simfoni_alasan menolak
--      laporan kasus yang tidak membawa alasan SIMFONI.
--   c. supabase/migrations/20261127000004_publikasi_banyak.sql sudah
--      dijalankan — tanpa itu 12 publikasi RPTRA Gebang melanggar
--      unique (pos_id, periode_id, jenis_laporan).
--
-- ISI: 46 baris Excel -> 37 laporan + 37 rincian
--   aktivitas_anak        6   (dari 7 baris; 1 pasang digabung)
--   aktivitas_perempuan   8   (dari 14 baris; 1 grup 6 baris + 2 pasang digabung)
--   rekap_pengaduan       4   (dari 4 baris)
--   tindak_lanjut_kasus   2   (dari 2 baris)
--   publikasi            17   (dari 18 baris; 1 dilewati karena tautan bukan https)
--
-- KEPUTUSAN PEMILIK PRODUK (27 Nov 2026)
--   1. Periode 2026-11-01 s/d 2026-11-19 dibuat baru. Isian '1 - 19 November
--      2026' tidak sama dengan periode mingguan (Jumat-Kamis) mana pun.
--   2. Nama lokasi tidak baku dipetakan ke satu nama baku; pos baru dibuat
--      bila belum ada.
--   3. Baris Excel 2 ('Aceh Tamiang/24476') -> Huntara Kampung Empat
--      (kode pos sama: 24476).
--   4. Baris Excel 19 ('Kab.Pidie Jaya') -> pos baru
--      'Kantor Dinsos PPPA Kab. Pidie Jaya' (nama dari landing page).
--   5. Aktivitas yang bentrok digabung: nama kegiatan digabung, peserta
--      dijumlahkan. Pandan: baris 11 ('Senam Pagi Lansia', 27 orang) DIBUANG
--      karena sudah tercakup baris 12 ('Pelatihan PHBS dan Senam Pagi Lansia',
--      2 kegiatan, 87 orang) — bukan dijumlahkan menjadi 114.
--   6. Publikasi tidak digabung: satu baris = satu laporan.
--   7. '-' / '0' / 'nihil' / '"-"' -> NULL, bukan default yang menguntungkan.
--   8. 'Ada Dokumentasi' bukan tautan -> link_dokumentasi NULL.
--   9. Link publikasi bukan https -> baris DILEWATI (kolom wajib https);
--      dicatat pada ringkasan generator, bukan disimpan sebagai tautan palsu.
--  10. SIMFONI per kasus TIDAK diimpor: form tidak lagi memakainya dan kedua
--      baris di Excel memang tidak lengkap. SIMFONI agregat pada rekap
--      pengaduan tetap diimpor.
--  11. status = 'terkirim', sumber_input = 'google_form', submitted_at = waktu
--      pengisian Google Form, verified_by NULL (data impor, bukan verifikasi).
--
-- SIFAT: idempoten. Id laporan dan rincian DITENTUKAN (uuid5), jadi menjalankan
-- ulang tidak menggandakan apa pun. Pos dan periode memakai ON CONFLICT.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. PRASYARAT — berhenti sebelum menulis apa pun.
-- -----------------------------------------------------------------------------
do $$
declare
  v integer;
begin
  select count(*) into v from wilayah;
  if v = 0 then
    raise exception 'Tabel wilayah kosong. Jalankan supabase/seed.sql lebih dulu.';
  end if;

  select count(*) into v from pg_constraint
  where conrelid = 'laporan_kasus'::regclass
    and conname in ('kasus_simfoni_lengkap', 'kasus_belum_simfoni_alasan');
  if v > 0 then
    raise exception 'Migrasi 20261127000001_hapus_simfoni_dari_kasus.sql belum dijalankan: % constraint SIMFONI masih aktif', v;
  end if;

  select count(*) into v from pg_constraint
  where conrelid = 'laporan'::regclass
    and conname = 'laporan_pos_id_periode_id_jenis_laporan_key';
  if v > 0 then
    raise exception 'Migrasi 20261127000004_publikasi_banyak.sql belum dijalankan: unique (pos_id, periode_id, jenis_laporan) masih berlaku untuk publikasi';
  end if;

  -- Kolom rincian yang dipakai skrip ini wajib ada. Tanpa pemeriksaan ini,
  -- kegagalannya muncul sebagai 'column does not exist' di tengah impor,
  -- setelah sebagian baris sudah tersimpan.
  -- `hamil` sengaja TIDAK masuk daftar ini: namanya bisa 'hamil' atau
  -- 'hamil_menyusui' tergantung migrasi pemisahan; diperiksa terpisah.
  select count(*) into v
  from (values
    ('laporan_anak', 'jumlah_kegiatan'),
    ('laporan_anak', 'kegiatan'),
    ('laporan_anak', 'nama_kegiatan'),
    ('laporan_anak', 'jenis_kegiatan'),
    ('laporan_anak', 'usia_0_5'),
    ('laporan_anak', 'usia_6_12'),
    ('laporan_anak', 'usia_13_17'),
    ('laporan_anak', 'laki_laki'),
    ('laporan_anak', 'perempuan'),
    ('laporan_anak', 'disabilitas'),
    ('laporan_anak', 'perlu_layanan_lanjutan'),
    ('laporan_anak', 'temuan'),
    ('laporan_anak', 'tindak_lanjut'),
    ('laporan_anak', 'hambatan'),
    ('laporan_perempuan', 'jumlah_kegiatan'),
    ('laporan_perempuan', 'kegiatan'),
    ('laporan_perempuan', 'nama_kegiatan'),
    ('laporan_perempuan', 'jenis_kegiatan'),
    ('laporan_perempuan', 'total_ikut'),
    ('laporan_perempuan', 'kepala_keluarga'),
    ('laporan_perempuan', 'lansia'),
    ('laporan_perempuan', 'disabilitas'),
    ('laporan_perempuan', 'manfaat'),
    ('laporan_perempuan', 'hambatan'),
    ('laporan_rekap_pengaduan', 'status_bulan'),
    ('laporan_rekap_pengaduan', 'aduan_masuk'),
    ('laporan_rekap_pengaduan', 'kekerasan_perempuan'),
    ('laporan_rekap_pengaduan', 'kekerasan_anak'),
    ('laporan_rekap_pengaduan', 'non_kekerasan_perempuan'),
    ('laporan_rekap_pengaduan', 'non_kekerasan_anak'),
    ('laporan_rekap_pengaduan', 'sudah_ditindaklanjuti'),
    ('laporan_rekap_pengaduan', 'tercatat_simfoni'),
    ('laporan_rekap_pengaduan', 'tindak_lanjut_umum'),
    ('laporan_rekap_pengaduan', 'pihak_terlibat'),
    ('laporan_kasus', 'kode_kasus'),
    ('laporan_kasus', 'tanggal_aduan'),
    ('laporan_kasus', 'kategori'),
    ('laporan_kasus', 'jenis_kasus'),
    ('laporan_kasus', 'jumlah_korban'),
    ('laporan_kasus', 'jenis_kelamin'),
    ('laporan_kasus', 'kelompok_usia'),
    ('laporan_kasus', 'disabilitas'),
    ('laporan_kasus', 'kebutuhan_korban'),
    ('laporan_kasus', 'tindak_lanjut'),
    ('laporan_kasus', 'status_penanganan'),
    ('laporan_kasus', 'hambatan'),
    ('laporan_publikasi', 'tanggal_publikasi'),
    ('laporan_publikasi', 'kegiatan'),
    ('laporan_publikasi', 'platform'),
    ('laporan_publikasi', 'nama_akun'),
    ('laporan_publikasi', 'link_publikasi'),
    ('laporan_publikasi', 'file_publikasi')
  ) as c(tabel, kolom)
  where not exists (
    select 1 from information_schema.columns ic
    where ic.table_schema = 'public'
      and ic.table_name = c.tabel
      and ic.column_name = c.kolom
  );
  if v > 0 then
    raise exception 'Ada % kolom rincian yang belum ada. Jalankan migrasi terbaru di supabase/migrations.', v;
  end if;

  -- Kolom peserta hamil: 'hamil' (setelah pemisahan) ATAU 'hamil_menyusui'
  -- (sebelumnya). Salah satu wajib ada; keduanya ditangani bagian 5.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'laporan_perempuan'
      and column_name in ('hamil', 'hamil_menyusui')
  ) then
    raise exception 'Kolom hamil/hamil_menyusui tidak ada di laporan_perempuan';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Periode 2026-11-01 s/d 2026-11-19.
-- -----------------------------------------------------------------------------
insert into periode (tanggal_mulai, tanggal_selesai)
values ('2026-11-01', '2026-11-19')
on conflict (tanggal_mulai, tanggal_selesai) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Pos SAPA. Pos yang sudah ada dipakai ulang apa adanya.
-- -----------------------------------------------------------------------------
create temporary table _pos (kab_kota text, nama_lokasi text, kode_pos text,
                            jenis_hunian text) on commit drop;
insert into _pos (kab_kota, nama_lokasi, kode_pos, jenis_hunian) values
  ('Aceh Tamiang', 'Huntara 1', null, 'huntara'),
  ('Aceh Tamiang', 'Huntara Desa Upah', null, 'huntara'),
  ('Aceh Tamiang', 'Huntara Kampung Empat', '24476', 'huntara'),
  ('Aceh Tamiang', 'Huntara Simpang Empat', null, 'huntara'),
  ('Aceh Timur', 'Desa Grong-Grong Kec. Pante Bidari', '24463', null),
  ('Bener Meriah', 'Huntara Tunyang', null, 'huntara'),
  ('Kota Padang', 'Huntara Lubuk Buaya', '25173', 'huntara'),
  ('Langkat', 'RPTRA Gebang', null, null),
  ('Pidie Jaya', 'Kantor Dinsos PPPA Kab. Pidie Jaya', null, 'dinas_pppa'),
  ('Solok', 'Nagari Paninggahan', null, null),
  ('Tanah Datar', 'Jorong Ladang Laweh, Nagari Rambatan', null, null),
  ('Tapanuli Tengah', 'Huntara Rusunawa Pandan', '22611', 'huntara'),
  ('Tapanuli Utara', 'Huntap Dolok Nauli', '22461', 'huntap');

insert into pos_sapa (wilayah_id, nama_lokasi, kode_pos, jenis_hunian)
select w.id, d.nama_lokasi, d.kode_pos, d.jenis_hunian
from _pos d
join wilayah w on w.kab_kota = d.kab_kota
on conflict (wilayah_id, nama_lokasi) do nothing;

do $$
declare
  v integer;
begin
  select count(*) into v
  from _pos d
  join wilayah w on w.kab_kota = d.kab_kota
  join pos_sapa p on p.wilayah_id = w.id and p.nama_lokasi = d.nama_lokasi;
  if v <> 13 then
    raise exception 'Pos siap % dari 13. Periksa nama kab/kota terhadap tabel wilayah.', v;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Staging: satu baris = satu laporan impor.
-- -----------------------------------------------------------------------------
create temporary table _impor (
  urut         integer primary key,
  id_laporan   uuid not null,
  id_rincian   uuid not null,
  kab_kota     text not null,
  nama_lokasi  text not null,
  jenis        jenis_laporan_t not null,
  baris_excel  text not null,
  submitted_at timestamptz not null,
  link_dok     text,
  detail       jsonb not null
) on commit drop;

insert into _impor (urut, id_laporan, id_rincian, kab_kota, nama_lokasi, jenis,
                    baris_excel, submitted_at, link_dok, detail) values
  (1, '23873846-ef66-5df8-916b-0ffee8698dff', 'b251249e-c29d-5306-82ed-9e5dfbd851ff', 'Aceh Tamiang', 'Huntara 1', 'aktivitas_perempuan', '29', '2026-11-18T16:45:19.395000'::timestamptz, null, '{"total_ikut": 4, "kepala_keluarga": 2, "hamil": 2, "lansia": 0, "disabilitas": 0, "jumlah_kegiatan": 1, "nama_kegiatan": "Konseling PHBS dan edukasi ttng perempuan dan anak", "jenis_kegiatan": "Ibu menyusui dan perempuan sekitar huntara", "manfaat": "Paham akan edukasi PHBS serta konseling ibu menyusui", "kegiatan": [{"nama": "Konseling PHBS dan edukasi ttng perempuan dan anak", "jenis": "Ibu menyusui dan perempuan sekitar huntara"}]}'::jsonb),
  (2, '1b48181c-77aa-5639-8bd3-2a736ab2efb6', 'd6bbe4f1-ca26-5848-960b-96ffd4a71d51', 'Aceh Tamiang', 'Huntara Desa Upah', 'publikasi', '6', '2026-11-19T11:48:36.794000'::timestamptz, 'https://drive.google.com/open?id=1SXv4Z-drVEEYThiv2KUveSSoR-l8rQt3', '{"tanggal_publikasi": "2026-11-19", "kegiatan": "Layanan Dukungan Psikososial untuk Anak", "platform": "YouTube", "nama_akun": "Flower Aceh", "link_publikasi": "https://youtu.be/9hXF4QbXycg", "file_publikasi": "https://drive.google.com/open?id=1SXv4Z-drVEEYThiv2KUveSSoR-l8rQt3"}'::jsonb),
  (3, 'c1b80d6e-f749-570a-8798-343d6db05a4b', 'c32e337f-8a79-5850-9c50-357fc3020aae', 'Aceh Tamiang', 'Huntara Desa Upah', 'publikasi', '30', '2026-11-19T11:37:11.742000'::timestamptz, 'https://drive.google.com/open?id=1crhYNb8M5JFlh5zqXDXMhGUfrbzH69J9', '{"tanggal_publikasi": "2026-11-18", "kegiatan": "Layanan Dukungan Psikososial untuk anak", "platform": "YouTube", "nama_akun": "Flower Aceh", "link_publikasi": "https://www.youtube.com/watch?v=olXrsAv0lWY", "file_publikasi": "https://drive.google.com/open?id=1crhYNb8M5JFlh5zqXDXMhGUfrbzH69J9"}'::jsonb),
  (4, 'b60a6ae5-24fb-5599-b508-5c1c7c30613a', '4672fd75-77aa-5b32-8933-5e794a6fcbf9', 'Aceh Tamiang', 'Huntara Kampung Empat', 'aktivitas_perempuan', '7', '2026-11-12T10:44:56.483000'::timestamptz, null, '{"total_ikut": 10, "kepala_keluarga": 2, "hamil": 0, "lansia": 3, "disabilitas": 0, "jumlah_kegiatan": 5, "nama_kegiatan": "Perempuan Berdaya", "jenis_kegiatan": "Pelatihan usaha", "manfaat": "Menambah keterampilan diri", "kegiatan": null}'::jsonb),
  (5, '44f7e8e0-18ba-55a0-9fda-efb3345b7752', '9a70f4f8-7512-5407-9a53-f96c63b1c67d', 'Aceh Tamiang', 'Huntara Kampung Empat', 'rekap_pengaduan', '2', '2026-11-12T10:46:29.078000'::timestamptz, null, '{"status_bulan": "Ada aduan", "aduan_masuk": 2, "kekerasan_perempuan": 0, "kekerasan_anak": 1, "non_kekerasan_perempuan": 0, "non_kekerasan_anak": 1, "sudah_ditindaklanjuti": 2, "tercatat_simfoni": 2, "tindak_lanjut_umum": "Sudah ditangani bersama UPTD PPA", "pihak_terlibat": "UPTD PPA"}'::jsonb),
  (6, '03d0c90a-15ee-5b38-b5bb-a64d6036bd04', 'ba7ed2a7-47de-5717-8552-80613e88abcc', 'Aceh Tamiang', 'Huntara Kampung Empat', 'tindak_lanjut_kasus', '8', '2026-11-12T10:48:24.360000'::timestamptz, null, '{"kode_kasus": "ACH-01", "tanggal_aduan": "2026-11-03", "kategori": "kekerasan", "jenis_kasus": "Penelantaran", "jumlah_korban": 1, "jenis_kelamin": "Perempuan", "kelompok_usia": "Anak (0-17 Tahun)", "disabilitas": false, "kebutuhan_korban": "Pendampingan psikologis", "tindak_lanjut": "rujukan UPTD PPA", "status_penanganan": "dirujuk", "hambatan": null}'::jsonb),
  (7, '7b4e43a4-2722-5e7b-bab0-76ac4b080fe8', '904da2c9-b06d-52d9-b5cd-75a40c40787b', 'Aceh Tamiang', 'Huntara Simpang Empat', 'aktivitas_anak', '14, 16', '2026-11-19T10:48:34.798000'::timestamptz, null, '{"usia_0_5": 10, "usia_6_12": 90, "usia_13_17": 0, "laki_laki": 50, "perempuan": 50, "disabilitas": 0, "perlu_layanan_lanjutan": 0, "jumlah_kegiatan": 5, "nama_kegiatan": "1. Screening anak terdampak banjir, 2. Sosialisasi pos sapa dan mengajar ngaji, 3. Identifikasi emosi anak\n\n1. Bermain boardgame ular tangga, 2. Mengaji bersama anak", "jenis_kegiatan": ["Bermain Bersama", "Psikososial", "mengajar ngaji", "Mengaji"], "temuan": null, "tindak_lanjut": null, "kegiatan": null}'::jsonb),
  (8, 'f43acfd2-5d53-5b3d-afc0-37fb4fc23919', 'c3b12414-056c-561c-87af-a73d7df06ca6', 'Aceh Tamiang', 'Huntara Simpang Empat', 'aktivitas_perempuan', '15, 17', '2026-11-19T10:52:15.509000'::timestamptz, null, '{"total_ikut": 9, "kepala_keluarga": 1, "hamil": 0, "lansia": 0, "disabilitas": 0, "jumlah_kegiatan": 2, "nama_kegiatan": "Sosialisasi pos sapa\n\nSosialisasi pengenalan pos sapa dan tempat pelaporan kasus kekerasan", "jenis_kegiatan": "Sosialisasi pos sapa; Sosualisasi pos sapa kepada ibuk ibuk", "manfaat": "Mendapat info terkait keberadaan pos sapa\n\nMembantu Mendeteksi resiko kekerasan atau kerentanan sejak dini, menerima pengaduan", "kegiatan": [{"nama": "Sosialisasi pos sapa", "jenis": "Sosialisasi pos sapa"}, {"nama": "Sosialisasi pengenalan pos sapa dan tempat pelaporan kasus kekerasan", "jenis": "Sosualisasi pos sapa kepada ibuk ibuk"}]}'::jsonb),
  (9, '6dbc9d4e-ee87-54e0-9713-d4840e8a2d7b', 'fc332537-7dd3-55a2-a761-468c9270a3df', 'Aceh Tamiang', 'Huntara Simpang Empat', 'rekap_pengaduan', '31', '2026-11-18T12:52:56.020000'::timestamptz, null, '{"status_bulan": "Ada aduan", "aduan_masuk": 1, "kekerasan_perempuan": 0, "kekerasan_anak": 0, "non_kekerasan_perempuan": 1, "non_kekerasan_anak": 0, "sudah_ditindaklanjuti": 1, "tercatat_simfoni": 0, "tindak_lanjut_umum": "Sudah di rujuk ke dinas ppa kabupaten dan di rujuk ke tim penannganan kasus Flower", "pihak_terlibat": "Dinas ppa, Flower Aceh"}'::jsonb),
  (10, 'ca2c9158-6b52-5531-8d30-66d203bb327c', 'afbfb6a8-278d-5256-a25f-2f7bad6ad270', 'Aceh Timur', 'Desa Grong-Grong Kec. Pante Bidari', 'publikasi', '3', '2026-11-19T15:53:15.711000'::timestamptz, 'https://drive.google.com/open?id=1mWeHFO-J9ABJxjYlNpEb26nCgIGCpbqo', '{"tanggal_publikasi": "2026-10-16", "kegiatan": "Kegiatan Aktivasi Pos SAPA", "platform": "Instagram", "nama_akun": "@dp3akb_atim dan @bidang_ppa_aceh_timur", "link_publikasi": "https://www.instagram.com/p/DeipNKRpfuK/?bqrl=ZmtwMXh1dWNtdW05", "file_publikasi": "https://drive.google.com/open?id=1mWeHFO-J9ABJxjYlNpEb26nCgIGCpbqo"}'::jsonb),
  (11, '5749390d-fd9b-5222-9561-3341a3286b82', '30f9efe1-90d1-59d6-96d7-e5e0c39e1c90', 'Bener Meriah', 'Huntara Tunyang', 'aktivitas_anak', '32', '2026-11-13T14:26:21.123000'::timestamptz, null, '{"usia_0_5": 50, "usia_6_12": 70, "usia_13_17": 80, "laki_laki": 100, "perempuan": 100, "disabilitas": 10, "perlu_layanan_lanjutan": 2, "jumlah_kegiatan": 15, "nama_kegiatan": "1. Pemberian Layanan Dukungan Psikososial pada Anak; 2. Kegiatan Melatih Menari; 3. Kegiatan Pelatihan Futsal Bagi Anak", "jenis_kegiatan": ["Edukasi", "Kegiatan Fisik", "Bermain Bersama"], "temuan": "Anak terlihat menarik diri dan tidak mau beraktivitas dengan teman temannya, anak juga terlihat murung selama proses kegiatan", "tindak_lanjut": "Pos SAPA mengkoordinasikan kepada Dinas P3A/UPTD PPA untuk dilakukan asesmen lebih lanjut terkait kondisi anak", "kegiatan": null}'::jsonb),
  (12, '737431b8-9314-555e-a8fc-a91bad6d60ef', '52d748eb-330f-5316-a1a5-c3dbd6c963bb', 'Kota Padang', 'Huntara Lubuk Buaya', 'aktivitas_anak', '10', '2026-11-20T18:56:48.474000'::timestamptz, null, '{"usia_0_5": 44, "usia_6_12": 63, "usia_13_17": 50, "laki_laki": 71, "perempuan": 99, "disabilitas": 1, "perlu_layanan_lanjutan": 0, "jumlah_kegiatan": 42, "nama_kegiatan": "Pelayanan dan Pembimbingan", "jenis_kegiatan": ["Edukasi", "Trauma Healing", "Kegiatan Fisik", "Bermain Bersama"], "temuan": null, "tindak_lanjut": null, "kegiatan": null}'::jsonb),
  (13, '32360be4-46c9-5958-bc27-b6e5b9f15303', 'a3371f5b-6797-5f34-ad0e-911bbf48f544', 'Langkat', 'RPTRA Gebang', 'aktivitas_anak', '33', '2026-11-19T14:43:13.298000'::timestamptz, null, '{"usia_0_5": 2, "usia_6_12": 30, "usia_13_17": 13, "laki_laki": 10, "perempuan": 35, "disabilitas": 1, "perlu_layanan_lanjutan": 0, "jumlah_kegiatan": 2, "nama_kegiatan": "1. Psikososial dan Edukasi Pencegahan Tindak Kekerasan pada Anak 2. Sosialisasi Pos SAPA dan Edukasi Perilaku Hidup Bersih dan Sehat (PHBS), Dusun 2 Air Hitam", "jenis_kegiatan": ["Edukasi", "Kegiatan Fisik", "Bermain Bersama"], "temuan": null, "tindak_lanjut": null, "kegiatan": null}'::jsonb),
  (14, 'b6df1373-206f-5f4f-805f-3a557842d213', '058b1341-cc31-5733-8659-7d69bafa9c10', 'Langkat', 'RPTRA Gebang', 'publikasi', '36', '2026-11-19T15:30:41.640000'::timestamptz, 'https://drive.google.com/open?id=16goBvFfbkpijU-azbPnBym2-6LUyEAR0', '{"tanggal_publikasi": "2026-10-21", "kegiatan": "Aktivasi Pos SAPA", "platform": "Website Resmi", "nama_akun": "iNews.Medan", "link_publikasi": "https://medan.inews.id/read/724461/tak-perlu-bingung-cari-bantuan-pos-sapa-langkat-sediakan-layanan-terpadu-perempuan-dan-anak", "file_publikasi": "https://drive.google.com/open?id=16goBvFfbkpijU-azbPnBym2-6LUyEAR0"}'::jsonb),
  (15, '4f54ee9b-c4b0-5c03-846a-737eb23fb721', 'bd86d22f-f627-5c58-8a86-2805a1d27f5c', 'Langkat', 'RPTRA Gebang', 'publikasi', '37', '2026-11-19T15:34:17.658000'::timestamptz, 'https://drive.google.com/open?id=13nrw9fy40vVcG791527N51vg5OitqCSl', '{"tanggal_publikasi": "2026-10-21", "kegiatan": "Aktivasi Pos SAPA", "platform": "Website Resmi", "nama_akun": "DetikPos.id", "link_publikasi": "https://detikpos.id/nasional/pos-sapa-hadir-di-langkat-perkuat-perlindungan-perempuan-dan-anak-pascabencana", "file_publikasi": "https://drive.google.com/open?id=13nrw9fy40vVcG791527N51vg5OitqCSl"}'::jsonb),
  (16, 'de71406b-e5f5-5ad3-823f-ff332dffca50', '1919c012-19ce-5621-8c43-c08196dfdc43', 'Langkat', 'RPTRA Gebang', 'publikasi', '38', '2026-11-19T15:37:28.392000'::timestamptz, 'https://drive.google.com/open?id=1c37n-6fbmHNp6ZT3tZeZp7C4bxTwu-JW', '{"tanggal_publikasi": "2026-10-22", "kegiatan": "Aktivasi Pos SAPA", "platform": "Website Resmi", "nama_akun": "Mimbar Umum", "link_publikasi": "https://mimbarumum.co.id/kemenpppa-dan-yafsi-aktifkan-pos-sapa-di-langkat-untuk-lindungi-perempuan-dan-anak-pascabencana/#google_vignette", "file_publikasi": "https://drive.google.com/open?id=1c37n-6fbmHNp6ZT3tZeZp7C4bxTwu-JW"}'::jsonb),
  (17, '6965f179-9a95-518b-98db-44d72743d33d', '1d776e76-4b97-55fb-a211-7bc696612a03', 'Langkat', 'RPTRA Gebang', 'publikasi', '39', '2026-11-19T15:39:53.374000'::timestamptz, 'https://drive.google.com/open?id=11ClMYJLRBhcFVeM7nrkue5AcIKHsprDv', '{"tanggal_publikasi": "2026-10-22", "kegiatan": "Aktivasi Pos SAPA", "platform": "Website Resmi", "nama_akun": "KitaKini News", "link_publikasi": "https://www.kitakininews.co.id/news/29622/kemenpppa-dan-yafsi-hadirkan-pos-sapa-di-langkat-untuk-perlindungan-pascabencana", "file_publikasi": "https://drive.google.com/open?id=11ClMYJLRBhcFVeM7nrkue5AcIKHsprDv"}'::jsonb),
  (18, '6a4dc75a-9007-5fdf-887c-db8b21370431', '7d6ec94e-16ca-5795-b883-6f08c5079efa', 'Langkat', 'RPTRA Gebang', 'publikasi', '40', '2026-11-19T15:42:49.804000'::timestamptz, 'https://drive.google.com/open?id=1QzeareVrIvzVKBL2c3lTQzU3ZQBN9s1O', '{"tanggal_publikasi": "2026-10-23", "kegiatan": "Aktivasi dan Operasionalisasi Pos SAPA", "platform": "Website Resmi", "nama_akun": "Detik Pos", "link_publikasi": "https://detikpos.id/nasional/kemen-pppa-perkuat-layanan-perlindungan-perempuan-dan-anak-pascabencana-di-langkat", "file_publikasi": "https://drive.google.com/open?id=1QzeareVrIvzVKBL2c3lTQzU3ZQBN9s1O"}'::jsonb),
  (19, '5bec79f7-d8e5-5d4e-99b6-c76e61285e77', '8b6aad5d-bef5-5c78-94e1-1fbadf912486', 'Langkat', 'RPTRA Gebang', 'publikasi', '41', '2026-11-19T15:45:28.896000'::timestamptz, 'https://drive.google.com/open?id=1fd2TXb_MnJVxF_ZTrxNNOobbivhehfQ2', '{"tanggal_publikasi": "2026-11-09", "kegiatan": "Psikososial dan Edukasi", "platform": "Website Resmi", "nama_akun": "iNews", "link_publikasi": "https://medan.inews.id/read/728880/ceriakan-tangkahan-durian-pos-sapa-dan-yafsi-ajari-anak-cara-lindungi-diri-dari-bahaya", "file_publikasi": "https://drive.google.com/open?id=1fd2TXb_MnJVxF_ZTrxNNOobbivhehfQ2"}'::jsonb),
  (20, 'f644e96a-a15c-5a33-85e7-c3df5584c47b', '0f078316-f74b-5ee7-8900-33bee5610f26', 'Langkat', 'RPTRA Gebang', 'publikasi', '42', '2026-11-19T15:48:08.902000'::timestamptz, 'https://drive.google.com/open?id=1JbULRevXqhbpjw62mHMoz-4gL6p4LOPK', '{"tanggal_publikasi": "2026-11-09", "kegiatan": "Psikososial da Edukasi", "platform": "Website Resmi", "nama_akun": "KitaKini News", "link_publikasi": "https://www.kitakininews.co.id/news/29956/gandeng-yafsi-pos-sapa-langkat-gelar-edukasi-perlindungan-anak-di-tangkahan-durian", "file_publikasi": "https://drive.google.com/open?id=1JbULRevXqhbpjw62mHMoz-4gL6p4LOPK"}'::jsonb),
  (21, 'cdd6fb85-9459-515f-b959-a7c93707b134', '30a5194c-e418-5658-90be-c8c0e2e3e380', 'Langkat', 'RPTRA Gebang', 'publikasi', '43', '2026-11-19T15:50:38.928000'::timestamptz, 'https://drive.google.com/open?id=1y8RvBQHLfMDfsoJ3s9DMLqpfgmAmBx4a', '{"tanggal_publikasi": "2026-11-08", "kegiatan": "Psikososial dan Edukasi", "platform": "Website Resmi", "nama_akun": "DetikPos", "link_publikasi": "https://detikpos.id/nasional/pos-sapa-langkat-bersama-yafsi-gelar-psikososial-dan-edukasi-perlindungan-anak-di-tangkahan-durian", "file_publikasi": "https://drive.google.com/open?id=1y8RvBQHLfMDfsoJ3s9DMLqpfgmAmBx4a"}'::jsonb),
  (22, 'f392dc28-660c-5acb-ab55-63ac78421520', 'e7347c24-ee23-56c4-9e5c-2d8809de75db', 'Langkat', 'RPTRA Gebang', 'publikasi', '44', '2026-11-19T15:57:06.676000'::timestamptz, 'https://drive.google.com/open?id=18AIeGtV_6rqU2TffPfqke0ghHiAPURS6', '{"tanggal_publikasi": "2026-11-10", "kegiatan": "Psikososial dan Edukasi", "platform": "Instagram", "nama_akun": "@yafsi", "link_publikasi": "https://www.instagram.com/reel/DfmxKmxzL6z/?utm_source=ig_web_copy_link&knvt=MzRlODBiNWFlZA%3D%3D&avpt=MzRlODBiNWFlZA%3D%3D", "file_publikasi": "https://drive.google.com/open?id=18AIeGtV_6rqU2TffPfqke0ghHiAPURS6"}'::jsonb),
  (23, '137d4fd5-2d43-5569-bf25-67a00efbc9d9', '9f329429-6397-5711-b07e-9c9f2a739871', 'Langkat', 'RPTRA Gebang', 'publikasi', '45', '2026-11-19T16:04:40.853000'::timestamptz, 'https://drive.google.com/open?id=1YZdkesw-pUQ9d1rymr_RGM_eiutRHE17', '{"tanggal_publikasi": "2026-10-28", "kegiatan": "Aktivasi Pos SAPA", "platform": "Instagram", "nama_akun": "@yafsi", "link_publikasi": "https://www.instagram.com/reel/DfmxKmxzL6z/?utm_source=ig_web_copy_link&knvt=MzRlODBiNWFlZA%3D%3D&avpt=MzRlODBiNWFlZA%3D%3D", "file_publikasi": "https://drive.google.com/open?id=1YZdkesw-pUQ9d1rymr_RGM_eiutRHE17"}'::jsonb),
  (24, 'e0925cd1-2dbe-50bd-9165-823e79676b7f', 'ea3577ed-f00e-5e68-9d48-f73f14ad6b8f', 'Langkat', 'RPTRA Gebang', 'publikasi', '46', '2026-11-19T16:12:04.833000'::timestamptz, null, '{"tanggal_publikasi": "2026-10-24", "kegiatan": "Aktivasi Pos SAPA", "platform": "Facebook", "nama_akun": "YAFSI Indonesia", "link_publikasi": "https://www.facebook.com/yafsindonesia/videos/pos-sapa-hadir-di-langkat-memperkuat-perlindungan-perempuan-dan-anak-pascabencan/2236679057198097/?rdid=sYGwMjuZyA9bNzhL", "file_publikasi": null}'::jsonb),
  (25, 'd7dfff70-ac50-54a8-aef7-582f9d0db0b6', '0b49bfc7-cfdb-5c80-bdd5-3dc6a7d11cf6', 'Langkat', 'RPTRA Gebang', 'publikasi', '47', '2026-11-19T16:13:53.034000'::timestamptz, null, '{"tanggal_publikasi": "2026-11-11", "kegiatan": "Psikososial dan Edukasi", "platform": "Facebook", "nama_akun": "YAFSI", "link_publikasi": "https://www.facebook.com/yafsindonesia/videos/yafsi-bersama-pos-sapa-sahabat-perempuan-dan-anak-kabupaten-langkat-menggelar-ps/3569432456563285/?rdid=kbeEv6xHQV7rxTsr", "file_publikasi": null}'::jsonb),
  (26, '7006ba34-5ec9-53a2-b099-028b2723e1d1', '27aa0c16-fb12-523b-b246-d13ec54d3467', 'Langkat', 'RPTRA Gebang', 'rekap_pengaduan', '34', '2026-11-19T14:57:27.876000'::timestamptz, null, '{"status_bulan": "Ada aduan", "aduan_masuk": 3, "kekerasan_perempuan": 1, "kekerasan_anak": 1, "non_kekerasan_perempuan": 0, "non_kekerasan_anak": 1, "sudah_ditindaklanjuti": 3, "tercatat_simfoni": 1, "tindak_lanjut_umum": "Melakukan pendampingan, membuat rujukan", "pihak_terlibat": "UPTD PPA, BNN, Kepolisian, Babinkamtbmas, Babinsa dan Pemerintah Desa"}'::jsonb),
  (27, 'dbc2ede7-d57c-5715-9187-71039f9cf8a7', 'e4504ef4-be66-59c5-9ad9-2f2338e56b37', 'Langkat', 'RPTRA Gebang', 'tindak_lanjut_kasus', '35', '2026-11-19T15:08:58.226000'::timestamptz, null, '{"kode_kasus": "F.01.PS", "tanggal_aduan": "2026-11-06", "kategori": "kekerasan", "jenis_kasus": "Kekerasan Fisik", "jumlah_korban": 2, "jenis_kelamin": "Perempuan", "kelompok_usia": "Dewasa (18+ Tahun)", "disabilitas": false, "kebutuhan_korban": "Pendampingan Psikologis", "tindak_lanjut": "Pendampingan dan Rujukan UPTD PPA", "status_penanganan": "selesai", "hambatan": null}'::jsonb),
  (28, '73f581d0-73dd-57d9-95a8-6ace2537c49b', '614aff17-5826-506c-a476-254782e96fc9', 'Pidie Jaya', 'Kantor Dinsos PPPA Kab. Pidie Jaya', 'aktivitas_perempuan', '19', '2026-11-19T10:03:31.982000'::timestamptz, null, '{"total_ikut": 22, "kepala_keluarga": 0, "hamil": 0, "lansia": 3, "disabilitas": 2, "jumlah_kegiatan": 6, "nama_kegiatan": "Edukasi Terkait Pemenuhan Hak anak dan Perempuan serta Pelayanan Pos SAPA", "jenis_kegiatan": "Edukasi dan Penyuluhan", "manfaat": "Perempuan mengetahui hak nya dan bagaimana ikut berkontribusi dalam pemenuhan hak anak serta perempuan telah mengetahui adanya layanan Pos SAPA", "kegiatan": null}'::jsonb),
  (29, '92d16546-924f-54c8-a302-c5ba736f36f2', '510d10de-db43-5d25-8312-01ffd83e58d5', 'Solok', 'Nagari Paninggahan', 'aktivitas_perempuan', '20, 22, 23, 24, 25, 28', '2026-11-19T11:50:06.702000'::timestamptz, null, '{"total_ikut": 108, "kepala_keluarga": 0, "hamil": 0, "lansia": 2, "disabilitas": 0, "jumlah_kegiatan": 9, "nama_kegiatan": "Sosialisasi pos sapa kepada wakil bupati dan wali nagari paninggahan\n\nSosialisasi dan pengumpulan data perempuan dan anak\n\nEdukasi\n\nEdukasi dan Pendataan\n\nPendataan perempuan dan anak\n\nSosialisasi", "jenis_kegiatan": "Sosialisasi; Edukasi; Pendataanmasyarakat terdampak; Pengenalan Pos SAPA", "manfaat": "Masyarakat mengetahui telah adanya Pos SAPA dan terdatanya data nagari terkait perempuan dan anak\n\nKegiatan yang dilakukan adalah pendataan dan edukasi bagi masyarakat nagari paninggahan sehingga jumlah yang ikut serta adalah masyarakat nagari peninggahan\n\nMasyarakat nagari paninggahan mengenal Pos SAPA", "kegiatan": null}'::jsonb),
  (30, 'c54b48f7-82a3-5814-a9ee-dbb98300da34', '6aba17e5-2033-5b29-85c8-b5799e7a14e9', 'Solok', 'Nagari Paninggahan', 'publikasi', '26', '2026-11-19T11:14:19.999000'::timestamptz, null, '{"tanggal_publikasi": "2026-10-23", "kegiatan": "Koordinasi Pos SAPA bersama sekretaris daerah Kabupaten Solok dan Dinas DP2KBP3A", "platform": "Instagram", "nama_akun": "jemari.sakato", "link_publikasi": "https://www.instagram.com/p/De1nhjeEi2t/?evlk=MThsdmdmYjBpMnB4", "file_publikasi": null}'::jsonb),
  (31, '4b2f66d8-555c-53dc-829c-d94241028d3e', '1e8e0a9d-c28c-5cad-8919-386dca564187', 'Solok', 'Nagari Paninggahan', 'publikasi', '27', '2026-11-19T11:17:09.665000'::timestamptz, null, '{"tanggal_publikasi": "2026-11-09", "kegiatan": "Konsolidasi program, peerumusan mekanisme kerja dan SOP Petugass Pos SAPA", "platform": "Instagram", "nama_akun": "jemari.sakato", "link_publikasi": "https://www.instagram.com/p/DfoPEi-Eqgl/?fqnt=MW5za3F1enNycnB1eQ==", "file_publikasi": null}'::jsonb),
  (32, 'f2125a64-67eb-510a-b1e1-c092487f4efc', 'ee84b9e9-421d-5766-b852-eea13fa12dab', 'Solok', 'Nagari Paninggahan', 'rekap_pengaduan', '21', '2026-11-19T11:22:45.766000'::timestamptz, null, '{"status_bulan": "Nihil", "aduan_masuk": 0, "kekerasan_perempuan": 0, "kekerasan_anak": 0, "non_kekerasan_perempuan": 0, "non_kekerasan_anak": 0, "sudah_ditindaklanjuti": 0, "tercatat_simfoni": 0, "tindak_lanjut_umum": null, "pihak_terlibat": null}'::jsonb),
  (33, '1f762634-5cea-5e3f-9370-f25f33c5c34f', '2942c216-9dcf-517a-ae67-f90d7f033c1c', 'Tanah Datar', 'Jorong Ladang Laweh, Nagari Rambatan', 'aktivitas_perempuan', '18', '2026-11-19T11:21:50.632000'::timestamptz, null, '{"total_ikut": 74, "kepala_keluarga": 44, "hamil": 0, "lansia": 33, "disabilitas": 1, "jumlah_kegiatan": 3, "nama_kegiatan": "Dukungan Psikososial Terhadap orang tua ( ibu ) korban Bencana", "jenis_kegiatan": "Sosialisasi ketahan. Keluarga", "manfaat": "Mengetahui tentang ketahan keluarga dan kekerasan bertambah ilmu tentang ketahan keluarga , karakteristik , pola asuh", "kegiatan": null}'::jsonb),
  (34, 'c23d5f5b-aba9-5614-88e8-33cd6800eb0f', 'd996f336-81ed-5799-83ed-e3ba89862e0a', 'Tapanuli Tengah', 'Huntara Rusunawa Pandan', 'aktivitas_anak', '13', '2026-11-18T23:41:36.827000'::timestamptz, null, '{"usia_0_5": 4, "usia_6_12": 25, "usia_13_17": 0, "laki_laki": 19, "perempuan": 10, "disabilitas": 0, "perlu_layanan_lanjutan": 0, "jumlah_kegiatan": 3, "nama_kegiatan": "Layanan Psikososial", "jenis_kegiatan": ["Edukasi", "Trauma Healing", "Bermain Bersama"], "temuan": null, "tindak_lanjut": null, "kegiatan": null}'::jsonb),
  (35, 'e6ff18ee-0d57-5505-8af4-75afeded9cfb', '7a7dc11e-5c58-5d06-8cc1-b181be323d62', 'Tapanuli Tengah', 'Huntara Rusunawa Pandan', 'aktivitas_perempuan', '12', '2026-11-19T00:08:19.849000'::timestamptz, null, '{"total_ikut": 87, "kepala_keluarga": 11, "hamil": 9, "lansia": 50, "disabilitas": 0, "jumlah_kegiatan": 2, "nama_kegiatan": "Pelatihan Penguatan Perilaku Hidup Bersih dan Sehat Pascabencana dan Senam Pagi Lansia", "jenis_kegiatan": "Pelatihan Penguatan PHBS dan Senam pagi bagi Lansia", "manfaat": "Penyintas peserta Pelatihan dan Penguatan Perilaku HIdup bersih dan Sehat Pascabencana menyatakan bahwa mereka merasakan perhatian pemerintah dan lembaga lainnya juga tertuju pada mereka. Mereka merasa senang akan kegiatan pelatihan yang dilaksanakan, selain mengingatkan akan pola hidup bersih dan sehat yang perlu mereka terapkan, para penyintas juga menyatakan bahwa kegiatan yang dibalut dengan suasana ceria mampu membuat mereka melupakan sejenak proses berat yang sedang mereka alami. Senam pagi lansia yang saat ini dijadikan sebagai kegiatan reguler mingguan juga menjadi salah satu aktivitas yang dinanti. Peserta yang sebelumnya berjumlah 27 orang, di minggu kedua telah bertambah menjadi 50 orang.", "kegiatan": null}'::jsonb),
  (36, '5c0ebecf-9484-5cf2-8e20-f209c6a01829', 'c7477517-d61d-5426-a697-2551c094cfa9', 'Tapanuli Utara', 'Huntap Dolok Nauli', 'aktivitas_anak', '5', '2026-11-18T23:52:49.627000'::timestamptz, null, '{"usia_0_5": 2, "usia_6_12": 7, "usia_13_17": 0, "laki_laki": 3, "perempuan": 6, "disabilitas": 0, "perlu_layanan_lanjutan": 0, "jumlah_kegiatan": 1, "nama_kegiatan": "Bermain dan Belajar Membaca", "jenis_kegiatan": ["Edukasi", "Bermain Bersama"], "temuan": null, "tindak_lanjut": null, "kegiatan": [{"nama": "Bermain dan Belajar Membaca", "jenis": ["Edukasi", "Bermain Bersama"]}]}'::jsonb),
  (37, 'd2a4e4b8-a128-5b1e-9377-0d22ced57b64', '783992e8-a748-57f2-999c-7d64b4f6534e', 'Tapanuli Utara', 'Huntap Dolok Nauli', 'aktivitas_perempuan', '4', '2026-11-18T23:50:17.062000'::timestamptz, null, '{"total_ikut": 37, "kepala_keluarga": 15, "hamil": 0, "lansia": 37, "disabilitas": 1, "jumlah_kegiatan": 1, "nama_kegiatan": "Pelatihan Penguatan Perilaku Hidup Bersih dan Sehat Pascabencana", "jenis_kegiatan": "Pelatihan PHBS Pascabencana", "manfaat": "Para peserta pelatihan yang mengikuti kegiatan ini menyatakan bahwa mereka sangat senang akan adanya kegiatan edukasi yang mereka terima. Kegiatan yang berlangsung dalam suasana ceria terbukti mampu meningkatkan atensi, hingga tingkat partisipasi peserta tinggi bahkan menyeluruh. Pada kegiatan yang sama, para peserta menyatakan keinginan mereka agar dibuatkan program reguler berupa senam pagi bagi lansia dan pembuatan kebun pangan keluarga.", "kegiatan": [{"nama": "Pelatihan Penguatan Perilaku Hidup Bersih dan Sehat Pascabencana", "jenis": "Pelatihan PHBS Pascabencana"}]}'::jsonb);

-- -----------------------------------------------------------------------------
-- 4. Laporan induk. ON CONFLICT (id) DO NOTHING -> aman dijalankan ulang.
-- -----------------------------------------------------------------------------
insert into laporan (id, pos_id, periode_id, jenis_laporan, status, sumber_input,
                     link_dokumentasi, submitted_by, submitted_at)
select i.id_laporan, ps.id, pr.id, i.jenis, 'terkirim', 'google_form',
       i.link_dok,
       (select id from pengguna where peran = 'admin_pusat' order by email limit 1),
       i.submitted_at
from _impor i
join wilayah w on w.kab_kota = i.kab_kota
join pos_sapa ps on ps.wilayah_id = w.id and ps.nama_lokasi = i.nama_lokasi
join periode pr on pr.tanggal_mulai = '2026-11-01'
               and pr.tanggal_selesai = '2026-11-19'
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 5. Rincian per jenis. `detail` jsonb di-cast ke tipe kolom masing-masing.
--    FK memakai id_laporan (induk), bukan id_rincian.
-- -----------------------------------------------------------------------------

-- aktivitas_anak -> laporan_anak
insert into laporan_anak (laporan_id, jumlah_kegiatan, kegiatan, nama_kegiatan, jenis_kegiatan, usia_0_5, usia_6_12, usia_13_17, laki_laki, perempuan, disabilitas, perlu_layanan_lanjutan, temuan, tindak_lanjut, hambatan)
select i.id_laporan,
       (i.detail ->> 'jumlah_kegiatan')::integer,
       case when jsonb_typeof(i.detail -> 'kegiatan') = 'array' then i.detail -> 'kegiatan' end,
       (i.detail ->> 'nama_kegiatan'),
       (select coalesce(array_agg(e order by o), '{}'::text[])
          from jsonb_array_elements_text(coalesce(i.detail -> 'jenis_kegiatan', '[]'::jsonb)) with ordinality as t(e, o)),
       (i.detail ->> 'usia_0_5')::integer,
       (i.detail ->> 'usia_6_12')::integer,
       (i.detail ->> 'usia_13_17')::integer,
       (i.detail ->> 'laki_laki')::integer,
       (i.detail ->> 'perempuan')::integer,
       (i.detail ->> 'disabilitas')::integer,
       (i.detail ->> 'perlu_layanan_lanjutan')::integer,
       (i.detail ->> 'temuan'),
       (i.detail ->> 'tindak_lanjut'),
       (i.detail ->> 'hambatan')
from _impor i
where i.jenis = 'aktivitas_anak'
on conflict (laporan_id) do nothing;

-- aktivitas_perempuan -> laporan_perempuan
do $l$
declare
  v_kolom text := case
    when exists (select 1 from information_schema.columns
                 where table_schema = 'public'
                   and table_name   = 'laporan_perempuan'
                   and column_name  = 'hamil') then 'hamil'
    else 'hamil_menyusui'
  end;
begin
  execute format($f$insert into laporan_perempuan (laporan_id, jumlah_kegiatan, kegiatan, nama_kegiatan, jenis_kegiatan, total_ikut, kepala_keluarga, %s, lansia, disabilitas, manfaat, hambatan)
select i.id_laporan,
       (i.detail ->> 'jumlah_kegiatan')::integer,
       case when jsonb_typeof(i.detail -> 'kegiatan') = 'array' then i.detail -> 'kegiatan' end,
       (i.detail ->> 'nama_kegiatan'),
       (i.detail ->> 'jenis_kegiatan'),
       (i.detail ->> 'total_ikut')::integer,
       (i.detail ->> 'kepala_keluarga')::integer,
       (i.detail ->> 'hamil')::integer,
       (i.detail ->> 'lansia')::integer,
       (i.detail ->> 'disabilitas')::integer,
       (i.detail ->> 'manfaat'),
       (i.detail ->> 'hambatan')
from _impor i
where i.jenis = 'aktivitas_perempuan'
on conflict (laporan_id) do nothing$f$, v_kolom);
end $l$;

-- rekap_pengaduan -> laporan_rekap_pengaduan
insert into laporan_rekap_pengaduan (laporan_id, status_bulan, aduan_masuk, kekerasan_perempuan, kekerasan_anak, non_kekerasan_perempuan, non_kekerasan_anak, sudah_ditindaklanjuti, tercatat_simfoni, tindak_lanjut_umum, pihak_terlibat)
select i.id_laporan,
       (i.detail ->> 'status_bulan'),
       (i.detail ->> 'aduan_masuk')::integer,
       (i.detail ->> 'kekerasan_perempuan')::integer,
       (i.detail ->> 'kekerasan_anak')::integer,
       (i.detail ->> 'non_kekerasan_perempuan')::integer,
       (i.detail ->> 'non_kekerasan_anak')::integer,
       (i.detail ->> 'sudah_ditindaklanjuti')::integer,
       (i.detail ->> 'tercatat_simfoni')::integer,
       (i.detail ->> 'tindak_lanjut_umum'),
       (i.detail ->> 'pihak_terlibat')
from _impor i
where i.jenis = 'rekap_pengaduan'
on conflict (laporan_id) do nothing;

-- tindak_lanjut_kasus -> laporan_kasus
insert into laporan_kasus (laporan_id, kode_kasus, tanggal_aduan, kategori, jenis_kasus, jumlah_korban, jenis_kelamin, kelompok_usia, disabilitas, kebutuhan_korban, tindak_lanjut, status_penanganan, hambatan)
select i.id_laporan,
       (i.detail ->> 'kode_kasus'),
       (i.detail ->> 'tanggal_aduan')::date,
       (i.detail ->> 'kategori')::kategori_kasus_t,
       (i.detail ->> 'jenis_kasus'),
       (i.detail ->> 'jumlah_korban')::integer,
       (i.detail ->> 'jenis_kelamin'),
       (i.detail ->> 'kelompok_usia'),
       (i.detail ->> 'disabilitas')::boolean,
       (i.detail ->> 'kebutuhan_korban'),
       (i.detail ->> 'tindak_lanjut'),
       (i.detail ->> 'status_penanganan')::status_penanganan_t,
       (i.detail ->> 'hambatan')
from _impor i
where i.jenis = 'tindak_lanjut_kasus'
on conflict (laporan_id) do nothing;

-- publikasi -> laporan_publikasi
insert into laporan_publikasi (laporan_id, tanggal_publikasi, kegiatan, platform, nama_akun, link_publikasi, file_publikasi)
select i.id_laporan,
       (i.detail ->> 'tanggal_publikasi')::date,
       (i.detail ->> 'kegiatan'),
       (i.detail ->> 'platform'),
       (i.detail ->> 'nama_akun'),
       (i.detail ->> 'link_publikasi'),
       (i.detail ->> 'file_publikasi')
from _impor i
where i.jenis = 'publikasi'
on conflict (laporan_id) do nothing;

-- -----------------------------------------------------------------------------
-- 5b. VERIFIKASI — gagal keras bila hasilnya tidak sesuai harapan.
-- -----------------------------------------------------------------------------
do $$
declare
  v_induk   integer;
  v_rincian integer;
begin
  select count(*) into v_induk from laporan
  where id in (select id_laporan from _impor);
  if v_induk <> 37 then
    raise exception 'Laporan impor % (seharusnya 37)', v_induk;
  end if;

  select count(*) into v_rincian from _impor i
  where exists (select 1 from laporan_anak a where a.laporan_id = i.id_laporan)
     or exists (select 1 from laporan_perempuan x where x.laporan_id = i.id_laporan)
     or exists (select 1 from laporan_rekap_pengaduan r where r.laporan_id = i.id_laporan)
     or exists (select 1 from laporan_kasus k where k.laporan_id = i.id_laporan)
     or exists (select 1 from laporan_publikasi b where b.laporan_id = i.id_laporan);
  if v_rincian <> 37 then
    raise exception 'Rincian impor % (seharusnya 37)', v_rincian;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 6. Ringkasan per lokasi dan jenis.
-- -----------------------------------------------------------------------------
select w.kab_kota, p.nama_lokasi, l.jenis_laporan,
       count(*) as jumlah,
       count(*) filter (where l.link_dokumentasi is not null) as ada_tautan_dok
from laporan l
join periode pr on pr.id = l.periode_id
join pos_sapa p on p.id = l.pos_id
join wilayah w on w.id = p.wilayah_id
where l.id in (select id_laporan from _impor)
group by w.kab_kota, p.nama_lokasi, l.jenis_laporan
order by w.kab_kota, p.nama_lokasi, l.jenis_laporan;

-- -----------------------------------------------------------------------------
-- 7. Anomali hasil impor. Hanya DIBACA — PRD §6.4: laporkan, jangan ganti.
--    Yang diharapkan: 1 distribusi_usia (Huntara Lubuk Buaya, data asli
--    157 vs 170). Bila kode lain muncul, periksa sebelum commit.
-- -----------------------------------------------------------------------------
select a.kab_kota, a.nama_lokasi, a.kode, a.tingkat, a.keterangan
from anomali_laporan a
where a.laporan_id in (select id_laporan from _impor)
order by a.kab_kota, a.nama_lokasi, a.kode;

commit;
