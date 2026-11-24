-- =============================================================================
-- Panduan: mengubah akun petugas dari "per pos" menjadi "per kabupaten/kota"
-- Jalankan SETELAH migrasi 20261118000003_petugas_wilayah.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Cek akun petugas yang sudah ada
-- -----------------------------------------------------------------------------
select u.email, p.nama, p.peran,
       p.wilayah_id, w.kab_kota,
       p.pos_id
from pengguna p
join auth.users u on u.id = p.id
left join wilayah w on w.id = p.wilayah_id
where p.peran = 'petugas'
order by u.email;

-- -----------------------------------------------------------------------------
-- 2. Tetapkan wilayah untuk petugas yang belum punya
--    Migrasi otomatis mengisi wilayah_id dari pos_id lama. Bila hasilnya NULL,
--    tetapkan manual di sini.
-- -----------------------------------------------------------------------------
-- update pengguna
-- set wilayah_id = (select id from wilayah where kab_kota = 'Aceh Tamiang')
-- where peran = 'petugas' and email = 'petugas@uji.local';

-- -----------------------------------------------------------------------------
-- 3. Tambah petugas baru untuk kabupaten/kota lain
--    Satu akun per kabupaten/kota. Beri nama akun yang jelas.
-- -----------------------------------------------------------------------------
-- insert into pengguna (id, nama, email, peran, wilayah_id)
-- values (
--   '<uuid-dari-auth-users>',
--   'Petugas Bener Meriah',
--   'petugas.benermeriah@kemenpppa.go.id',
--   'petugas',
--   (select id from wilayah where kab_kota = 'Bener Meriah')
-- );

-- -----------------------------------------------------------------------------
-- 4. Verifikasi: setiap petugas harus punya wilayah_id
--    Query ini HARUS mengembalikan 0 baris.
-- -----------------------------------------------------------------------------
select u.email, p.nama, p.peran
from pengguna p
join auth.users u on u.id = p.id
where p.peran = 'petugas' and p.wilayah_id is null;

-- -----------------------------------------------------------------------------
-- 5. Pastikan setiap wilayah punya tepat satu petugas (opsional)
--    Bila ada wilayah tanpa petugas, laporan tidak akan pernah masuk.
-- -----------------------------------------------------------------------------
select w.provinsi, w.kab_kota,
       count(p.id) as jumlah_petugas
from wilayah w
left join pengguna p
  on p.wilayah_id = w.id and p.peran = 'petugas' and p.aktif = true
group by w.provinsi, w.kab_kota
order by jumlah_petugas, w.provinsi, w.kab_kota;
