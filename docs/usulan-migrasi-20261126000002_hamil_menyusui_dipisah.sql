-- =============================================================================
-- USULAN MIGRASI — pindahkan ke supabase/migrations/20261126000002_hamil_menyusui_dipisah.sql
--
-- Aktivitas Perempuan: "Hamil / Menyusui" dipisah menjadi Hamil dan Menyusui
--
-- KEPUTUSAN
--   1. Satu angka gabungan tidak dapat menjawab pertanyaan program: berapa ibu
--      hamil dan berapa ibu menyusui. Keduanya kini diisi terpisah.
--   2. Data historis hanya punya satu angka gabungan dan tidak dapat dipilah.
--      Sesuai keputusan pemilik produk, seluruh angka lama dipindahkan ke kolom
--      `hamil`; `menyusui` mulai dari 0. Total peserta tidak berubah.
--   3. Seorang perempuan dapat hamil sekaligus menyusui, sehingga kedua angka
--      boleh tumpang tindih. Yang diperiksa adalah MASING-MASING terhadap total
--      peserta — sama seperti kepala keluarga, lansia, dan disabilitas — bukan
--      jumlah keduanya terhadap total.
--   4. Template Google Form dan skrip impor sengaja TIDAK dipecah pada tahap
--      ini: memecah pertanyaan akan menggeser nomor seluruh kolom sesudahnya
--      (Q24–Q60) dan menghentikan skrip migrasi. Skrip tetap membaca satu kolom
--      gabungan (indeks 22) dan menulisnya ke `hamil`.
--
-- KENAPA `hamil_menyusui` DIHAPUS
--   Setelah dipindahkan, kolom lama tidak lagi bermakna. Membiarkannya berarti
--   database menyimpan dua tempat untuk angka yang sama, dan keduanya dapat
--   berselisih diam-diam. scripts/migrasi-sheets.mjs sudah disesuaikan pada
--   perubahan yang sama, jadi tidak ada penulis yang tertinggal.
-- =============================================================================

-- 1. Kolom baru. Ditambahkan dengan default 0 supaya baris lama sah seketika,
--    sebelum nilainya dipindahkan pada langkah berikutnya.
alter table laporan_perempuan
  add column if not exists hamil    integer not null default 0 check (hamil >= 0),
  add column if not exists menyusui integer not null default 0 check (menyusui >= 0);

-- 2. Lepaskan view anomali SEBELUM kolom lama dihapus.
--    `view anomali_laporan` menyebut `p.hamil_menyusui`, sehingga PostgreSQL
--    menolak penghapusan kolom selama view itu ada (2BP01). View dibuat ulang
--    di bawah dengan definisi yang memakai kolom baru.
drop view if exists anomali_laporan;

-- 3. Pindahkan angka lama ke `hamil`.
--    Pemeriksaan `if exists` membuat berkas ini aman dijalankan dua kali: pada
--    putaran kedua kolom lama sudah tidak ada dan pemindahan dilewati.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'laporan_perempuan'
      and column_name  = 'hamil_menyusui'
  ) then
    execute 'update laporan_perempuan set hamil = hamil_menyusui';
    execute 'alter table laporan_perempuan drop column hamil_menyusui';
  end if;
end $$;

comment on column laporan_perempuan.hamil is
  'Peserta perempuan yang sedang hamil. Boleh tumpang tindih dengan menyusui.';
comment on column laporan_perempuan.menyusui is
  'Peserta perempuan yang sedang menyusui. Boleh tumpang tindih dengan hamil. '
  'Data sebelum pemisahan (impor Google Form) seluruhnya tercatat di kolom hamil.';

-- =============================================================================
-- VIEW ANOMALI — dibuat ulang (sudah di-drop pada langkah 2) karena kolomnya
-- berubah. PostgreSQL menolak `create or replace view` yang mengubah daftar
-- kolom, jadi drop-and-create adalah satu-satunya jalan.
-- =============================================================================

create view anomali_laporan
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
-- ---------------------------------------------------------------------------
-- A1. Distribusi usia tidak sama dengan jumlah per jenis kelamin.
--     Inilah kerusakan tersembunyi B1 (PRD §6.5): prototipe menutupinya
--     dengan max(sumUsia, sumGender) sehingga total tampak benar padahal
--     rinciannya salah. Di sini selisihnya DITANDAI, bukan ditutupi.
-- ---------------------------------------------------------------------------
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
-- ---------------------------------------------------------------------------
-- A2. Subkelompok peserta perempuan melebihi total peserta.
--     Subkelompok boleh tumpang tindih (kepala keluarga bisa juga lansia,
--     hamil bisa juga menyusui), jadi yang diperiksa adalah masing-masing
--     terhadap total — bukan jumlahnya terhadap total.
-- ---------------------------------------------------------------------------
select
  d.laporan_id, d.pos_id, d.nama_lokasi, d.kab_kota, d.provinsi,
  d.periode_id, d.periode_label, d.jenis_laporan, d.status,
  d.submitted_at, d.catatan_verifikasi, d.catatan_buka_kunci,
  'subkelompok_perempuan'::text,
  'sedang'::text,
  'Subkelompok terbesar ('
    || greatest(p.kepala_keluarga, p.hamil, p.menyusui, p.lansia, p.disabilitas)
    || ') melebihi total peserta (' || p.total_ikut || ')'
