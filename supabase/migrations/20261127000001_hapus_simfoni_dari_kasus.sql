-- =============================================================================
-- SIMFONI dihapus dari laporan Tindak Lanjut Kasus
-- =============================================================================
--
-- Keputusan pemilik produk (27 Nov 2026): bagian "Pencatatan SIMFONI PPA"
-- tidak lagi diisi oleh petugas. Yang tersisa dari rincian tindak lanjut kasus
-- hanyalah "Hambatan/Kendala penanganan".
--
-- KOLOM TIDAK DIHAPUS. Nilai SIMFONI pada laporan lama tetap tersimpan dan
-- bisa dibaca langsung dari tabel bila suatu saat diperlukan. Yang diubah
-- hanya dua hal: constraint yang MEMAKSA field itu diisi, dan pemeriksaan
-- anomali yang akan menandai setiap laporan baru sebagai tidak lengkap.
--
-- Tanpa migrasi ini, setiap penyimpanan laporan kasus baru DITOLAK database.
-- Kedua constraint lama memakai `not null` pada alasan, bukan `is not null`,
-- sehingga NULL tetap lolos — tetapi aplikasi mengirim string kosong, dan
-- '' ditolak:
--   * kasus_simfoni_lengkap      — tidak jadi penghalang, karena
--                                  sudah_simfoni = false memenuhi syaratnya.
--   * kasus_belum_simfoni_alasan — inilah penghalangnya: menuntut
--                                  alasan_belum_simfoni terisi ketika
--                                  sudah_simfoni = false, sementara form tidak
--                                  lagi mengirim field itu.
--
-- IDEMPOTEN. Menjalankan ulang hanya melepas 0 constraint dan membuat ulang
-- view yang isinya sama.

-- -----------------------------------------------------------------------------
-- 1. Lepas constraint yang mewajibkan isi SIMFONI.
--
--    Dijalankan lebih dulu, sebelum view ditulis ulang: bila langkah 2 gagal,
--    constraint tetap lepas dan form sudah bisa menyimpan. Sebaliknya, bila
--    constraint dibiarkan sampai akhir lalu ada galat di langkah 2, seluruh
--    transaksi batal dan tidak ada yang berubah — aman, tetapi petugas tetap
--    tidak bisa menyimpan. Melepas lebih dulu membuat kegagalan langkah 2
--    hanya menyisakan anomali palsu di antrean, bukan input yang terhenti.
-- -----------------------------------------------------------------------------
alter table laporan_kasus
  drop constraint if exists kasus_simfoni_lengkap;
alter table laporan_kasus
  drop constraint if exists kasus_belum_simfoni_alasan;

-- -----------------------------------------------------------------------------
-- 2. Tulis ulang view anomali tanpa cabang SIMFONI.
--
--    Ditulis ulang utuh, bukan `create or replace` sebagian, dengan alasan
--    yang sama seperti migrasi 20261124000004: definisi yang dapat diperiksa.
--    security_invoker = true WAJIB dipertahankan — tanpa itu setiap pengguna
--    login melihat anomali seluruh Indonesia.
--
--    CATATAN URUTAN: pemisahan kolom `hamil_menyusui` menjadi `hamil` dan
--    `menyusui` masih berstatus usulan (docs/usulan-migrasi-
--    20261126000002_hamil_menyusui_dipisah.sql), belum ada di folder
--    migrations. Bila berkas itu dijalankan belakangan, ia akan membuat ulang
--    view ini TANPA perubahan SIMFONI — membalikkan langkah 2, dan
--    constraint yang sudah dilepas tidak kembali, jadi input tetap jalan,
--    tetapi anomali "Kelengkapan SIMFONI" akan muncul lagi.
--
--    URUTAN YANG BENAR: jalankan usulan pemisahan hamil/menyusui lebih dulu,
--    baru migrasi ini. Cabang A2 di bawah disusun dinamis supaya migrasi ini
--    tidak gagal bila urutannya terbalik, tetapi urutan terbalik berarti
--    langkah 2 harus diulang.
-- -----------------------------------------------------------------------------
do $luar$
declare
  v_subkelompok text;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'laporan_perempuan'
      and column_name  = 'menyusui'
  ) then
    v_subkelompok :=
      'greatest(p.kepala_keluarga, p.hamil, p.menyusui, p.lansia, p.disabilitas)';
  else
    v_subkelompok :=
      'greatest(p.kepala_keluarga, p.hamil_menyusui, p.lansia, p.disabilitas)';
  end if;

