-- =============================================================================
-- Data master lokasi Pos SAPA
-- Diisi manual sesuai keputusan PRD §15 (lokasi + koordinat diinput manual).
--
-- CARA PAKAI:
--   1. Ganti nama lokasi pada VALUES di bawah dengan daftar 18 lokasi resmi.
--   2. Koordinat boleh NULL dulu (diisi pada Fase 3 saat peta dibangun).
--   3. Jalankan di Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Lihat pos yang sudah ada (hasil migrasi otomatis)
-- -----------------------------------------------------------------------------
select p.id, p.nama_lokasi, w.provinsi, w.kab_kota,
       (select count(*) from laporan l where l.pos_id = p.id) as jumlah_laporan
from pos_sapa p
join wilayah w on w.id = p.wilayah_id
order by w.provinsi, w.kab_kota, p.nama_lokasi;

-- -----------------------------------------------------------------------------
-- Tambah lokasi. Sesuaikan nama kab/kota agar cocok dengan data master.
-- kolom jenis_hunian: 'huntap' | 'huntara' | NULL
-- -----------------------------------------------------------------------------
-- insert into pos_sapa (wilayah_id, nama_lokasi, kode_pos, jenis_hunian)
-- values
--   ((select id from wilayah where kab_kota = 'Pidie Jaya'),
--    'Pos SAPA Huntara Gampong Meunasah', NULL, 'huntara'),
--   ((select id from wilayah where kab_kota = 'Aceh Timur'),
--    'Pos SAPA Huntap Peureulak', NULL, 'huntap')
-- on conflict (wilayah_id, nama_lokasi) do nothing;

-- -----------------------------------------------------------------------------
-- Isi koordinat (Fase 3). Ambil lat,lng dari Google Maps:
--   klik kanan titik → klik angka koordinat → tersalin ke clipboard.
-- -----------------------------------------------------------------------------
-- update pos_sapa set lat = 3.1234, lng = 97.5678 where nama_lokasi = 'Pos SAPA Huntara Gampong Meunasah';

-- -----------------------------------------------------------------------------
-- Rapikan duplikat hasil migrasi
--   1) cari pos bernama mirip
--   2) pindahkan laporan ke pos yang benar
--   3) hapus pos duplikat
-- -----------------------------------------------------------------------------
-- update laporan set pos_id = '<id-pos-benar>' where pos_id = '<id-pos-duplikat>';
-- delete from pos_sapa where id = '<id-pos-duplikat>';

-- -----------------------------------------------------------------------------
-- Buat periode baru (mis. Desember 2026)
-- -----------------------------------------------------------------------------
-- insert into periode (tanggal_mulai, tanggal_selesai)
-- values ('2026-12-01', '2026-12-31')
-- on conflict (tanggal_mulai, tanggal_selesai) do nothing;

select id, tanggal_mulai, tanggal_selesai, label from periode order by tanggal_mulai desc;
