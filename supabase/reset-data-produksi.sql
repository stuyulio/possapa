-- =============================================================================
-- reset-data-produksi.sql
--
-- Menghapus SELURUH data transaksional dan seluruh lokasi Pos SAPA.
--
-- DIPERTAHANKAN:
--   * akun: auth.users + public.pengguna  (dijaga oleh verifikasi di bagian 5)
--   * wilayah (18 kabupaten/kota)
--   * periode: hanya 6 periode resmi (lihat bagian 3). Dua periode tambahan
--     yang tumpang tindih DIHAPUS.
--
-- DIHAPUS:
--   * laporan + kelima tabel rinciannya
--   * pos_sapa SELURUHNYA — termasuk 4 lokasi non-UJI yang berisi laporan
--     sungguhan (3 impor Google Form, 1 kirim lewat aplikasi). Keputusan
--     pemilik produk; backup 20261125 sudah memuat keempatnya.
--     -> Admin Pusat menginput ulang lokasi resmi lewat /admin/wilayah
--   * 2 periode tumpang tindih (1-7 Nov dan 8-14 Nov 2026)
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

-- Tabel sementara sengaja TIDAK memakai "on commit drop": bila editor SQL
-- menyisipkan commit, penjaga di bagian 4 kehilangan snapshot-nya justru
-- setelah penghapusan berjalan. Dibersihkan eksplisit agar aman diulang.
drop table if exists _sebelum;
drop table if exists _sesudah;

-- -----------------------------------------------------------------------------
-- 0. Snapshot jumlah baris SEBELUM
-- -----------------------------------------------------------------------------
create temporary table _sebelum (tabel text primary key, n bigint);
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
--    Keputusan pemilik produk: HAPUS SEMUA. Basis data berisi 40 lokasi:
--    36 berkode 'UJI-' dari seed-data-uji.sql, dan 4 lokasi non-UJI yang
--    dibuat manual pada 18-23 Nov 2026 dan memuat laporan sungguhan
--    (3 impor Google Form, 1 dikirim lewat aplikasi). Keempatnya ikut terhapus
--    — keputusan sadar pemilik produk, dan backup 20261125 sudah memuatnya.
--    -> Admin Pusat menginput ulang lokasi resmi lewat /admin/wilayah
--
--    RESTRICT pada laporan.pos_id aman di sini karena laporan sudah kosong
--    pada langkah 1.
--
--    Efek samping: pengguna.pos_id -> pos_sapa ON DELETE SET NULL, sehingga
--    kolom itu disetel NULL. Kolom tersebut memang sudah NULL untuk semua
--    baris sejak migrasi 20261118000003_petugas_wilayah.sql, jadi tidak ada
--    data akun yang hilang — dan penjaga di langkah 5 hanya membatalkan
--    penghapusan baris pengguna, bukan pembaruannya.
-- -----------------------------------------------------------------------------
delete from pos_sapa;

-- -----------------------------------------------------------------------------
-- 3. periode TUMPANG TINDIH
--    Basis data berisi 8 periode, bukan 6: selain 6 periode resmi dari
--    seed-periode.sql (10-23, 10-30, 11-06, 11-13, 11-20, 11-27 Nov 2026),
--    ada dua periode tambahan yang rentangnya beririsan:
--        '2026-11-01' s/d '2026-11-07'   (beririsan dengan 11-06 s/d 11-12)
--        '2026-11-08' s/d '2026-11-14'   (beririsan dengan 11-13 s/d 11-19)
--    Akibatnya petugas melihat DUA sel periode untuk minggu yang sama di
--    /laporan-saya. Dihapus di sini agar tinggal 6 periode resmi.
--
--    Disasar lewat rentang tanggal, bukan id, supaya idempoten dan tidak
--    bergantung pada uuid tertentu. UNIQUE(tanggal_mulai, tanggal_selesai)
--    menjamin sasaran ini tidak ambigu.
--
--    RESTRICT pada laporan.periode_id aman: laporan sudah kosong di langkah 1.
--    periode tidak punya trigger audit, jadi tidak ada entri baru di audit_log.
-- -----------------------------------------------------------------------------
delete from periode
where (tanggal_mulai, tanggal_selesai) in (
  (date '2026-11-01', date '2026-11-07'),
  (date '2026-11-08', date '2026-11-14')
);

