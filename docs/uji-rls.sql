-- =============================================================================
-- Uji Row Level Security per peran
-- Jalankan di Supabase SQL Editor setelah ada data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Lihat pengguna yang ada
-- -----------------------------------------------------------------------------
select u.email, p.nama, p.peran, p.pos_id, p.wilayah_id, p.aktif
from auth.users u
left join pengguna p on p.id = u.id
order by p.peran, u.email;

-- -----------------------------------------------------------------------------
-- 2. Siapkan akun uji
--    Buat dulu akun di Authentication → Users → Add user,
--    lalu lengkapi profilnya di bawah. Ganti <uuid> dengan id dari auth.users.
-- -----------------------------------------------------------------------------

-- Petugas: WAJIB punya pos_id
-- insert into pengguna (id, nama, email, peran, pos_id)
-- values ('<uuid>', 'Petugas Uji', 'petugas@uji.local', 'petugas',
--         (select id from pos_sapa order by nama_lokasi limit 1));

-- Admin Kab/Kota: WAJIB punya wilayah_id
-- insert into pengguna (id, nama, email, peran, wilayah_id)
-- values ('<uuid>', 'Admin Kab Uji', 'adminkab@uji.local', 'admin_kabkota',
--         (select id from wilayah where kab_kota = 'Aceh Tamiang'));

-- Pimpinan: tanpa pos/wilayah
-- insert into pengguna (id, nama, email, peran)
-- values ('<uuid>', 'Pimpinan Uji', 'pimpinan@uji.local', 'pimpinan');

-- -----------------------------------------------------------------------------
-- 3. Uji sebagai petugas
--    Ekspektasi: jumlah laporan hanya untuk pos miliknya.
-- -----------------------------------------------------------------------------
-- set local role authenticated;
-- set local request.jwt.claims = '{"sub":"<uuid-petugas>","role":"authenticated"}';
-- select count(*) as terlihat_dari_petugas from laporan;
-- select count(*) as total_semua from laporan;      -- akan sama; bandingkan manual
-- reset role;

-- -----------------------------------------------------------------------------
-- 4. Uji sebagai pimpinan
--    Ekspektasi: boleh baca semua laporan dan detail kasus,
--    tetapi INSERT/UPDATE harus ditolak.
-- -----------------------------------------------------------------------------
-- set local role authenticated;
-- set local request.jwt.claims = '{"sub":"<uuid-pimpinan>","role":"authenticated"}';
-- select count(*) as terlihat_dari_pimpinan from laporan;
-- select count(*) as kasus_terlihat from laporan_kasus;
-- -- ini HARUS gagal:
-- update laporan_kasus set hambatan = 'x';
-- reset role;

-- -----------------------------------------------------------------------------
-- 5. Uji sebagai anon (publik)
--    Ekspektasi: tabel mentah tidak terbaca, view agregat terbaca.
-- -----------------------------------------------------------------------------
-- set local role anon;
-- select count(*) from laporan;          -- HARUS error / 0 karena RLS
-- select * from publik_ringkasan;        -- HARUS berhasil
-- reset role;

-- -----------------------------------------------------------------------------
-- 6. Verifikasi cepat bahwa semua tabel ber-RLS
-- -----------------------------------------------------------------------------
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