from dasar d
join laporan_perempuan p on p.laporan_id = d.laporan_id
where p.total_ikut < greatest(
        p.kepala_keluarga, p.hamil, p.menyusui, p.lansia, p.disabilitas)

union all
-- ---------------------------------------------------------------------------
-- A3. Rincian kategori aduan tidak menjumlah sama dengan aduan masuk.
--     Constraint database hanya mencegah kategori MELEBIHI total; kurang dari
--     total lolos tanpa terdeteksi.
-- ---------------------------------------------------------------------------
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
-- ---------------------------------------------------------------------------
-- A4. Status "Nihil" tetapi masih ada hitungan.
--     Sudah dijaga constraint `rekap_nihil_nol`; dipertahankan sebagai
--     lapisan kedua karena data masuk juga lewat impor manual (PRD §15.2).
-- ---------------------------------------------------------------------------
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
-- ---------------------------------------------------------------------------
-- A5. Kelengkapan SIMFONI tidak konsisten dengan statusnya.
-- ---------------------------------------------------------------------------
select
  d.laporan_id, d.pos_id, d.nama_lokasi, d.kab_kota, d.provinsi,
  d.periode_id, d.periode_label, d.jenis_laporan, d.status,
  d.submitted_at, d.catatan_verifikasi, d.catatan_buka_kunci,
  'kasus_simfoni'::text,
  'tinggi'::text,
  case
    when k.sudah_simfoni then
      'Ditandai sudah tercatat SIMFONI tetapi '
        || concat_ws(', ',
             case when k.no_registrasi_simfoni is null
                  then 'nomor registrasi kosong' end,
             case when k.tanggal_input_simfoni is null
                  then 'tanggal input kosong' end,
             case when k.penginput_simfoni is null
                  then 'penginput kosong' end)
        || ' belum diisi'
    else 'Belum tercatat SIMFONI tetapi alasan belum diisi'
  end
from dasar d
join laporan_kasus k on k.laporan_id = d.laporan_id
where (k.sudah_simfoni
        and (k.no_registrasi_simfoni is null
             or k.tanggal_input_simfoni is null
             or k.penginput_simfoni is null))
   or (not k.sudah_simfoni and k.alasan_belum_simfoni is null)

union all
-- ---------------------------------------------------------------------------
-- A6. Laporan non-draf tanpa baris rincian.
--     Risiko nyata dari penyimpanan dua langkah di `simpanLaporan`: bila
--     upsert rincian gagal setelah induk tersimpan, yang tersisa adalah
--     laporan kosong yang tetap terhitung dalam matriks kepatuhan.
-- ---------------------------------------------------------------------------
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
  );

comment on view anomali_laporan is
  'Anomali data dihitung saat dibaca (PRD §6.4). Satu baris = satu anomali. '
  'security_invoker = true supaya RLS tabel dasar tetap berlaku. '
  'Tumpang tindih periode TIDAK termasuk — itu aturan master data (§6.4), '
  'diperiksa di /admin/periode.';

revoke all on anomali_laporan from anon;
grant select on anomali_laporan to authenticated;

-- =============================================================================
-- VERIFIKASI — gagal keras bila keadaan akhir tidak sesuai.
-- =============================================================================

do $$
declare
  v_jumlah integer;
  v_def    text;
begin
  -- Kolom lama harus benar-benar hilang.
  select count(*) into v_jumlah
  from information_schema.columns
  where table_schema = 'public'
    and table_name   = 'laporan_perempuan'
    and column_name  = 'hamil_menyusui';

  if v_jumlah <> 0 then
    raise exception 'Kolom hamil_menyusui masih ada pada laporan_perempuan';
  end if;

  -- Kedua kolom baru harus ada.
  select count(*) into v_jumlah
  from information_schema.columns
  where table_schema = 'public'
    and table_name   = 'laporan_perempuan'
    and column_name  in ('hamil', 'menyusui');

  if v_jumlah <> 2 then
    raise exception 'Kolom hamil/menyusui belum lengkap (ditemukan %)', v_jumlah;
  end if;

  -- View anomali harus memakai kolom menyusui yang baru.
  select pg_get_viewdef('anomali_laporan'::regclass) into v_def;

  if position('p.menyusui' in v_def) = 0 then
    raise exception 'View anomali belum memeriksa kolom menyusui';
  end if;
end $$;
