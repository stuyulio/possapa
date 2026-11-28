-- =============================================================================
-- Publikasi boleh lebih dari satu per lokasi dan periode
-- =============================================================================
--
-- KEPUTUSAN PEMILIK PRODUK (27 Nov 2026)
--   Data Google Form memuat 12 publikasi untuk RPTRA Gebang pada satu periode
--   dan 2 publikasi untuk Nagari Paninggahan. Sebelumnya `laporan` hanya
--   mengizinkan SATU baris per (pos, periode, jenis), sehingga ke-14 baris itu
--   tidak mungkin disimpan.
--
--   Empat jenis lain tetap satu per lokasi-periode: satu Pos SAPA melaporkan
--   satu rekapitulasi pengaduan, satu ringkasan aktivitas anak, dan seterusnya.
--   Publikasi berbeda sifatnya — satu lokasi memang dapat mempublikasikan
--   beberapa kegiatan di beberapa media pada periode yang sama, dan dashboard
--   menghitung jumlah publikasi dari banyaknya baris laporan.
--
-- BENTUK PERUBAHAN
--   Unique table-level diganti unique INDEX PARSIAL yang tidak mencakup
--   publikasi. Dengan begitu aturan "satu per jenis" tetap ditegakkan database
--   untuk empat jenis lain, tanpa memaksa aplikasi memeriksanya sendiri.
--
--   Constraint tabel tidak dapat diberi predikat, karena itu harus berupa index.
--   Konsekuensinya: `ON CONFLICT (pos_id, periode_id, jenis_laporan)` tanpa
--   predikat tidak lagi menemukan arbiter untuk baris publikasi. Tempat yang
--   memakainya di repo sudah disesuaikan (supabase/seed-data-uji.sql memakai
--   `ON CONFLICT DO NOTHING` tanpa daftar kolom).
--
-- DAMPAK KE APLIKASI — BELUM DISELESAIKAN DI MIGRASI INI
--   `src/app/input/actions.ts` memakai `.maybeSingle()` saat mencari laporan
--   pos+periode+jenis. Setelah ada lebih dari satu publikasi pada kombinasi
--   yang sama, PostgREST mengembalikan galat "multiple rows", sehingga petugas
--   tidak dapat MENYIMPAN publikasi baru untuk kombinasi itu. Formulir
--   publikasi perlu diubah agar menyisipkan baris baru (bukan menimpa) dan
--   `ambilNilaiTersimpan` perlu memilih baris yang tepat. Migrasi ini hanya
--   menyiapkan skema; data lama tidak terpengaruh.
--
-- IDEMPOTEN. Menjalankan ulang hanya melepas 0 constraint dan membuat index
-- yang sama.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Lepas unique table-level.
--    Nama mengikuti pola bawaan PostgreSQL untuk `unique (...)` inline.
-- -----------------------------------------------------------------------------
alter table laporan
  drop constraint if exists laporan_pos_id_periode_id_jenis_laporan_key;

-- -----------------------------------------------------------------------------
-- 2. Unique parsial untuk empat jenis non-publikasi.
--    `if not exists` membuat langkah ini aman dijalankan ulang.
-- -----------------------------------------------------------------------------
create unique index if not exists laporan_unik_per_jenis
  on laporan (pos_id, periode_id, jenis_laporan)
  where jenis_laporan <> 'publikasi';

-- Index pencarian publikasi per lokasi-periode. Tanpa ini, daftar publikasi
-- pada dashboard memindai seluruh baris publikasi nasional.
create index if not exists laporan_publikasi_pos_periode_idx
  on laporan (pos_id, periode_id)
  where jenis_laporan = 'publikasi';

comment on index laporan_unik_per_jenis is
  'Satu laporan per lokasi-periode untuk aktivitas anak, aktivitas perempuan, '
  'rekap pengaduan, dan tindak lanjut kasus. Publikasi dikecualikan: satu lokasi '
  'dapat mempublikasikan beberapa kegiatan pada periode yang sama.';

-- -----------------------------------------------------------------------------
-- 3. VERIFIKASI.
-- -----------------------------------------------------------------------------
do $$
declare
  v_constraint integer;
  v_index      integer;
  v_duplikat   integer;
begin
  select count(*) into v_constraint
  from pg_constraint
  where conrelid = 'laporan'::regclass
    and conname = 'laporan_pos_id_periode_id_jenis_laporan_key';
  if v_constraint <> 0 then
    raise exception 'Unique table-level masih ada; publikasi tetap tidak dapat lebih dari satu';
  end if;

  select count(*) into v_index
  from pg_indexes
  where schemaname = 'public'
    and tablename  = 'laporan'
    and indexname  = 'laporan_unik_per_jenis';
  if v_index <> 1 then
    raise exception 'Index parsial laporan_unik_per_jenis tidak terbentuk';
  end if;

  -- Empat jenis non-publikasi tidak boleh punya duplikat. Kalau sudah ada,
  -- index di atas tidak akan terbentuk dan migrasi sudah gagal lebih dulu —
  -- pemeriksaan ini menjelaskan sebabnya dengan angka.
  select count(*) into v_duplikat
  from (
    select pos_id, periode_id, jenis_laporan
    from laporan
    where jenis_laporan <> 'publikasi'
    group by pos_id, periode_id, jenis_laporan
    having count(*) > 1
  ) d;
  if v_duplikat <> 0 then
    raise exception 'Ada % kombinasi lokasi-periode-jenis yang duplikat', v_duplikat;
  end if;
end $$;