execute format($view$
create or replace view anomali_laporan
with (security_invoker = true)
as
with dasar as (
  select
    l.id                as laporan_id,
    l.status,
    l.jenis_laporan,
    l.sumber_input,
    l.catatan_verifikasi,
    l.catatan_buka_kunci,
    l.submitted_at,
    l.updated_at,
    ps.id               as pos_id,
    ps.nama_lokasi,
    ps.wilayah_id,
    w.kab_kota,
    w.provinsi,
    pr.id               as periode_id,
    pr.label            as periode_label
  from laporan l
  join pos_sapa ps on ps.id = l.pos_id
  join periode  pr on pr.id = l.periode_id
  left join wilayah w on w.id = ps.wilayah_id
)
-- A1. Distribusi usia tidak sama dengan jumlah per jenis kelamin.
select
  d.laporan_id, d.pos_id, d.nama_lokasi, d.kab_kota, d.provinsi,
  d.periode_id, d.periode_label, d.jenis_laporan, d.status,
  d.submitted_at, d.catatan_verifikasi, d.catatan_buka_kunci,
  'distribusi_usia'::text as kode,
  'sedang'::text as tingkat,
  'Jumlah per kelompok usia (' || (a.usia_0_5 + a.usia_6_12 + a.usia_13_17)
    || ') tidak sama dengan jumlah per jenis kelamin ('
    || (a.laki_laki + a.perempuan) || ')' as keterangan
from dasar d
join laporan_anak a on a.laporan_id = d.laporan_id
where (a.usia_0_5 + a.usia_6_12 + a.usia_13_17)
   <> (a.laki_laki + a.perempuan)

union all
-- A2. Subkelompok peserta perempuan melebihi total peserta.
select
  d.laporan_id, d.pos_id, d.nama_lokasi, d.kab_kota, d.provinsi,
  d.periode_id, d.periode_label, d.jenis_laporan, d.status,
  d.submitted_at, d.catatan_verifikasi, d.catatan_buka_kunci,
  'subkelompok_perempuan'::text,
  'sedang'::text,
  'Subkelompok terbesar ('
    || %1$s
    || ') melebihi total peserta (' || p.total_ikut || ')'
from dasar d
join laporan_perempuan p on p.laporan_id = d.laporan_id
where p.total_ikut < %1$s

union all
-- A3. Rincian kategori aduan tidak menjumlah sama dengan aduan masuk.
select
  d.laporan_id, d.pos_id, d.nama_lokasi, d.kab_kota, d.provinsi,
  d.periode_id, d.periode_label, d.jenis_laporan, d.status,
  d.submitted_at, d.catatan_verifikasi, d.catatan_buka_kunci,
  'rekap_kategori'::text,
  'sedang'::text,
  'Jumlah kategori ('
    || (r.kekerasan_perempuan + r.kekerasan_anak
        + r.non_kekerasan_perempuan + r.non_kekerasan_anak)
    || ') tidak sama dengan aduan masuk (' || r.aduan_masuk || ')'
from dasar d
join laporan_rekap_pengaduan r on r.laporan_id = d.laporan_id
where r.status_bulan = 'Ada aduan'
  and (r.kekerasan_perempuan + r.kekerasan_anak
       + r.non_kekerasan_perempuan + r.non_kekerasan_anak) <> r.aduan_masuk

union all
-- A4. Status "Nihil" tetapi masih ada hitungan.
select
  d.laporan_id, d.pos_id, d.nama_lokasi, d.kab_kota, d.provinsi,
  d.periode_id, d.periode_label, d.jenis_laporan, d.status,
  d.submitted_at, d.catatan_verifikasi, d.catatan_buka_kunci,
  'rekap_nihil'::text,
  'tinggi'::text,
  'Status Nihil tetapi masih ada hitungan aduan'
from dasar d
join laporan_rekap_pengaduan r on r.laporan_id = d.laporan_id
where r.status_bulan = 'Nihil'
  and (r.aduan_masuk <> 0 or r.sudah_ditindaklanjuti <> 0
       or r.tercatat_simfoni <> 0
       or (r.kekerasan_perempuan + r.kekerasan_anak
           + r.non_kekerasan_perempuan + r.non_kekerasan_anak) <> 0)

union all
-- A5. Laporan non-draf tanpa baris rincian.
--     (Cabang lama A5 "Kelengkapan SIMFONI" sudah dihapus.)
select
  d.laporan_id, d.pos_id, d.nama_lokasi, d.kab_kota, d.provinsi,
  d.periode_id, d.periode_label, d.jenis_laporan, d.status,
  d.submitted_at, d.catatan_verifikasi, d.catatan_buka_kunci,
  'detail_hilang'::text,
  'tinggi'::text,
  'Laporan berstatus ' || d.status || ' tetapi rinciannya tidak ada'
from dasar d
where d.status <> 'draf'
  and not exists (
    select 1 from laporan_anak a            where a.laporan_id = d.laporan_id
    union all
    select 1 from laporan_perempuan p       where p.laporan_id = d.laporan_id
    union all
    select 1 from laporan_rekap_pengaduan r where r.laporan_id = d.laporan_id
    union all
    select 1 from laporan_kasus k           where k.laporan_id = d.laporan_id
    union all
    select 1 from laporan_publikasi b       where b.laporan_id = d.laporan_id
  )
$view$, v_subkelompok);
end $luar$;

