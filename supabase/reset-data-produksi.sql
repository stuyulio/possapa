-- =============================================================================
-- reset-data-produksi.sql
--
-- Menghapus SELURUH data transaksional dan seluruh lokasi Pos SAPA.
--
-- DIPERTAHANKAN:
--   * akun: auth.users + public.pengguna  (dijaga oleh verifikasi di bagian 4)
--   * wilayah (18 kabupaten/kota)
--   * periode (6 periode mingguan)
--
-- DIHAPUS:
--   * laporan + kelima tabel rinciannya
--   * pos_sapa (termasuk 36 lokasi uji berkode 'UJI-')
--     -> Admin Pusat menginput ulang lokasi resmi lewat /admin/wilayah
--   * audit_log
--
-- CARA PAKAI
--   Supabase Dashboard -> SQL Editor, jalankan sebagai role postgres.
--   Tidak bisa lewat klien JS (anon / service_role): service_role tidak
--   menyentuh schema auth, tidak bisa TRUNCATE, dan tidak bisa membungkus
--   seluruh operasi dalam satu transaksi.
--
-- SIFAT
--   * Idempoten: aman dijalankan berulang.
--   * Satu transaksi: bila verifikasi gagal -> rollback otomatis.
--   * audit_log dibersihkan TERAKHIR, karena trigger catat_audit menyala
--     pada setiap delete di tabel di atasnya dan akan mengisi ulang tabel itu.
--
-- PERINGATAN
--   Tindakan ini tidak dapat dibatalkan. Ambil pg_dump lebih dulu.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Snapshot jumlah baris SEBELUM
-- -----------------------------------------------------------------------------
create temporary table _sebelum (tabel text primary key, n bigint) on commit drop;
insert into _sebelum (tabel, n) values
  ('laporan',                 (select count(*) from laporan)),
  ('laporan_anak',            (select count(*) from laporan_anak)),
  ('laporan_perempuan',       (select count(*) from laporan_perempuan)),
  ('laporan_rekap_pengaduan', (select count(*) from laporan_rekap_pengaduan)),
  ('laporan_kasus',           (select count(*) from laporan_kasus)),
  ('laporan_publikasi',       (select count(*) from laporan_publikasi)),
  ('audit_log',               (select count(*) from audit_log)),
  ('pos_sapa',                (select count(*) from pos_sapa)),
  ('wilayah',                 (select count(*) from wilayah)),
  ('periode',                 (select count(*) from periode)),
  ('pengguna',                (select count(*) from pengguna)),
  ('auth.users',              (select count(*) from auth.users));

-- -----------------------------------------------------------------------------
-- 1. Transaksional: anak dulu, lalu induk.
--    Sebenarnya `delete from laporan` saja cukup (kelima tabel detail
--    ON DELETE CASCADE), tetapi dihapus eksplisit supaya hitungan per tabel
--    bisa diverifikasi operator.
-- -----------------------------------------------------------------------------
delete from laporan_anak;
delete from laporan_perempuan;
delete from laporan_rekap_pengaduan;
delete from laporan_kasus;
delete from laporan_publikasi;
delete from laporan;

-- -----------------------------------------------------------------------------
-- 2. pos_sapa
--    Keputusan pemilik produk: HAPUS SEMUA, termasuk 36 lokasi uji 'UJI-%',
--    lalu Admin Pusat menginput ulang lokasi resmi lewat /admin/wilayah.
--
--    RESTRICT pada laporan.pos_id aman di sini karena laporan sudah kosong
--    pada langkah 1.
--
--    Efek samping: pengguna.pos_id -> pos_sapa ON DELETE SET NULL, sehingga
--    kolom itu disetel NULL. Kolom tersebut memang sudah NULL untuk semua
--    baris sejak migrasi 20261118000003_petugas_wilayah.sql, jadi tidak ada
--    data akun yang hilang — dan penjaga di langkah 4 hanya membatalkan
--    penghapusan baris pengguna, bukan pembaruannya.
-- -----------------------------------------------------------------------------
delete from pos_sapa;

-- -----------------------------------------------------------------------------
-- 3. audit_log TERAKHIR (trigger di atas sudah menulis entri hapus ke sini;
--    entri itu memang dibuang). Lalu ulangi penomoran dari 1.
-- -----------------------------------------------------------------------------
delete from audit_log;
select setval('audit_log_id_seq', 1, false);

-- -----------------------------------------------------------------------------
-- 4. VERIFIKASI — abort (rollback) bila akun berubah atau masih ada sisa data
-- -----------------------------------------------------------------------------
do $$
declare
  v_pengguna_before bigint;
  v_pengguna_after  bigint;
  v_auth_before     bigint;
  v_auth_after      bigint;
  v_sisa            bigint;
begin
  select n into v_pengguna_before from _sebelum where tabel = 'pengguna';
  select n into v_auth_before     from _sebelum where tabel = 'auth.users';
  select count(*) into v_pengguna_after from pengguna;
  select count(*) into v_auth_after     from auth.users;

  if v_pengguna_after <> v_pengguna_before then
    raise exception 'BATAL: jumlah baris pengguna berubah (% -> %)',
      v_pengguna_before, v_pengguna_after;
  end if;
  if v_auth_after <> v_auth_before then
    raise exception 'BATAL: jumlah baris auth.users berubah (% -> %)',
      v_auth_before, v_auth_after;
  end if;

  select count(*) into v_sisa from (
    select 1 from laporan union all
    select 1 from laporan_anak union all
    select 1 from laporan_perempuan union all
    select 1 from laporan_rekap_pengaduan union all
    select 1 from laporan_kasus union all
    select 1 from laporan_publikasi union all
    select 1 from audit_log
  ) t;
  if v_sisa <> 0 then
    raise exception 'BATAL: masih ada % baris transaksional', v_sisa;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Laporan SEBELUM/SESUDAH untuk diperiksa operator
-- -----------------------------------------------------------------------------
create temporary table _sesudah (tabel text primary key, n bigint) on commit drop;
insert into _sesudah (tabel, n) values
  ('laporan',                 (select count(*) from laporan)),
  ('laporan_anak',            (select count(*) from laporan_anak)),
  ('laporan_perempuan',       (select count(*) from laporan_perempuan)),
  ('laporan_rekap_pengaduan', (select count(*) from laporan_rekap_pengaduan)),
  ('laporan_kasus',           (select count(*) from laporan_kasus)),
  ('laporan_publikasi',       (select count(*) from laporan_publikasi)),
  ('audit_log',               (select count(*) from audit_log)),
  ('pos_sapa',                (select count(*) from pos_sapa)),
  ('wilayah',                 (select count(*) from wilayah)),
  ('periode',                 (select count(*) from periode)),
  ('pengguna',                (select count(*) from pengguna)),
  ('auth.users',              (select count(*) from auth.users));

select s.tabel, s.n as sebelum, a.n as sesudah, s.n - a.n as dihapus
from _sebelum s join _sesudah a using (tabel)
order by (s.n - a.n) desc, s.tabel;

commit;