-- -----------------------------------------------------------------------------
-- 4. audit_log TERAKHIR (trigger di atas sudah menulis entri hapus ke sini;
--    entri itu memang dibuang). Lalu ulangi penomoran dari 1.
-- -----------------------------------------------------------------------------
delete from audit_log;
select setval('audit_log_id_seq', 1, false);

-- -----------------------------------------------------------------------------
-- 5. VERIFIKASI — abort (rollback) bila data yang wajib lestari berubah,
--    atau masih ada sisa data transaksional
-- -----------------------------------------------------------------------------
do $$
declare
  v_pengguna_before bigint;
  v_pengguna_after  bigint;
  v_auth_before     bigint;
  v_auth_after      bigint;
  v_wilayah_before  bigint;
  v_wilayah_after   bigint;
  v_periode_after   bigint;
  v_sisa            bigint;
begin
  select n into v_pengguna_before from _sebelum where tabel = 'pengguna';
  select n into v_auth_before     from _sebelum where tabel = 'auth.users';
  select n into v_wilayah_before  from _sebelum where tabel = 'wilayah';
  select count(*) into v_pengguna_after from pengguna;
  select count(*) into v_auth_after     from auth.users;
  select count(*) into v_wilayah_after  from wilayah;
  select count(*) into v_periode_after  from periode;

  if v_pengguna_after <> v_pengguna_before then
    raise exception 'BATAL: jumlah baris pengguna berubah (% -> %)',
      v_pengguna_before, v_pengguna_after;
  end if;
  if v_auth_after <> v_auth_before then
    raise exception 'BATAL: jumlah baris auth.users berubah (% -> %)',
      v_auth_before, v_auth_after;
  end if;
  if v_wilayah_after <> v_wilayah_before then
    raise exception 'BATAL: jumlah baris wilayah berubah (% -> %)',
      v_wilayah_before, v_wilayah_after;
  end if;
  -- periode: jumlahnya MEMANG sengaja berubah (8 -> 6), jadi yang diperiksa
  -- bukan jumlahnya melainkan hasil akhirnya: dua periode tumpang tindih harus
  -- benar-benar hilang, dan keenam periode resmi harus lengkap. Pemeriksaan
  -- atas daftar resmi ini lebih kuat daripada sekadar menghitung jumlah,
  -- karena menghapus periode yang salah tetap akan lolos hitungan jumlah.
  if exists (
    select 1 from periode
    where (tanggal_mulai, tanggal_selesai) in (
      (date '2026-11-01', date '2026-11-07'),
      (date '2026-11-08', date '2026-11-14')
    )
  ) then
    raise exception 'BATAL: periode tumpang tindih masih ada setelah penghapusan';
  end if;

  if v_periode_after <> 6 then
    raise exception 'BATAL: periode resmi tidak genap 6, tersisa %', v_periode_after;
  end if;

  if exists (
    select 1 from (
      values
        (date '2026-10-23', date '2026-10-29'),
        (date '2026-10-30', date '2026-11-05'),
        (date '2026-11-06', date '2026-11-12'),
        (date '2026-11-13', date '2026-11-19'),
        (date '2026-11-20', date '2026-11-26'),
        (date '2026-11-27', date '2026-12-03')
    ) as resmi(mulai, selesai)
    where not exists (
      select 1 from periode p
      where p.tanggal_mulai = resmi.mulai and p.tanggal_selesai = resmi.selesai
    )
  ) then
    raise exception 'BATAL: ada periode resmi yang hilang';
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
-- 6. Laporan SEBELUM/SESUDAH untuk diperiksa operator
-- -----------------------------------------------------------------------------
create temporary table _sesudah (tabel text primary key, n bigint);
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