comment on view anomali_laporan is
  'Anomali data dihitung saat dibaca (PRD §6.4). Satu baris = satu anomali. '
  'security_invoker = true supaya RLS tabel dasar tetap berlaku. '
  'Tumpang tindih periode TIDAK termasuk — itu aturan master data (§6.4), '
  'diperiksa di /admin/periode. Pencatatan SIMFONI per kasus tidak diperiksa '
  'lagi sejak migrasi 27 Nov 2026: field itu tidak diisi petugas.';

revoke all on anomali_laporan from anon;
grant select on anomali_laporan to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Kolom SIMFONI diberi keterangan "tidak dipakai lagi" tanpa dihapus.
-- -----------------------------------------------------------------------------
comment on column laporan_kasus.sudah_simfoni is
  'Tidak dipakai sejak 27 Nov 2026 — form tidak lagi mengirim nilai ini. '
  'Nilai lama dibiarkan untuk arsip.';
comment on column laporan_kasus.no_registrasi_simfoni is
  'Tidak dipakai sejak 27 Nov 2026 — nilai lama dibiarkan untuk arsip.';
comment on column laporan_kasus.tanggal_input_simfoni is
  'Tidak dipakai sejak 27 Nov 2026 — nilai lama dibiarkan untuk arsip.';
comment on column laporan_kasus.penginput_simfoni is
  'Tidak dipakai sejak 27 Nov 2026 — nilai lama dibiarkan untuk arsip.';
comment on column laporan_kasus.alasan_belum_simfoni is
  'Tidak dipakai sejak 27 Nov 2026 — nilai lama dibiarkan untuk arsip.';

-- =============================================================================
-- VERIFIKASI
-- =============================================================================

do $$
declare
  v_def    text;
  v_jumlah integer;
  v_baseline integer;
begin
  -- Constraint lama harus benar-benar hilang.
  select count(*) into v_jumlah
  from pg_constraint
  where conrelid = 'laporan_kasus'::regclass
    and conname in ('kasus_simfoni_lengkap', 'kasus_belum_simfoni_alasan');
  if v_jumlah <> 0 then
    raise exception 'Constraint SIMFONI masih ada (% tersisa)', v_jumlah;
  end if;

  -- Cabang kasus_simfoni harus hilang dari definisi view. Nama kode itu
  -- memang harus hilang. Teks "SIMFONI" pada kolom keterangan dan pada
  -- komentar view sengaja dipertahankan agar terbaca manusia, jadi yang
  -- diperiksa adalah kode cabangnya: kata kasus_simfoni di luar tanda kutip.
  select pg_get_viewdef('anomali_laporan'::regclass) into v_def;
  if position('''kasus_simfoni''' in v_def) > 0 then
    raise exception 'View anomali masih memuat cabang kasus_simfoni';
  end if;
  -- Lima cabang harus tersisa (A1–A5).
  select count(*) into v_jumlah
  from unnest(array[
    'distribusi_usia', 'subkelompok_perempuan', 'rekap_kategori',
    'rekap_nihil', 'detail_hilang'
  ]) as k
  where position(k in v_def) > 0;
  if v_jumlah <> 5 then
    raise exception 'View anomali hanya memuat % dari 5 cabang', v_jumlah;
  end if;
  -- Kolom yang dipakai cabang A2 harus benar-benar ada di definisi view.
  if position('p.menyusui' in v_def) = 0
     and position('p.hamil_menyusui' in v_def) = 0 then
    raise exception 'Cabang A2 kehilangan kolom subkelompok perempuan';
  end if;

  -- security_invoker harus tetap menyala.
  select count(*) into v_jumlah
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'anomali_laporan'
    and c.reloptions @> array['security_invoker=true'];
  if v_jumlah <> 1 then
    raise exception 'View anomali kehilangan security_invoker = true';
  end if;

  -- Kolom arsip harus tetap ada.
  select count(*) into v_jumlah
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'laporan_kasus'
    and column_name in ('sudah_simfoni', 'no_registrasi_simfoni',
                        'tanggal_input_simfoni', 'penginput_simfoni',
                        'alasan_belum_simfoni');
  if v_jumlah <> 5 then
    raise exception 'Kolom arsip SIMFONI hanya tersisa % dari 5', v_jumlah;
  end if;
end $$;
