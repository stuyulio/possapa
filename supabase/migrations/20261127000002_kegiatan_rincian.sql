-- =============================================================================
-- Rincian kegiatan per laporan (Aktivitas Anak & Aktivitas Perempuan)
-- =============================================================================
--
-- Keputusan pemilik produk (27 Nov 2026): "Jumlah kegiatan" tidak lagi sekadar
-- angka ringkasan. Angka itu menentukan berapa kegiatan yang diisi petugas, dan
-- setiap kegiatan punya nama (dan jenisnya) sendiri.
--
-- DUA HAL YANG SENGAJA TIDAK BERUBAH:
--
-- 1. Penerima manfaat tetap TOTAL PERIODE, bukan per kegiatan. Satu anak yang
--    ikut dua kegiatan hanya dihitung sekali — sama seperti Google Form aslinya,
--    yang hanya punya satu sel "Jumlah Usia Anak 0-5 Tahun" per laporan. Karena
--    itu kolom usia, jenis kelamin, dan kelompok sasaran TIDAK dipecah.
--
-- 2. Baris rincian tetap satu per laporan (`laporan_id` tetap primary key).
--    Rincian kegiatan disimpan sebagai larik JSON, bukan tabel anak baru.
--    Alasannya: semua konsumen — dashboard, ekspor, view `anomali_laporan`,
--    impor Sheets — membaca kolom total yang sudah ada, sehingga tidak perlu
--    diubah dan tidak ada dua sumber kebenaran untuk angka.
--
-- KOLOM LAMA TETAP DIISI sebagai ringkasan oleh aplikasi:
--   * nama_kegiatan   — semua nama kegiatan, dipisah "; "
--   * jenis_kegiatan  — gabungan jenis tanpa duplikat
-- Dengan begitu laporan baru tetap terbaca oleh laporan, ekspor, dan impor
-- yang belum mengenal `kegiatan`, dan NULL pada data lama tidak merusak apa pun.
--
-- IDEMPOTEN. Menjalankan ulang hanya menambahkan 0 kolom; constraint dibuat
-- ulang dengan bentuk yang sama.

-- -----------------------------------------------------------------------------
-- 1. Kolom rincian.
--
--    NULL berarti "belum ada rincian": seluruh laporan sebelum migrasi ini,
--    termasuk baris hasil impor Google Form. Aplikasi membacanya sebagai satu
--    kegiatan dari `nama_kegiatan`/`jenis_kegiatan` (lihat src/lib/kegiatan.ts),
--    jadi tidak ada data lama yang hilang dan tidak perlu backfill.
-- -----------------------------------------------------------------------------
alter table laporan_anak      add column if not exists kegiatan jsonb;
alter table laporan_perempuan add column if not exists kegiatan jsonb;

-- -----------------------------------------------------------------------------
-- 2. Bentuknya harus larik JSON.
--
--    Tanpa constraint ini, objek atau teks bebas bisa tersimpan dan membuat
--    formulir gagal membacanya kembali. Isi tiap unsur sengaja tidak
--    dikunci di sini — bentuk unsur adalah urusan validasi aplikasi (Zod),
--    dan mengunci di dua tempat berarti dua tempat yang harus diubah bersama.
-- -----------------------------------------------------------------------------
alter table laporan_anak      drop constraint if exists anak_kegiatan_larik;
alter table laporan_perempuan drop constraint if exists perempuan_kegiatan_larik;

alter table laporan_anak
  add constraint anak_kegiatan_larik
  check (kegiatan is null or jsonb_typeof(kegiatan) = 'array');

alter table laporan_perempuan
  add constraint perempuan_kegiatan_larik
  check (kegiatan is null or jsonb_typeof(kegiatan) = 'array');

comment on column laporan_anak.kegiatan is
  'Larik kegiatan: [{"nama": "...", "jenis": ["Edukasi", ...]}]. '
  'NULL = laporan sebelum 27 Nov 2026 / impor Google Form; aplikasi '
  'membacanya sebagai satu kegiatan dari kolom nama_kegiatan & jenis_kegiatan. '
  'Penerima manfaat tetap total periode, bukan per kegiatan.';

comment on column laporan_perempuan.kegiatan is
  'Larik kegiatan: [{"nama": "...", "jenis": "..."}]. '
  'NULL = laporan sebelum 27 Nov 2026 / impor Google Form; aplikasi '
  'membacanya sebagai satu kegiatan dari kolom nama_kegiatan & jenis_kegiatan.';

-- -----------------------------------------------------------------------------
-- 3. Periksa hasilnya.
--
--    Dijalankan sebagai blok yang gagal keras: migrasi yang "sukses" tetapi
--    kolomnya tidak ada akan membuat penyimpanan laporan baru ditolak, dan
--    gejalanya baru terlihat saat petugas mengirim laporan.
-- -----------------------------------------------------------------------------
do $$
declare
  v_anak      boolean;
  v_perempuan boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'laporan_anak'
      and column_name = 'kegiatan'
      and data_type = 'jsonb'
  ) into v_anak;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'laporan_perempuan'
      and column_name = 'kegiatan'
      and data_type = 'jsonb'
  ) into v_perempuan;

  if not v_anak or not v_perempuan then
    raise exception 'Kolom kegiatan (jsonb) belum ada di laporan_anak/laporan_perempuan';
  end if;
end $$;
